import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { mergeBookOrder, moveBookTo, findDropTarget } from '../src/utils/reorder.js';
import { applyPreset, preparePreset } from '../src/utils/presets.js';
import { readDocumentMetadata, documentFormat } from '../src/utils/documentMetadata.js';
import { PDFDocument } from 'pdf-lib';
import { zipSync, strToU8 } from 'fflate';

// Each test imports a patched copy of a storage module. The import URL has to be
// unique per test, otherwise an identical copy is served from the module cache and
// the test inherits the previous test's already-closed database.
let moduleSequence = 0;
async function loadModule(source) {
  moduleSequence += 1;
  const unique = `${source}\n// module instance ${moduleSequence}`;
  return import(`data:text/javascript;base64,${Buffer.from(unique).toString('base64')}`);
}


test('PDF import reads embedded details, page count and filename fallback locally', async () => {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Embedded PDF title'); pdf.setAuthor('Embedded author'); pdf.addPage(); pdf.addPage();
  const result = await readDocumentMetadata(await pdf.save(), 'fallback-name.pdf');
  assert.equal(result.book, 'Embedded PDF title'); assert.equal(result.author, 'Embedded author'); assert.equal(result.pages, 2);
  assert.equal((await readDocumentMetadata(new Uint8Array([1, 2]), 'fallback-name.pdf')).book, 'fallback name');
  assert.throws(() => documentFormat('not-a-book.exe'));
});

test('EPUB import reads package metadata without extracting content or fetching resources', async () => {
  const bytes = zipSync({
    'META-INF/container.xml': strToU8('<container><rootfiles><rootfile full-path="OPS/content.opf"/></rootfiles></container>'),
    'OPS/content.opf': strToU8('<package xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata><dc:title>EPUB title</dc:title><dc:creator>EPUB author</dc:creator><dc:subject>Fantasy</dc:subject></metadata></package>'),
  });
  const result = await readDocumentMetadata(bytes, 'fallback.epub');
  assert.equal(result.book, 'EPUB title'); assert.equal(result.author, 'EPUB author'); assert.equal(result.subgenres, 'Fantasy');
  assert.equal((await readDocumentMetadata(null, 'large.epub')).book, 'large');
});

test('moving across shelves inserts the title and preserves every other relative position', () => {
  const books = [1, 2, 3, 4, 5, 6].map((id) => ({ id, book: `Book ${id}` }));
  assert.deepEqual(moveBookTo(books, 1, 5).map((b) => b.id), [2, 3, 4, 5, 1, 6]);
  assert.deepEqual(moveBookTo(books, 6, 2).map((b) => b.id), [1, 6, 2, 3, 4, 5]);
  assert.deepEqual(books.map((b) => b.id), [1, 2, 3, 4, 5, 6]);
});

test('filtered reordering keeps hidden records, rejects duplicates and stale IDs', () => {
  const books = [1, 2, 3, 4].map((id) => ({ id, notes: 'retain me' }));
  assert.deepEqual(mergeBookOrder(books, [{ id: 4 }, { id: 2 }]), [books[0], books[3], books[2], books[1]]);
  assert.throws(() => mergeBookOrder(books, [{ id: 2 }, { id: 2 }]));
  assert.throws(() => mergeBookOrder(books, [{ id: 99 }]));
});

test('drop targets follow measured rows and ignore drops outside the shelf', () => {
  const slots = [{ id: 1, x: 20, y: 90, width: 80, height: 280 }, { id: 2, x: 110, y: 90, width: 80, height: 280 }, { id: 3, x: 20, y: 420, width: 80, height: 280 }];
  assert.equal(findDropTarget(slots, 140, 360), 2);
  assert.equal(findDropTarget(slots, 40, 450), 3);
  assert.equal(findDropTarget(slots, 40, 390), null);
  assert.equal(findDropTarget(slots, -2, 100), null);
});

