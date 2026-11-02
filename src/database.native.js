import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { mergeBookOrder } from './utils/reorder';
import { preparePreset } from './utils/presets';
import { validateBackup, BACKUP_APP, BACKUP_VERSION } from './utils/backup';

const DB_NAME = 'readlist_books.db';

// Initial sample dataset matching exact spreadsheet columns
export const INITIAL_BOOKS = [
  {
    book: "Fourth Wing",
    author: "Rebecca Yarros",
    status: "Completed",
    subgenres: "Fantasy Romance, Enemies to Lovers, Dragons",
    type: "Hardcover",
    pages: 528,
    startDate: "2024-01-10",
    endDate: "2024-01-18",
    rate: 5,
    spicyLevel: 4,
    color: "#D97706",
    notes: "Incredible pacing, deadly dragon riders, scorching chemistry between Violet & Xaden."
  },
  {
    book: "A Court of Thorns and Roses",
    author: "Sarah J. Maas",
    status: "Completed",
    subgenres: "High Fantasy Romance, Slow Burn, Fae",
    type: "Paperback",
    pages: 416,
    startDate: "2024-02-01",
    endDate: "2024-02-09",
    rate: 5,
    spicyLevel: 3,
    color: "#059669",
    notes: "Retelling of Beauty and the Beast with deadly Prythian court politics."
  },
  {
    book: "The Love Hypothesis",
    author: "Ali Hazelwood",
    status: "Completed",
    subgenres: "Contemporary, Fake Dating, STEM Romance",
    type: "Kindle / E-book",
    pages: 384,
    startDate: "2024-03-05",
    endDate: "2024-03-08",
    rate: 4,
    spicyLevel: 3,
    color: "#2563EB",
    notes: "Adorably awkward Olive and grumpy Dr. Adam Carlsen. Cozy academic vibes."
  },
  {
    book: "Twisted Love",
    author: "Ana Huang",
    status: "Completed",
    subgenres: "Dark Romance, Brother's Best Friend, Grumpy x Sunshine",
    type: "Paperback",
    pages: 358,
    startDate: "2024-04-12",
    endDate: "2024-04-17",
    rate: 4,
    spicyLevel: 5,
    color: "#DC2626",
    notes: "Alex Volkov is ruthless and protective. Maximum tension and high heat."
  },
  {
    book: "Book Lovers",
    author: "Emily Henry",
    status: "Currently Reading",
    subgenres: "Romantic Comedy, Enemies to Lovers, Small Town",
    type: "Paperback",
    pages: 400,
    startDate: "2024-05-01",
    endDate: "",
    rate: 5,
    spicyLevel: 3,
    color: "#DB2777",
    notes: "Nora Stephens literary agent in Sunshine Falls. Witty dialogue and sharp banter."
  },
  {
    book: "Iron Flame",
    author: "Rebecca Yarros",
    status: "Currently Reading",
    subgenres: "Fantasy Romance, Military, Dragons",
    type: "Hardcover",
    pages: 640,
    startDate: "2024-05-10",
    endDate: "",
    rate: 4,
    spicyLevel: 4,
    color: "#7C3AED",
    notes: "Second year at Basgiath War College. High stakes, rebellion brewing."
  },
  {
    book: "Haunting Adeline",
    author: "H. D. Carlton",
    status: "Want to Read",
    subgenres: "Dark Romance, Morally Gray, Gothic Stalker",
    type: "Kindle / E-book",
    pages: 588,
    startDate: "",
    endDate: "",
    rate: 0,
    spicyLevel: 5,
    color: "#18181B",
    notes: "Check trigger warnings. Notorious Cat and Mouse duet."
  },
  {
    book: "Icebreaker",
    author: "Hannah Grace",
    status: "Want to Read",
    subgenres: "Sports Romance, College, Figure Skating x Hockey",
    type: "Audiobook",
    pages: 448,
    startDate: "",
    endDate: "",
    rate: 0,
    spicyLevel: 4,
    color: "#0891B2",
    notes: "Maple Hills rink sharing drama. Nate and Anastasia chemistry."
  },
  {
    book: "Frieren: Beyond Journey's End",
    author: "Kanehito Yamada",
    status: "Owned / Downloaded",
    subgenres: "Fantasy, Slice of Life, Adventure",
    type: "Anime Series",
    pages: 28,
    startDate: "",
    endDate: "",
    rate: 5,
    spicyLevel: 1,
    color: "#0D9488",
    notes: "Downloaded batch on device ready to watch. Masterpiece melancholic pacing."
  },
  {
    book: "Onyx Storm (Empyrean #3)",
    author: "Rebecca Yarros",
    status: "Upcoming",
    subgenres: "Fantasy Romance, Dragons, War",
    type: "Hardcover",
    pages: 600,
    startDate: "",
    endDate: "",
    rate: 0,
    spicyLevel: 4,
    color: "#4F46E5",
    notes: "Anticipated release upcoming! Pre-ordered."
  }
];

