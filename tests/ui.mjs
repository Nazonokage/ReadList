import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';

const directory = resolve(process.env.READLIST_DIST || 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.ico': 'image/x-icon' };
const server = createServer(async (req, res) => {
  try {
    const path = resolve(directory, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (path !== directory && !path.startsWith(directory + sep)) { res.writeHead(403).end(); return; }
    const actual = path === directory || !extname(path) ? resolve(directory, 'index.html') : path;
    res.setHeader('Content-Type', types[extname(actual)] || 'application/octet-stream');
    res.end(await readFile(actual));
  } catch { res.writeHead(404).end(); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  // Exercise browsers without durable file handles: keep only a live source
  // reference and require relinking after reload, never persist file bytes.
  await page.addInitScript(() => { window.showOpenFilePicker = undefined; });
  const errors = [];
  page.on('pageerror', (error) => { errors.push(error.message); console.error('App runtime error:', error.message); });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.getByText('ReadList', { exact: true }).waitFor();
  await page.getByText('Welcome to ReadList', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Use sample titles', exact: true }).click();
  await page.getByText('Start with a title', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByText('Find it again', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByText('Pick up where you left off', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Finish guide', exact: true }).click();
  await page.getByText('SHELF AUTO-LAYOUT', { exact: true }).waitFor();
  // Once finished, the guide is replayable from the header and skippable again.
  await page.getByLabel('Open the quick guide', { exact: true }).click();
  await page.getByText('Start with a title', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Use sample titles', exact: true }).count(), 0, 'replay does not re-offer the library choice');
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.getByText('Start with a title', { exact: true }).waitFor({ state: 'hidden' });
  await page.getByLabel('List view', { exact: true }).click();
  await mkdir('.expo/verification', { recursive: true });
  await page.screenshot({ path: '.expo/verification/list-view.png', fullPage: true });
  await page.getByLabel('Add a title').click();
  await page.getByPlaceholder('e.g. Fourth Wing').fill('UI test story');
  await page.getByLabel('Author / creator', { exact: true }).fill('UI test author');
  await page.getByText('+ Add “UI test author”', { exact: true }).click();
  const authorInput = page.getByLabel('Author / creator', { exact: true });
  await authorInput.click(); await authorInput.press('ControlOrMeta+A'); await authorInput.press('Backspace');
  assert.equal(await authorInput.inputValue(), '');
  await authorInput.fill('Replacement author');
  await page.getByLabel('Categories and tags', { exact: true }).click();
  assert.equal(await authorInput.inputValue(), 'Replacement author');
  await page.getByLabel('Categories and tags', { exact: true }).fill('New test category');
  await page.getByText('+ Add “New test category”', { exact: true }).click();
  await page.getByLabel('Categories and tags', { exact: true }).fill('Sports');
  await page.getByRole('button', { name: 'Sports', exact: true }).click();
  assert.equal(await page.getByLabel('Remove New test category', { exact: true }).count(), 1);
  assert.equal(await page.getByLabel('Remove Sports', { exact: true }).count(), 1);
  assert.ok(!Number.isNaN(Date.parse(await page.getByLabel('Start date and time').inputValue())));
  assert.equal(await page.getByLabel('End date', { exact: true }).inputValue(), '');
  if (process.argv[2]) await page.screenshot({ path: resolve(process.argv[2], '..', 'readlist-app-form-verified.png'), fullPage: true });
  await page.getByText('Save', { exact: true }).click();
  await page.getByText('Add New Title', { exact: true }).waitFor({ state: 'hidden' });
  await page.getByLabel('Choose or create a library preset').click();
  await page.getByText('+ Create preset', { exact: true }).click();
  await page.getByLabel('Preset name', { exact: true }).fill('UI test preset');
  await page.getByLabel('Categories', { exact: true }).fill('New test category');
  await page.getByRole('button', { name: 'New test category', exact: true }).click();
  await page.getByRole('checkbox').filter({ hasText: 'UI test story' }).click();
  await page.getByText('Save', { exact: true }).click();
  await page.getByText('UI test preset', { exact: true }).waitFor();
  await page.reload();
  await page.getByLabel('Choose or create a library preset').click();
  await page.getByText('UI test preset', { exact: true }).waitFor();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('readlist_library_presets_v1')));
  assert.equal(stored[0].name, 'UI test preset');
  assert.equal(stored[0].bookIds.length, 1);
  assert.equal(typeof stored[0].bookIds[0], 'number');
  assert.deepEqual(stored[0].categories, ['New test category']);
  await page.getByText('Close', { exact: true }).click();
  const savedBooks = await page.evaluate(() => JSON.parse(localStorage.getItem('readlist_books_v2')));
  assert.equal(savedBooks.find((b) => b.book === 'UI test story').author, 'Replacement author');
  assert.equal(savedBooks.find((b) => b.book === 'UI test story').subgenres, 'New test category, Sports');
  // Set shelf count and verify both pagination and restart persistence.
  await page.getByLabel('Shelf view', { exact: true }).click();
  await page.getByText('SHELF AUTO-LAYOUT', { exact: true }).click();
  await page.getByLabel('Shelves per page', { exact: true }).fill('1');
  await page.getByText('Apply', { exact: true }).click();
  const shelfPages = Math.ceil(savedBooks.length / 4);
  await page.getByText(`Page 1 of ${shelfPages}`, { exact: true }).waitFor();
  await page.getByText('SHELF AUTO-LAYOUT', { exact: true }).click();
  await page.getByLabel('Next shelves', { exact: true }).click();
  await page.getByText(`Page 2 of ${shelfPages}`, { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('readlist_shelf_settings_v1')).shelfCount), 1);
  await page.getByLabel('Previous shelves', { exact: true }).click();
  // A plain tap on a spine still opens details.
  const shelfSpines = page.getByLabel(/^Open details for /);
  await shelfSpines.first().waitFor();
  await shelfSpines.first().click();
  await page.getByText('Title details', { exact: true }).waitFor();
  await page.getByLabel('Close details', { exact: true }).click();
  await page.getByText('Title details', { exact: true }).waitFor({ state: 'hidden' });
  await page.getByLabel('Arrange titles', { exact: true }).click();
  const beforeDrag = await page.evaluate(() => JSON.parse(localStorage.getItem('readlist_books_v2')).map((book) => book.id));
  const nativeHandles = page.getByLabel(/^Drag .+ to rearrange$/);
  await nativeHandles.first().waitFor();
  const firstHandle = await nativeHandles.nth(0).boundingBox();
  const secondHandle = await nativeHandles.nth(1).boundingBox();
  await page.mouse.move(firstHandle.x + firstHandle.width / 2, firstHandle.y + firstHandle.height / 2);
  await page.mouse.down();
  await page.mouse.move(secondHandle.x + secondHandle.width / 2, secondHandle.y + secondHandle.height / 2 + 5, { steps: 20 });
  await page.mouse.up();
  await page.waitForFunction((before) => JSON.parse(localStorage.getItem('readlist_books_v2'))[0].id === before[1], beforeDrag);
  const afterDrag = await page.evaluate(() => JSON.parse(localStorage.getItem('readlist_books_v2')).map((book) => book.id));
  assert.deepEqual(afterDrag, [beforeDrag[1], beforeDrag[0], ...beforeDrag.slice(2)]);
  await page.reload();
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('readlist_books_v2')).map((book) => book.id)), afterDrag);
  // Press and hold moves a title without opening Arrange mode. Run this after the
  // Arrange-mode check so the two order assertions cannot disturb each other.
  await shelfSpines.first().waitFor();
  const orderBeforePress = await page.evaluate(() => JSON.parse(localStorage.getItem('readlist_books_v2')).map((book) => book.id));
  const pressFrom = await shelfSpines.nth(0).boundingBox();
  const pressTo = await shelfSpines.nth(1).boundingBox();
  await page.mouse.move(pressFrom.x + pressFrom.width / 2, pressFrom.y + pressFrom.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(620);
  await page.mouse.move(pressTo.x + pressTo.width / 2, pressTo.y + pressTo.height / 2 + 5, { steps: 15 });
  await page.mouse.up();
  await page.waitForFunction((before) => JSON.parse(localStorage.getItem('readlist_books_v2'))[0].id === before[1], orderBeforePress);
  assert.equal(await page.getByLabel(/^Drag .+ to rearrange$/).count(), 0, 'press and hold never opens Arrange mode');
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('readlist_books_v2')).map((book) => book.id)), [orderBeforePress[1], orderBeforePress[0], ...orderBeforePress.slice(2)]);
  await page.getByLabel('List view', { exact: true }).click();
  await page.getByText('Title / creator', { exact: true }).waitFor();
  const pdf = await PDFDocument.create(); pdf.setTitle('Embedded UI title'); pdf.setAuthor('File author'); pdf.addPage();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByLabel('Import PDF or EPUB', { exact: true }).click()]);
  await chooser.setFiles({ name: 'local-test.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await page.getByPlaceholder('e.g. Fourth Wing').waitFor();
  assert.equal(await page.getByPlaceholder('e.g. Fourth Wing').inputValue(), 'Embedded UI title');
  // This context has no File System Access API, so the form must say the link is
  // session-only and will need relinking (README "File access by platform").
  await page.getByText(/cannot retain file access/i).waitFor();
  await page.getByPlaceholder('e.g. Fourth Wing').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.expo/verification/file-review.png', fullPage: true });
  await page.getByPlaceholder('e.g. Fourth Wing').fill('Edited file title');
  await page.getByText('Save', { exact: true }).click();
  await page.getByText('Add New Title', { exact: true }).waitFor({ state: 'hidden' });
  await page.reload();
  await page.getByLabel('List view', { exact: true }).click();
  await page.getByLabel('Open details for Edited file title', { exact: true }).waitFor();
  const fileRecord = await page.evaluate(() => JSON.parse(localStorage.getItem('readlist_books_v2')).find((book) => book.book === 'Edited file title'));
  assert.equal(fileRecord.pages, 1);
  assert.equal(fileRecord.author, 'File author'); assert.equal(fileRecord.attachmentName, 'local-test.pdf');
  assert.ok(fileRecord.attachmentUri.startsWith('sessionfile:'));
  const databases = await page.evaluate(() => indexedDB.databases());
  assert.equal(databases.some((db) => db.name === 'readlist-reading-files'), false);
  console.log('File import UI: picker, editable metadata and source references without file-byte storage passed.');
  console.log('App UI: adding a book, searchable custom categories, preset selection/filter persistence, shelf count and pagination passed.');

  await page.getByLabel('Add a title', { exact: true }).click();
  await page.getByPlaceholder('e.g. Fourth Wing').fill('Mourinho documentary');
  await page.getByLabel('Format / type', { exact: true }).fill('Documentary');
  await page.getByRole('button', { name: 'Documentary', exact: true }).click();
  await page.getByLabel('Status', { exact: true }).fill('Currently Watching');
  await page.getByRole('button', { name: 'Currently Watching', exact: true }).click();
  await page.getByLabel('Categories and tags', { exact: true }).fill('Football');
  await page.getByRole('button', { name: 'Football', exact: true }).click();
  await page.getByLabel('Spice not applicable', { exact: true }).click();
  await page.getByText('Save', { exact: true }).click();
  await page.getByText('Add New Title', { exact: true }).waitFor({ state: 'hidden' });
  const movie = await page.evaluate(() => JSON.parse(localStorage.getItem('readlist_books_v2')).find(book => book.book === 'Mourinho documentary'));
  assert.equal(movie.type, 'Documentary'); assert.equal(movie.status, 'Currently Watching'); assert.equal(movie.spicyLevel, 0); assert.match(movie.subgenres, /Football/);
  console.log('Movie tracking: documentary type, watching status, categories and optional spice passed.');

  await page.getByLabel('Add a title', { exact: true }).click();
  await page.getByPlaceholder('e.g. Fourth Wing').fill('Episode progress test');
  await page.getByLabel('Author / creator', { exact: true }).fill('Remove this author');
  await page.getByLabel('Author / creator', { exact: true }).press('ControlOrMeta+A');
  await page.getByLabel('Author / creator', { exact: true }).press('Delete');
  await page.getByLabel('Format / type', { exact: true }).fill('Anime Series');
  await page.getByRole('button', { name: 'Anime Series', exact: true }).click();
  await page.getByLabel('Total episodes', { exact: true }).fill('24');
  await page.getByLabel('Current episode', { exact: true }).fill('7');
  await page.getByLabel('Total episodes', { exact: true }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  await page.screenshot({ path: '.expo/verification/progress-form.png', fullPage: true });
  await page.getByText('Save', { exact: true }).click();
  await page.getByText('Add New Title', { exact: true }).waitFor({ state: 'hidden' });
  let series = await page.evaluate(() => JSON.parse(localStorage.getItem('readlist_books_v2')).find(book => book.book === 'Episode progress test'));
  assert.equal(series.author, '', 'Delete removes the author and saves an empty value');
  await page.getByText('Current episode: 7 / 24', { exact: true }).last().waitFor();
  assert.equal(series.episodes, 24); assert.equal(series.currentEpisode, 7); assert.equal(series.pages, 0);
  assert.ok(!Number.isNaN(Date.parse(series.startDate))); assert.equal(series.endDate, '');
  await page.getByLabel('Open details for Episode progress test', { exact: true }).click();
  await page.getByText('Current episode: 7 / 24', { exact: true }).last().waitFor();
  await page.getByText('Ongoing', { exact: true }).waitFor();
  await page.getByText('Completed', { exact: true }).last().click();
  series = await page.evaluate(() => JSON.parse(localStorage.getItem('readlist_books_v2')).find(book => book.book === 'Episode progress test'));
  assert.ok(!Number.isNaN(Date.parse(series.endDate)), 'Completing the series records its finish time');
  await page.reload();
  await page.getByLabel('Add a title', { exact: true }).click();
  await page.getByLabel('Dismiss title form', { exact: true }).click({ position: { x: 3, y: 3 } });
  await page.getByText('Add New Title', { exact: true }).waitFor({ state: 'hidden' });
  console.log('Progress form: timestamps, ongoing finish, multiple categories, episodes and outside dismissal passed.');

  if (process.argv[2]) {
    const fragment = await readFile(resolve(process.argv[2]), 'utf8');
    await page.setContent(fragment);
    await page.getByRole('button', { name: 'Arrange', exact: true }).click();
    const initial = await page.locator('[data-row]').evaluateAll((nodes) => nodes.map((node) => node.dataset.row));
    const handle = await page.locator('[data-action="drag"]').first().boundingBox();
    const target = await page.locator('[data-row]').nth(2).boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + 40, target.y + target.height / 2, { steps: 15 });
    await page.mouse.up();
    const after = await page.locator('[data-row]').evaluateAll((nodes) => nodes.map((node) => node.dataset.row));
    assert.deepEqual(after, [initial[1], initial[2], initial[0]]);
    // Outside drops and cancellation must preserve order.
    const nextHandle = await page.locator('[data-action="drag"]').first().boundingBox();
    await page.mouse.move(nextHandle.x + 10, nextHandle.y + 10); await page.mouse.down();
    await page.mouse.move(nextHandle.x - 80, nextHandle.y - 80); await page.mouse.up();
    assert.equal(await page.locator('[data-dragging="true"]').count(), 0);
    assert.deepEqual(await page.locator('[data-row]').evaluateAll((nodes) => nodes.map((node) => node.dataset.row)), after);
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: /Book or story/ }).click();
    await page.locator('#rl-title').fill('Preview test story');
    await page.getByLabel('Search or add a category', { exact: true }).fill('Custom category');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Remove Custom category', exact: true }).count(), 1);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 1100 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await page.screenshot({ path: resolve(process.argv[2], '..', 'readlist-form-verified.png'), fullPage: true });
    console.log('Preview UI: drag insertion, outside drop cancellation, category creation and 320/390px layout passed.');
  }
  // Settings: the reading default, example loading, a real backup download and a
  // restore that reads that same file back.
  await page.getByLabel('Open settings', { exact: true }).click();
  await page.getByLabel('Show reading progress by default', { exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('readlist_reader_prefs_v1') || '{}').showProgress === true);
  await page.getByText('Add example titles', { exact: true }).click();
  await page.getByText(/already in your library/).waitFor();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByText('Download backup', { exact: true }).click()]);
  const backupText = await readFile(await download.path(), 'utf8');
  const backup = JSON.parse(backupText);
  assert.equal(backup.app, 'ReadList', 'the downloaded backup identifies the app');
  assert.ok(backup.books.length > 0, 'the backup contains library records');
  assert.equal(backup.readerPreferences.showProgress, true, 'the backup carries reader preferences');
  await page.getByLabel('Backup text', { exact: true }).fill(backupText);
  await page.getByText('Check backup', { exact: true }).click();
  await page.getByText(/Backup ready to restore/).waitFor();
  await page.getByText('Merge into library', { exact: true }).click();
  await page.getByText(/restored into your library/).waitFor();
  // Workbook exchange: a real .xlsx downloads and can be read back in.
  const [workbookDownload] = await Promise.all([page.waitForEvent('download'), page.getByText('Export workbook', { exact: true }).click()]);
  const workbookBytes = await readFile(await workbookDownload.path());
  assert.equal(workbookBytes.subarray(0, 2).toString(), 'PK', 'the exported workbook is a zip archive');
  const [workbookChooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByText('Import workbook', { exact: true }).click()]);
  await workbookChooser.setFiles({ name: 'readlist.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: workbookBytes });
  await page.getByText(/books · \d+ series · \d+ movies/).waitFor();
  await page.getByText('Merge workbook', { exact: true }).click();
  await page.getByText(/imported and merged into the library/).waitFor();
  const booksAfterWorkbook = await page.evaluate(() => JSON.parse(localStorage.getItem('readlist_books_v2')));
  assert.equal(new Set(booksAfterWorkbook.map((book) => book.id)).size, booksAfterWorkbook.length, 'a workbook merge never duplicates IDs');
  await page.getByLabel('Close settings', { exact: true }).click();
  const booksAfterRestore = await page.evaluate(() => JSON.parse(localStorage.getItem('readlist_books_v2')));
  assert.equal(new Set(booksAfterRestore.map((book) => book.id)).size, booksAfterRestore.length, 'merging a backup never duplicates IDs');
  await page.getByLabel('Open library statistics', { exact: true }).click();
  await page.getByText('BY MEDIA', { exact: true }).waitFor();
  await page.getByText('PAGES · BOOKS', { exact: true }).waitFor();
  await page.getByText('EPISODES · SERIES', { exact: true }).waitFor();
  await page.screenshot({ path: '.expo/verification/insights-by-media.png' });
  await page.getByLabel('Close statistics', { exact: true }).click();
  console.log('Settings: reader default persisted, example loading stayed non-destructive, backup downloaded and restored, workbook exported and merged, insights split by media passed.');
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