test('presets intersect title selections, categories, statuses and text while keeping saved order', () => {
  const books = [
    { id: 1, book: 'First story', status: 'Want to Read', subgenres: 'Fantasy, Adventure' },
    { id: 2, book: 'Second story', status: 'Completed', subgenres: 'Fantasy' },
    { id: 3, book: 'Third story', status: 'Want to Read', subgenres: 'Fantasy' },
  ];
  const preset = preparePreset({ name: ' Next reads ', bookIds: [3, 2, 1, 3], categories: ['fantasy'], statuses: ['Want to Read'], query: 'story' });
  assert.equal(preset.name, 'Next reads');
  assert.deepEqual(applyPreset(books, preset).map((book) => book.id), [3, 1]);
  assert.equal(applyPreset(books, { ...preset, bookIds: [], query: '' }).length, 2);
  assert.throws(() => preparePreset({ name: '  ' }));
});

test('SQLite migration and reorder preserve IDs and data, persist order and roll back failures', async () => {
  const sql = new DatabaseSync(':memory:');
  // Recreate the old schema to exercise a real upgrade of existing records.
  sql.exec('CREATE TABLE books (id INTEGER PRIMARY KEY AUTOINCREMENT, book TEXT NOT NULL, author TEXT NOT NULL, status TEXT NOT NULL, subgenres TEXT, type TEXT, pages INTEGER, startDate TEXT, endDate TEXT, rate INTEGER, spicyLevel INTEGER, color TEXT, notes TEXT)');
  for (const id of [11, 21, 31]) sql.prepare('INSERT INTO books (id, book, author, status, notes) VALUES (?, ?, ?, ?, ?)').run(id, `Title ${id}`, 'Author', 'Want to Read', `Original note ${id}`);
  sql.exec("UPDATE books SET type='Anime Series', pages=28 WHERE id=31");
  let failId = null;
  const adapter = {
    execAsync: async (query) => sql.exec(query),
    getAllAsync: async (query, params = []) => sql.prepare(query).all(...params),
    getFirstAsync: async (query, params = []) => sql.prepare(query).get(...params),
    runAsync: async (query, params = []) => {
      if (query.startsWith('UPDATE books SET sortOrder') && params[1] === failId) throw new Error('Simulated storage failure');
      const result = sql.prepare(query).run(...params);
      return { ...result, lastInsertRowId: Number(result.lastInsertRowid) };
    },
    withTransactionAsync: async (callback) => {
      sql.exec('BEGIN');
      try { await callback(); sql.exec('COMMIT'); }
      catch (error) { sql.exec('ROLLBACK'); throw error; }
    },
  };
  globalThis.__readlistSqliteTest = { openDatabaseAsync: async () => adapter };
  let source = await readFile(new URL('../src/database.native.js', import.meta.url), 'utf8');
  source = source.replace("import * as SQLite from 'expo-sqlite';", 'const SQLite = globalThis.__readlistSqliteTest;')
    .replace("import { Platform } from 'react-native';", "const Platform = { OS: 'android' };")
    .replace("'./utils/reorder'", JSON.stringify(new URL('../src/utils/reorder.js', import.meta.url).href))
    .replace("'./utils/presets'", JSON.stringify(new URL('../src/utils/presets.js', import.meta.url).href))
    .replace("'./utils/backup'", JSON.stringify(new URL('../src/utils/backup.js', import.meta.url).href));
  const db = await loadModule(source);
  await db.initDatabase();
  const initial = await db.fetchBooks();
  assert.equal(initial.find(book => book.id === 31).episodes, 28);
  assert.equal(initial.find(book => book.id === 31).pages, 0);
  await db.reorderBooks([initial[2], initial[0]]);
  assert.deepEqual((await db.fetchBooks()).map((book) => book.id), [11, 21, 31]);
  assert.deepEqual((await db.fetchBooks()).map((book) => book.notes), ['Original note 11', 'Original note 21', 'Original note 31']);
  failId = 21;
  await assert.rejects(db.reorderBooks([{ id: 31 }, { id: 21 }, { id: 11 }]), /Simulated storage failure/);
  assert.deepEqual((await db.fetchBooks()).map((book) => book.id), [11, 21, 31]);
  failId = null;
  const preset = await db.saveLibraryPreset({ name: 'Weekend', bookIds: [31, 11], statuses: ['Want to Read'], categories: [] });
  assert.deepEqual((await db.fetchLibraryPresets())[0], preset);
  await assert.rejects(db.saveLibraryPreset({ name: 'weekend' }), /already exists/);
  await db.saveShelfSettings(5);
  assert.deepEqual(await db.fetchShelfSettings(), { shelfCount: 5 });
  await assert.rejects(db.saveShelfSettings(0));
  await assert.rejects(db.saveShelfSettings(2.5));
  const added = await db.addBook({ book: 'Attached book', author: 'Author', attachmentUri: 'file:///private/reading-files/book.epub', attachmentName: 'book.epub', attachmentFormat: 'EPUB', episodes: 24, currentEpisode: 7 });
  const attached = (await db.fetchBooks()).find((book) => book.id === added.id);
  assert.equal(attached.attachmentName, 'book.epub');
  assert.equal(attached.episodes, 24); assert.equal(attached.currentEpisode, 7);
  await db.updateBook(added.id, { ...attached, book: 'Edited attachment title', currentEpisode: 8 });
  assert.equal((await db.fetchBooks()).find((book) => book.id === added.id).attachmentUri, attached.attachmentUri);
  assert.equal((await db.fetchBooks()).find(book => book.id === added.id).currentEpisode, 8);
  const readingPosition = { format: 'EPUB', chapterId: 'OPS/two.xhtml', scroll: .5, theme: 'dark', fileUri: attached.attachmentUri };
  await db.saveReadingPosition(added.id, readingPosition);
  assert.deepEqual(await db.fetchReadingPosition(added.id), readingPosition);
  const authorless = await db.addBook({ book: 'No author', author: '' });
  assert.equal((await db.fetchBooks()).find(book => book.id === authorless.id).author, '');
  sql.close();
  delete globalThis.__readlistSqliteTest;
});