// Fallback in-memory store for Web or SQLite failure; sample titles are an explicit first-run choice.
let memoryStore = [];
let dbInstance = null;

export async function getDb() {
  if (Platform.OS === 'web') return null;
  if (!dbInstance) {
    try {
      dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
    } catch (err) {
      console.warn("SQLite open failed, using memory store fallback:", err);
      return null;
    }
  }
  return dbInstance;
}

export async function initDatabase() {
  const db = await getDb();
  if (!db) return memoryStore;

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book TEXT NOT NULL,
      author TEXT NOT NULL,
      status TEXT NOT NULL,
      subgenres TEXT,
      type TEXT,
      pages INTEGER DEFAULT 0,
      startDate TEXT,
      endDate TEXT,
      rate INTEGER DEFAULT 0,
      spicyLevel INTEGER DEFAULT 0,
      color TEXT,
      notes TEXT,
      sortOrder INTEGER,
      isSample INTEGER DEFAULT 0
    );
  `);

  const columns = await db.getAllAsync('PRAGMA table_info(books)');
  if (!columns.some((column) => column.name === 'sortOrder')) {
    await db.execAsync('ALTER TABLE books ADD COLUMN sortOrder INTEGER');
  }
  for (const name of ['attachmentUri', 'attachmentName', 'attachmentFormat']) {
    if (!columns.some((column) => column.name === name)) await db.execAsync(`ALTER TABLE books ADD COLUMN ${name} TEXT`);
  }
  for (const name of ['episodes', 'currentEpisode']) {
    if (!columns.some((column) => column.name === name)) await db.execAsync(`ALTER TABLE books ADD COLUMN ${name} INTEGER DEFAULT 0`);
  }
  // Example titles stay identifiable so insights can leave them out of the user's totals.
  if (!columns.some((column) => column.name === 'isSample')) await db.execAsync('ALTER TABLE books ADD COLUMN isSample INTEGER DEFAULT 0');
  await db.execAsync('CREATE TABLE IF NOT EXISTS library_presets (id TEXT PRIMARY KEY, name TEXT NOT NULL, data TEXT NOT NULL)');
  await db.execAsync('CREATE TABLE IF NOT EXISTS library_preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  await db.execAsync('CREATE TABLE IF NOT EXISTS reading_positions (bookId TEXT PRIMARY KEY, data TEXT NOT NULL)');

  // Sample records are added only after an explicit first-run choice.
  // Earlier series records stored their total episodes in the pages field.
  await db.execAsync("UPDATE books SET episodes=pages, pages=0 WHERE episodes=0 AND pages>0 AND (LOWER(type) LIKE '%series%' OR LOWER(type) LIKE '%episode%')");
  return fetchBooks();
}

export async function fetchBooks() {
  const db = await getDb();
  if (!db) return memoryStore;

  const rows = await db.getAllAsync('SELECT * FROM books ORDER BY sortOrder IS NOT NULL, sortOrder ASC, id DESC');
  return rows;
}

let memoryOnboardingComplete = false;

export async function fetchOnboardingComplete() {
  const db = await getDb();
  if (!db) return memoryOnboardingComplete;
  const row = await db.getFirstAsync('SELECT value FROM library_preferences WHERE key = ?', ['onboarding_complete']);
  if (!row) return false;
  try { return Boolean(JSON.parse(row.value)); } catch { return false; }
}

export async function setOnboardingComplete(complete) {
  memoryOnboardingComplete = Boolean(complete);
  const db = await getDb();
  if (db) await db.runAsync('INSERT INTO library_preferences (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', ['onboarding_complete', JSON.stringify(memoryOnboardingComplete)]);
  return memoryOnboardingComplete;
}

let memoryReaderPreferences = { showProgress: false };

export async function fetchReaderPreferences() {
  const db = await getDb();
  if (!db) return { ...memoryReaderPreferences };
  const row = await db.getFirstAsync('SELECT value FROM library_preferences WHERE key = ?', ['reader_preferences']);
  if (!row) return { ...memoryReaderPreferences };
  try { return { showProgress: false, ...JSON.parse(row.value) }; } catch { return { showProgress: false }; }
}

export async function saveReaderPreferences(input) {
  memoryReaderPreferences = { showProgress: false, ...(input || {}) };
  const db = await getDb();
  if (db) await db.runAsync('INSERT INTO library_preferences (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', ['reader_preferences', JSON.stringify(memoryReaderPreferences)]);
  return { ...memoryReaderPreferences };
}

function sampleRecord(book, index) {
  const isSeries = /anime|series|episodes?/i.test(book.type || '') && !/movie|film/i.test(book.type || '');
  return { ...book, id: index + 1, isSample: 1, pages: isSeries ? 0 : Number(book.pages) || 0, episodes: isSeries ? Number(book.episodes || book.pages) || 0 : Number(book.episodes) || 0, currentEpisode: Number(book.currentEpisode) || 0 };
}

export async function seedSampleLibrary() {
  const existing = await fetchBooks();
  if (existing.length) throw new Error('Sample titles can only be loaded into an empty library.');
  const samples = INITIAL_BOOKS.map(sampleRecord);
  const db = await getDb();
  if (!db) {
    memoryStore = samples;
    return [...memoryStore];
  }
  await db.withTransactionAsync(async () => {
    const countRow = await db.getFirstAsync('SELECT COUNT(*) as count FROM books');
    if (countRow?.count) throw new Error('Sample titles can only be loaded into an empty library.');
    for (const sample of samples) await addBook(sample);
  });
  return fetchBooks();
}

// Adds the example titles that are not already in the library and leaves every
// existing record untouched. Examples stay marked, so insights keep ignoring them.
export async function addSampleTitles() {
  const existing = await fetchBooks();
  const key = (book) => `${String(book.book || '').trim().toLowerCase()}|${String(book.type || '').trim().toLowerCase()}`;
  const present = new Set(existing.map(key));
  const samples = INITIAL_BOOKS.map(sampleRecord).filter((sample) => !present.has(key(sample)));
  if (!samples.length) return { added: 0, total: existing.length };
  const db = await getDb();
  if (!db) {
    for (const sample of samples) await addBook(sample);
    return { added: samples.length, total: memoryStore.length };
  }
  await db.withTransactionAsync(async () => { for (const sample of samples) await addBook(sample); });
  return { added: samples.length, total: (await fetchBooks()).length };
}

let memoryPresets = [];
const memoryPositions = new Map();

export async function fetchReadingPosition(bookId) {
  const db = await getDb();
  if (!db) return memoryPositions.get(String(bookId)) || null;
  const row = await db.getFirstAsync('SELECT data FROM reading_positions WHERE bookId = ?', [String(bookId)]);
  return row ? JSON.parse(row.data) : null;
}

export async function saveReadingPosition(bookId, position) {
  const db = await getDb();
  if (!db) { memoryPositions.set(String(bookId), position); return; }
  await db.runAsync('INSERT INTO reading_positions (bookId, data) VALUES (?, ?) ON CONFLICT(bookId) DO UPDATE SET data=excluded.data', [String(bookId), JSON.stringify(position)]);
}
let memoryShelfSettings = { shelfCount: 3 };

export async function fetchShelfSettings() {
  const db = await getDb();
  if (!db) return memoryShelfSettings;
  const row = await db.getFirstAsync('SELECT value FROM library_preferences WHERE key = ?', ['shelves']);
  return row ? JSON.parse(row.value) : { shelfCount: 3 };
}

export async function saveShelfSettings(shelfCount) {
  if (!Number.isInteger(shelfCount) || shelfCount < 1 || shelfCount > 20) throw new Error('Choose between 1 and 20 shelves per page.');
  const value = { shelfCount };
  const db = await getDb();
  if (db) await db.runAsync('INSERT INTO library_preferences (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', ['shelves', JSON.stringify(value)]);
  memoryShelfSettings = value;
  return value;
}

export async function fetchLibraryPresets() {
  const db = await getDb();
  if (!db) return [...memoryPresets];
  const rows = await db.getAllAsync('SELECT data FROM library_presets ORDER BY name COLLATE NOCASE');
  return rows.map((row) => JSON.parse(row.data));
}

export async function saveLibraryPreset(input) {
  const preset = preparePreset(input);
  const existing = await fetchLibraryPresets();
  if (existing.some((entry) => entry.id !== preset.id && entry.name.toLocaleLowerCase() === preset.name.toLocaleLowerCase())) {
    throw new Error('A preset with that name already exists.');
  }
  const db = await getDb();
  if (db) {
    await db.runAsync('INSERT INTO library_presets (id, name, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, data=excluded.data', [preset.id, preset.name, JSON.stringify(preset)]);
  } else {
    memoryPresets = [...existing.filter((entry) => entry.id !== preset.id), preset];
  }
  return preset;
}

export async function addBook(book) {
  const db = await getDb();
  const color = book.color || getRandomPaletteColor();
  if (!db) {
    const newBook = { ...book, id: Math.max(Date.now(), ...memoryStore.map((entry) => Number(entry.id) || 0)) + 1, color };
    memoryStore.unshift(newBook);
    return newBook;
  }

  const result = await db.runAsync(
    `INSERT INTO books (book, author, status, subgenres, type, pages, startDate, endDate, rate, spicyLevel, color, notes, attachmentUri, attachmentName, attachmentFormat, episodes, currentEpisode, isSample)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      book.book || "Untitled title",
      book.author ?? "",
      book.status || "Want to Read",
      book.subgenres || "",
      book.type || "Paperback",
      Number(book.pages) || 0,
      book.startDate || "",
      book.endDate || "",
      Number(book.rate) || 0,
      Number(book.spicyLevel) || 0,
      color,
      book.notes || "",
      book.attachmentUri || '',
      book.attachmentName || '',
      book.attachmentFormat || '',
      Number(book.episodes) || 0,
      Number(book.currentEpisode) || 0,
      book.isSample ? 1 : 0
    ]
  );

  return { ...book, id: result.lastInsertRowId, color };
}