test('a fresh native library stays empty until sample titles are explicitly chosen', async () => {
  const sql = new DatabaseSync(':memory:');
  const adapter = {
    execAsync: async (query) => sql.exec(query),
    getAllAsync: async (query, params = []) => sql.prepare(query).all(...params),
    getFirstAsync: async (query, params = []) => sql.prepare(query).get(...params),
    runAsync: async (query, params = []) => {
      const result = sql.prepare(query).run(...params);
      return { ...result, lastInsertRowId: Number(result.lastInsertRowid) };
    },
    withTransactionAsync: async (callback) => {
      sql.exec('BEGIN');
      try { await callback(); sql.exec('COMMIT'); }
      catch (error) { sql.exec('ROLLBACK'); throw error; }
    },
  };
  globalThis.__readlistSqliteTest = { openDatabaseAsync: async () => adapter };
  let source = await readFile(new URL('../src/database.native.js', import.meta.url), 'utf8');
  source = source.replace("import * as SQLite from 'expo-sqlite';", 'const SQLite = globalThis.__readlistSqliteTest;')
    .replace("import { Platform } from 'react-native';", "const Platform = { OS: 'android' };")
    .replace("'./utils/reorder'", JSON.stringify(new URL('../src/utils/reorder.js', import.meta.url).href))
    .replace("'./utils/presets'", JSON.stringify(new URL('../src/utils/presets.js', import.meta.url).href))
    .replace("'./utils/backup'", JSON.stringify(new URL('../src/utils/backup.js', import.meta.url).href));
  const db = await loadModule(source);
  assert.deepEqual(await db.initDatabase(), []);
  assert.equal(await db.fetchOnboardingComplete(), false);
  const samples = await db.seedSampleLibrary();
  assert.equal(samples.length, db.INITIAL_BOOKS.length);
  assert.ok(samples.every((book) => Number(book.isSample) === 1), 'seeded titles are marked as examples');
  assert.equal(samples.find((book) => book.type === 'Anime Series').episodes, 28);
  assert.equal(samples.find((book) => book.type === 'Anime Series').pages, 0);
  await db.setOnboardingComplete(true);
  assert.equal(await db.fetchOnboardingComplete(), true);
  await assert.rejects(db.seedSampleLibrary(), /empty library/i);
  const own = await db.addBook({ book: 'My own title' });
  assert.equal((await db.fetchBooks()).find((book) => book.id === own.id).isSample, 0, 'user titles are not examples');
  sql.close();
  delete globalThis.__readlistSqliteTest;
});

test('a fresh web library starts empty until the user chooses sample data', async () => {
  const storage = new Map();
  globalThis.window = { localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) } };
  let source = await readFile(new URL('../src/database.web.js', import.meta.url), 'utf8');
  source = source.replace("'./utils/reorder'", JSON.stringify(new URL('../src/utils/reorder.js', import.meta.url).href))
    .replace("'./utils/presets'", JSON.stringify(new URL('../src/utils/presets.js', import.meta.url).href))
    .replace("'./utils/backup'", JSON.stringify(new URL('../src/utils/backup.js', import.meta.url).href));
  const db = await loadModule(source);
  assert.deepEqual(await db.initDatabase(), []);
  assert.equal(await db.fetchOnboardingComplete(), false);
  const samples = await db.seedSampleLibrary();
  assert.equal(samples.length, db.INITIAL_BOOKS.length);
  assert.ok(samples.every((book) => Number(book.isSample) === 1), 'seeded titles are marked as examples');
  assert.equal(samples.find((book) => book.type === 'Anime Series').episodes, 28);
  assert.equal(samples.find((book) => book.type === 'Anime Series').pages, 0);
  await db.setOnboardingComplete(true);
  assert.equal(await db.fetchOnboardingComplete(), true);
  await assert.rejects(db.seedSampleLibrary(), /empty library/i);
  delete globalThis.window;
});

test('web storage repairs legacy missing/duplicate IDs and keeps newly added IDs stable', async () => {
  const storage = new Map([['readlist_books_v2', JSON.stringify([{ id: 1, book: 'Original' }, { book: 'Missing ID' }, { id: 1, book: 'Duplicate ID' }])]]);
  globalThis.window = { localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) } };
  let source = await readFile(new URL('../src/database.web.js', import.meta.url), 'utf8');
  source = source.replace("'./utils/reorder'", JSON.stringify(new URL('../src/utils/reorder.js', import.meta.url).href))
    .replace("'./utils/presets'", JSON.stringify(new URL('../src/utils/presets.js', import.meta.url).href))
    .replace("'./utils/backup'", JSON.stringify(new URL('../src/utils/backup.js', import.meta.url).href));
  const db = await loadModule(source);
  const records = await db.initDatabase();
  assert.equal(records[0].id, 1);
  assert.equal(new Set(records.map((book) => book.id)).size, 3);
  const added = await db.addBook({ id: undefined, book: 'New book' });
  assert.equal(typeof added.id, 'number');
  assert.equal((await db.initDatabase()).find((book) => book.book === 'New book').id, added.id);
  await db.reorderBooks([{ id: records[2].id }, { id: records[0].id }]);
  assert.equal((await db.fetchBooks()).length, 4);
  delete globalThis.window;
});


test('onboarding is first-run only for incomplete empty libraries', async () => {
  const { resolveOnboardingMode } = await import('../src/utils/onboarding.js');
  assert.equal(resolveOnboardingMode({ completed: true, librarySize: 0 }), 'done');
  assert.equal(resolveOnboardingMode({ completed: false, librarySize: 3 }), 'existing-library');
  assert.equal(resolveOnboardingMode({ completed: false, librarySize: 0 }), 'first-run');
});