export async function updateBook(id, book) {
  const db = await getDb();
  if (!db) {
    memoryStore = memoryStore.map((b) => (b.id === id ? { ...b, ...book } : b));
    return;
  }

  await db.runAsync(
    `UPDATE books SET book=?, author=?, status=?, subgenres=?, type=?, pages=?, startDate=?, endDate=?, rate=?, spicyLevel=?, color=?, notes=?, attachmentUri=?, attachmentName=?, attachmentFormat=?, episodes=?, currentEpisode=?, isSample=?
     WHERE id=?`,
    [
      book.book,
      book.author,
      book.status,
      book.subgenres,
      book.type,
      Number(book.pages) || 0,
      book.startDate || "",
      book.endDate || "",
      Number(book.rate) || 0,
      Number(book.spicyLevel) || 0,
      book.color,
      book.notes || "",
      book.attachmentUri || '',
      book.attachmentName || '',
      book.attachmentFormat || '',
      Number(book.episodes) || 0,
      Number(book.currentEpisode) || 0,
      book.isSample ? 1 : 0,
      id
    ]
  );
}

export async function deleteBook(id) {
  const db = await getDb();
  if (!db) {
    memoryStore = memoryStore.filter((b) => b.id !== id);
    return;
  }
  await db.runAsync('DELETE FROM books WHERE id = ?', [id]);
}