test('progress dates fill completion time once, preserve history and distinguish episodes', async () => {
  const { currentTimestamp, statusDates, isSeries, episodeLabel } = await import('../src/utils/progress.js');
  const now = '2026-11-02T12:00:00+08:00';
  assert.equal(Date.parse(currentTimestamp(new Date(now))), Date.parse(now));
  const ongoing = { startDate: '2025-06-01', endDate: '' };
  const finished = statusDates(ongoing, 'Completed', 'Currently Watching', now);
  assert.equal(finished.startDate, '2025-06-01'); assert.equal(finished.endDate, now);
  assert.equal(statusDates(finished, 'Completed', 'Completed', '2027-01-01').endDate, now);
  assert.equal(statusDates(ongoing, 'Currently Watching', 'Want to Watch', now).endDate, '');
  assert.equal(episodeLabel({type:'Anime Series',currentEpisode:7,episodes:24}), 'Current episode: 7 / 24');
  assert.equal(isSeries('Anime'), true);
  assert.equal(isSeries('Anime Series'), true); assert.equal(isSeries('Anime Movie'), false);
});

test('insights classify media so pages and episodes are never mixed', async () => {
  const { mediaKind } = await import('../src/utils/progress.js');
  assert.equal(mediaKind('Paperback'), 'book');
  assert.equal(mediaKind('Kindle / E-book'), 'book');
  assert.equal(mediaKind(''), 'book');
  assert.equal(mediaKind('Anime Series'), 'series');
  assert.equal(mediaKind('TV Series'), 'series');
  assert.equal(mediaKind('Anime Movie'), 'movie');
  assert.equal(mediaKind('Documentary'), 'movie');
});

test('a workbook round trip keeps titles, units, Unicode and example markers', async () => {
  const { buildWorkbook, parseWorkbook, libraryToWorkbook, workbookToLibrary, WORKBOOK_APP } = await import('../src/utils/workbook.js');
  const books = [
    { id: 1, book: 'Paper → book', author: 'Author A', status: 'Completed', type: 'Paperback', pages: 420, rate: 4, spicyLevel: 2, subgenres: 'Fantasy, Adventure', startDate: '2025-01-02', endDate: '2025-01-09', notes: 'Café — naïve “quotes” & <tags>', sortOrder: 0 },
    { id: 2, book: 'アニメ 二', author: '', status: 'Currently Watching', type: 'Anime Series', pages: 0, episodes: 24, currentEpisode: 7, rate: 5, spicyLevel: 0, sortOrder: 1, isSample: 1 },
    { id: 3, book: 'A film', author: 'Director B', status: 'Completed', type: 'Documentary', rate: 3, sortOrder: 2 },
  ];
  const positions = { 1: { format: 'PDF', page: 12, scroll: 0.5, updatedAt: '2025-02-01T10:00:00+08:00' }, 2: { format: 'EPUB', chapterId: 'OPS/two.xhtml', scroll: 0.25 } };
  const bytes = buildWorkbook(libraryToWorkbook(books, positions, '2025-02-01T10:00:00+08:00'));
  const parsed = parseWorkbook(bytes);
  assert.deepEqual(parsed.sheets.map((sheet) => sheet.name), ['ReadList', 'Books', 'Series', 'Movies', 'Progress']);
  const meta = parsed.sheets[0];
  assert.equal(meta.rows[1][1], WORKBOOK_APP);

  const result = workbookToLibrary(parsed);
  assert.equal(result.issues.length, 0);
  assert.equal(result.books.length, 3);
  const paper = result.books.find((book) => book.id === 1);
  assert.equal(paper.book, 'Paper → book');
  assert.equal(paper.pages, 420);
  assert.equal(paper.episodes, 0);
  assert.equal(paper.notes, 'Café — naïve “quotes” & <tags>');
  assert.equal(paper.subgenres, 'Fantasy, Adventure');
  assert.equal(paper.startDate, '2025-01-02');
  const anime = result.books.find((book) => book.id === 2);
  assert.equal(anime.type, 'Anime Series');
  assert.equal(anime.episodes, 24);
  assert.equal(anime.currentEpisode, 7);
  assert.equal(anime.pages, 0, 'a series row never gains a page count');
  assert.equal(anime.isSample, 1);
  assert.equal(anime.author, '', 'an empty author survives the round trip');
  const film = result.books.find((book) => book.id === 3);
  assert.equal(film.type, 'Documentary');
  assert.equal(film.isSample, 0);
  assert.equal(result.positions['1'].page, 12);
  assert.equal(result.positions['2'].chapterId, 'OPS/two.xhtml');
  assert.equal(result.positions['2'].scroll, 0.25);
});

test('workbook import validates structure and reports skipped rows instead of guessing', async () => {
  const { buildWorkbook, parseWorkbook, workbookToLibrary, summarizeWorkbook } = await import('../src/utils/workbook.js');
  assert.throws(() => parseWorkbook(new Uint8Array([1, 2, 3])), /readable \.xlsx/i);

  const missingTitles = buildWorkbook([
    { name: 'ReadList', rows: [['key', 'value'], ['app', 'ReadList']] },
    { name: 'Books', rows: [['id', 'title'], [1, ''], [2, 'Kept']] },
  ]);
  const parsedMissing = parseWorkbook(missingTitles);
  const partial = workbookToLibrary(parsedMissing);
  assert.deepEqual(partial.books.map((book) => book.id), [2]);
  assert.match(partial.issues[0], /row 2 has no title/i);

  const duplicates = buildWorkbook([
    { name: 'Books', rows: [['id', 'title'], [1, 'First'], [1, 'Second']] },
  ]);
  const dup = workbookToLibrary(parseWorkbook(duplicates));
  assert.deepEqual(dup.books.map((book) => book.book), ['First']);
  assert.match(dup.issues[0], /repeats the id 1/i);

  const noIdColumn = buildWorkbook([{ name: 'Books', rows: [['title'], ['No id']] }]);
  assert.throws(() => workbookToLibrary(parseWorkbook(noIdColumn)), /no id column/i);

  const aliased = buildWorkbook([
    { name: 'Books', rows: [['ID', 'Name', 'Writer', 'Tags', 'Rate'], [9, 'Alias test', 'Someone', 'A, B', 4]] },
  ]);
  const aliasedResult = summarizeWorkbook(parseWorkbook(aliased));
  assert.equal(aliasedResult.total, 1);
  assert.equal(aliasedResult.book, 1);
  assert.equal(aliasedResult.records[0].author, 'Someone');
  assert.equal(aliasedResult.records[0].rate, 4);
  assert.equal(aliasedResult.records[0].subgenres, 'A, B');
});

test('backup validation rejects unusable files before anything is written', async () => {
  const { validateBackup } = await import('../src/utils/backup.js');
  assert.throws(() => validateBackup(null), /not a ReadList backup/i);
  assert.throws(() => validateBackup([]), /not a ReadList backup/i);
  assert.throws(() => validateBackup({ app: 'Other' }), /different app/i);
  assert.throws(() => validateBackup({}), /does not contain a library/i);
  assert.throws(() => validateBackup({ books: [{ id: 1 }] }), /no title/i);
  assert.throws(() => validateBackup({ books: [{ book: 'A' }] }), /no ID/i);
  assert.throws(() => validateBackup({ books: [{ book: 'A', id: 1 }, { book: 'B', id: 1 }] }), /more than once/i);
  const backup = validateBackup({
    app: 'ReadList',
    books: [{ id: 7, book: ' Kept title ', pages: '-4', rate: '5', isSample: true, unknown: 'dropped' }],
    presets: [{ id: 'p', name: '  ' }, { id: 'q', name: ' Real ' }],
    shelfSettings: { shelfCount: 99 },
    readingPositions: { 7: { page: 3 }, bad: 'nope' },
    readerPreferences: { showProgress: 'yes' },
  });
  assert.equal(backup.books[0].book, 'Kept title');
  assert.equal(backup.books[0].pages, 0);
  assert.equal(backup.books[0].rate, 5);
  assert.equal(backup.books[0].isSample, 1);
  assert.equal(backup.books[0].unknown, undefined);
  assert.deepEqual(backup.presets.map((preset) => preset.name), ['Real']);
  assert.equal(backup.shelfSettings.shelfCount, 3);
  assert.deepEqual(Object.keys(backup.readingPositions), ['7']);
  assert.equal(backup.readerPreferences.showProgress, true);
});