let userPresetCache = null;
let activeLayoutCache = 'CUSTOM';

export function saveUserPreset(orderIds) {
  userPresetCache = orderIds;
}

export function getUserPreset() {
  return userPresetCache;
}

export function saveActiveLayout(layoutKey) {
  activeLayoutCache = layoutKey;
}

export function getActiveLayout() {
  return activeLayoutCache;
}

export async function reorderBooks(newBooksList) {
  const db = await getDb();
  if (!db) {
    memoryStore = mergeBookOrder(memoryStore, newBooksList);
    saveUserPreset(memoryStore.map((book) => book.id));
    return memoryStore;
  }

  // Only order columns change: IDs and every other field remain intact.
  let ordered;
  await db.withTransactionAsync(async () => {
    ordered = mergeBookOrder(await fetchBooks(), newBooksList);
    for (let index = 0; index < ordered.length; index++) {
      await db.runAsync('UPDATE books SET sortOrder = ? WHERE id = ?', [index, ordered[index].id]);
    }
  });
  saveUserPreset(ordered.map((book) => book.id));
  return ordered;
}

export async function resetToDefault() {
  const db = await getDb();
  if (!db) {
    memoryStore = [...INITIAL_BOOKS.map((b, idx) => ({ id: idx + 1, isSample: 1, ...b }))];
    return memoryStore;
  }

  await db.runAsync('DELETE FROM books');
  for (const b of INITIAL_BOOKS) {
    await db.runAsync(
      `INSERT INTO books (book, author, status, subgenres, type, pages, startDate, endDate, rate, spicyLevel, color, notes, isSample)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [b.book, b.author, b.status, b.subgenres, b.type, b.pages, b.startDate, b.endDate, b.rate, b.spicyLevel, b.color, b.notes]
    );
  }
  // Earlier series records stored their total episodes in the pages field.
  await db.execAsync("UPDATE books SET episodes=pages, pages=0 WHERE episodes=0 AND pages>0 AND (LOWER(type) LIKE '%series%' OR LOWER(type) LIKE '%episode%')");
  return fetchBooks();
}

export async function replaceLibraryPresets(presets) {
  const list = Array.isArray(presets) ? presets : [];
  const db = await getDb();
  if (!db) { memoryPresets = [...list]; return [...list]; }
  await db.runAsync('DELETE FROM library_presets');
  for (const preset of list) {
    await db.runAsync('INSERT OR REPLACE INTO library_presets (id, name, data) VALUES (?, ?, ?)', [String(preset.id), String(preset.name), JSON.stringify(preset)]);
  }
  return [...list];
}

// A local backup holds library records, presets, reading positions and preferences.
// Original PDF/EPUB files stay on the device and are only referenced by their URI.
export async function exportLibrary() {
  const db = await getDb();
  const readingPositions = {};
  if (db) {
    const rows = await db.getAllAsync('SELECT bookId, data FROM reading_positions');
    for (const row of rows) { try { readingPositions[String(row.bookId)] = JSON.parse(row.data); } catch { /* skip unreadable position */ } }
  } else {
    for (const [bookId, position] of memoryPositions) readingPositions[bookId] = position;
  }
  return {
    app: BACKUP_APP,
    schemaVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    books: await fetchBooks(),
    presets: await fetchLibraryPresets(),
    shelfSettings: await fetchShelfSettings(),
    readerPreferences: await fetchReaderPreferences(),
    readingPositions,
  };
}

const RECORD_INSERT = `INSERT OR REPLACE INTO books (id, book, author, status, subgenres, type, pages, startDate, endDate, rate, spicyLevel, color, notes, attachmentUri, attachmentName, attachmentFormat, episodes, currentEpisode, isSample, sortOrder)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

export async function importLibrary(snapshot, { replace = false, applyPreferences = true } = {}) {
  const backup = validateBackup(snapshot);
  const db = await getDb();
  const recordValues = (record) => [record.id, record.book, record.author, record.status, record.subgenres, record.type, record.pages, record.startDate, record.endDate, record.rate, record.spicyLevel, record.color, record.notes, record.attachmentUri, record.attachmentName, record.attachmentFormat, record.episodes, record.currentEpisode, record.isSample, record.sortOrder];

  if (!db) {
    const byId = new Map((replace ? [] : memoryStore).map((book) => [String(book.id), book]));
    for (const record of backup.books) byId.set(String(record.id), record);
    memoryStore = [...byId.values()].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
  } else {
    // Records and their reading positions commit together, so a failed import
    // cannot leave a half-restored library behind.
    await db.withTransactionAsync(async () => {
      if (replace) await db.runAsync('DELETE FROM books');
      for (const record of backup.books) await db.runAsync(RECORD_INSERT, recordValues(record));
      for (const [bookId, position] of Object.entries(backup.readingPositions)) {
        await db.runAsync('INSERT INTO reading_positions (bookId, data) VALUES (?, ?) ON CONFLICT(bookId) DO UPDATE SET data=excluded.data', [String(bookId), JSON.stringify(position)]);
      }
    });
  }

  if (!db) {
    for (const [bookId, position] of Object.entries(backup.readingPositions)) memoryPositions.set(String(bookId), position);
  }
  if (applyPreferences) {
    await replaceLibraryPresets(backup.presets);
    await saveShelfSettings(backup.shelfSettings.shelfCount);
    await saveReaderPreferences(backup.readerPreferences);
  }
  return { imported: backup.books.length, replaced: replace, presets: applyPreferences ? backup.presets.length : 0 };
}

export const BOOK_COLORS = [
  '#B91C1C', // Crimson Leather
  '#C2410C', // Burnt Terracotta
  '#B45309', // Antique Gold
  '#047857', // Forest Emerald
  '#0E7490', // Deep Cyan
  '#1D4ED8', // Royal Sapphire
  '#6D28D9', // Deep Amethyst
  '#BE185D', // Velvet Rose
  '#374151', // Charcoal Slate
  '#4338CA', // Midnight Indigo
];

export function getRandomPaletteColor() {
  return BOOK_COLORS[Math.floor(Math.random() * BOOK_COLORS.length)];
}