test('a local backup restores records, reading positions and examples without duplicates', async () => {
  const sql = new DatabaseSync(':memory:');
  let failId = null;
  const adapter = {
    execAsync: async (query) => sql.exec(query),
    getAllAsync: async (query, params = []) => sql.prepare(query).all(...params),
    getFirstAsync: async (query, params = []) => sql.prepare(query).get(...params),
    runAsync: async (query, params = []) => {
      if (query.startsWith('UPDATE books SET sortOrder') && params[1] === failId) throw new Error('Simulated storage failure');
      const result = sql.prepare(query).run(...params);
      return { ...result, lastInsertRowId: Number(result.lastInsertRowid) };
    },
    withTransactionAsync: async (callback) => {
      sql.exec('BEGIN');
      try { await callback(); sql.exec('COMMIT'); }
      catch (error) { sql.exec('ROLLBACK'); throw error; }
    },
  };
  globalThis.__readlistSqliteTest = { openDatabaseAsync: async () => adapter };
  let source = await readFile(new URL('../src/database.native.js', import.meta.url), 'utf8');
  source = source.replace("import * as SQLite from 'expo-sqlite';", 'const SQLite = globalThis.__readlistSqliteTest;')
    .replace("import { Platform } from 'react-native';", "const Platform = { OS: 'android' };")
    .replace("'./utils/reorder'", JSON.stringify(new URL('../src/utils/reorder.js', import.meta.url).href))
    .replace("'./utils/presets'", JSON.stringify(new URL('../src/utils/presets.js', import.meta.url).href))
    .replace("'./utils/backup'", JSON.stringify(new URL('../src/utils/backup.js', import.meta.url).href));
  const db = await loadModule(source);
  await db.initDatabase();
  const samples = await db.seedSampleLibrary();
  const example = samples[0];
  await db.saveReadingPosition(example.id, { page: 2, format: 'PDF', fileUri: 'file:///a.pdf', scroll: 0.25 });
  const snapshot = await db.exportLibrary();
  assert.equal(snapshot.app, 'ReadList');
  assert.equal(snapshot.books.length, samples.length);
  assert.equal(snapshot.readingPositions[String(example.id)].scroll, 0.25);

  await db.deleteBook(example.id);
  const merged = await db.importLibrary(snapshot, { replace: false });
  assert.equal(merged.imported, samples.length);
  assert.ok((await db.fetchBooks()).some((book) => String(book.id) === String(example.id)), 'a merged backup brings the deleted title back without duplicating the rest');
  assert.equal((await db.fetchBooks()).length, samples.length);

  await db.importLibrary({ ...snapshot, books: [snapshot.books[0]] }, { replace: true });
  const remaining = await db.fetchBooks();
  assert.equal(remaining.length, 1, 'replace leaves only the backup records');
  assert.equal(remaining[0].isSample, 1);

  const added = await db.addSampleTitles();
  assert.equal(added.added, samples.length - 1, 'adding examples skips the one that is already there');
  assert.equal((await db.fetchBooks()).length, samples.length);
  const again = await db.addSampleTitles();
  assert.equal(again.added, 0, 'adding examples twice adds nothing');

  await assert.rejects(db.importLibrary({ books: [{ book: '', id: 1 }] }, {}), /title/i);
  assert.equal((await db.fetchBooks()).length, samples.length, 'a rejected import leaves the library untouched');
  failId = null;
  sql.close();
  delete globalThis.__readlistSqliteTest;
});
