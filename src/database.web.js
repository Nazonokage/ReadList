import { mergeBookOrder } from './utils/reorder';
import { preparePreset } from './utils/presets';
import { validateBackup, BACKUP_APP, BACKUP_VERSION } from './utils/backup';

// Web / Localhost implementation using localStorage / in-memory store
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
    pages: 28, // 28 episodes
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

const STORAGE_KEY = 'readlist_books_v2';
const PRESET_KEY = 'readlist_user_preset_v1';
const LAYOUT_KEY = 'readlist_active_layout_v1';

function getStored() {
  if (typeof window !== 'undefined' && window.localStorage) {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { return JSON.parse(raw); } catch (_) {}
    }
  }
  return [];
}

export function saveUserPreset(orderIds) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try { window.localStorage.setItem(PRESET_KEY, JSON.stringify(orderIds)); } catch (_) {}
  }
}

export function getUserPreset() {
  if (typeof window !== 'undefined' && window.localStorage) {
    const raw = window.localStorage.getItem(PRESET_KEY);
    if (raw) {
      try { return JSON.parse(raw); } catch (_) {}
    }
  }
  return null;
}

export function saveActiveLayout(layoutKey) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try { window.localStorage.setItem(LAYOUT_KEY, layoutKey); } catch (_) {}
  }
}

export function getActiveLayout() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem(LAYOUT_KEY) || 'CUSTOM';
  }
  return 'CUSTOM';
}

function setStored(books) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(books)); } catch (_) {}
  }
  memoryStore = books;
}

let memoryStore = getStored();
let memoryPresets = [];
const memoryPositions = new Map();
let memoryOnboardingComplete = false;

export async function fetchOnboardingComplete() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem('readlist_onboarding_complete_v1') === 'true';
  }
  return memoryOnboardingComplete;
}

export async function setOnboardingComplete(complete) {
  memoryOnboardingComplete = Boolean(complete);
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('readlist_onboarding_complete_v1', String(memoryOnboardingComplete));
  }
  return memoryOnboardingComplete;
}

let memoryReaderPreferences = { showProgress: false };

export async function fetchReaderPreferences() {
  if (typeof window !== 'undefined' && window.localStorage) {
    const raw = window.localStorage.getItem('readlist_reader_prefs_v1');
    if (raw) {
      try { return { showProgress: false, ...JSON.parse(raw) }; } catch { return { showProgress: false }; }
    }
  }
  return { ...memoryReaderPreferences };
}

export async function saveReaderPreferences(input) {
  memoryReaderPreferences = { showProgress: false, ...(input || {}) };
  if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem('readlist_reader_prefs_v1', JSON.stringify(memoryReaderPreferences));
  return { ...memoryReaderPreferences };
}

export async function seedSampleLibrary() {
  if (memoryStore.length) throw new Error('Sample titles can only be loaded into an empty library.');
  const samples = INITIAL_BOOKS.map((book, index) => {
    const isSeries = /anime|series|episodes?/i.test(book.type || '') && !/movie|film/i.test(book.type || '');
    return { id: index + 1, isSample: 1, ...book, episodes: isSeries ? Number(book.episodes || book.pages) || 0 : Number(book.episodes) || 0, currentEpisode: Number(book.currentEpisode) || 0, pages: isSeries ? 0 : Number(book.pages) || 0 };
  });
  setStored(samples);
  return [...memoryStore];
}

export async function fetchReadingPosition(bookId) {
  const raw = typeof window !== 'undefined' && window.localStorage?.getItem(`readlist_position_${bookId}`);
  return raw ? JSON.parse(raw) : memoryPositions.get(String(bookId)) || null;
}

export async function saveReadingPosition(bookId, position) {
  if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(`readlist_position_${bookId}`, JSON.stringify(position));
  memoryPositions.set(String(bookId), position);
}
let memoryShelfSettings = { shelfCount: 3 };

export async function fetchShelfSettings() {
  if (typeof window !== 'undefined' && window.localStorage) {
    const raw = window.localStorage.getItem('readlist_shelf_settings_v1');
    if (raw) return JSON.parse(raw);
  }
  return memoryShelfSettings;
}

export async function saveShelfSettings(shelfCount) {
  if (!Number.isInteger(shelfCount) || shelfCount < 1 || shelfCount > 20) throw new Error('Choose between 1 and 20 shelves per page.');
  const value = { shelfCount };
  if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem('readlist_shelf_settings_v1', JSON.stringify(value));
  memoryShelfSettings = value;
  return value;
}

export async function fetchLibraryPresets() {
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = window.localStorage.getItem('readlist_library_presets_v1');
    if (stored) return JSON.parse(stored);
  }
  return [...memoryPresets];
}

export async function saveLibraryPreset(input) {
  const preset = preparePreset(input);
  const existing = await fetchLibraryPresets();
  if (existing.some((entry) => entry.id !== preset.id && entry.name.toLocaleLowerCase() === preset.name.toLocaleLowerCase())) {
    throw new Error('A preset with that name already exists.');
  }
  const next = [...existing.filter((entry) => entry.id !== preset.id), preset];
  if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem('readlist_library_presets_v1', JSON.stringify(next));
  memoryPresets = next;
  return preset;
}

export async function initDatabase() {
  const stored = getStored();
  const seen = new Set();
  let nextId = Math.max(Date.now(), ...stored.map((book) => Number(book.id) || 0)) + 1;
  let changed = false;
  memoryStore = stored.map((original) => {
    let book = original;
    if (/series|episodes?/i.test(book.type || '') && !book.episodes && book.pages > 0) {
      book = { ...book, episodes: book.pages, pages: 0 };
      changed = true;
    }
    if (book.id === undefined || book.id === null || book.id === '' || seen.has(book.id)) {
      const repaired = { ...book, id: nextId++ };
      seen.add(repaired.id);
      changed = true;
      return repaired;
    }
    seen.add(book.id);
    return book;
  });
  if (changed) setStored(memoryStore);
  return memoryStore;
}

export async function fetchBooks() {
  return [...memoryStore];
}

export async function addBook(book) {
  const color = book.color || getRandomPaletteColor();
  const id = Math.max(Date.now(), ...memoryStore.map((entry) => Number(entry.id) || 0)) + 1;
  const newBook = { ...book, id, color };
  memoryStore.unshift(newBook);
  setStored(memoryStore);
  return newBook;
}

export async function updateBook(id, book) {
  memoryStore = memoryStore.map((b) => (b.id === id ? { ...b, ...book } : b));
  setStored(memoryStore);
}

export async function deleteBook(id) {
  memoryStore = memoryStore.filter((b) => b.id !== id);
  setStored(memoryStore);
}

export async function replaceLibraryPresets(presets) {
  const list = Array.isArray(presets) ? presets : [];
  memoryPresets = [...list];
  if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem('readlist_library_presets_v1', JSON.stringify(memoryPresets));
  return [...memoryPresets];
}

// A local backup holds library records, presets, reading positions and preferences.
// Original PDF/EPUB files stay on the device and are only referenced by their URI.
export async function exportLibrary() {
  const readingPositions = {};
  if (typeof window !== 'undefined' && window.localStorage) {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && key.startsWith('readlist_position_')) {
        try { readingPositions[key.slice('readlist_position_'.length)] = JSON.parse(window.localStorage.getItem(key)); } catch { /* skip unreadable position */ }
      }
    }
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

export async function importLibrary(snapshot, { replace = false, applyPreferences = true } = {}) {
  const backup = validateBackup(snapshot);
  const byId = new Map((replace ? [] : memoryStore).map((book) => [String(book.id), book]));
  for (const record of backup.books) byId.set(String(record.id), record);
  memoryStore = [...byId.values()].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
  setStored(memoryStore);
  for (const [bookId, position] of Object.entries(backup.readingPositions)) await saveReadingPosition(bookId, position);
  if (applyPreferences) {
    await replaceLibraryPresets(backup.presets);
    await saveShelfSettings(backup.shelfSettings.shelfCount);
    await saveReaderPreferences(backup.readerPreferences);
  }
  return { imported: backup.books.length, replaced: replace, presets: applyPreferences ? backup.presets.length : 0 };
}

// Adds the example titles that are not already in the library and leaves every
// existing record untouched. Examples stay marked, so insights keep ignoring them.
export async function addSampleTitles() {
  const existing = await fetchBooks();
  const key = (book) => `${String(book.book || '').trim().toLowerCase()}|${String(book.type || '').trim().toLowerCase()}`;
  const present = new Set(existing.map(key));
  const samples = INITIAL_BOOKS.map((book, index) => {
    const isSeries = /anime|series|episodes?/i.test(book.type || '') && !/movie|film/i.test(book.type || '');
    return { ...book, id: index + 1, isSample: 1, episodes: isSeries ? Number(book.episodes || book.pages) || 0 : Number(book.episodes) || 0, currentEpisode: Number(book.currentEpisode) || 0, pages: isSeries ? 0 : Number(book.pages) || 0 };
  }).filter((sample) => !present.has(key(sample)));
  if (!samples.length) return { added: 0, total: existing.length };
  for (const sample of samples) await addBook(sample);
  return { added: samples.length, total: memoryStore.length };
}

export async function resetToDefault() {
  const fresh = INITIAL_BOOKS.map((b, i) => ({ id: i + 1, isSample: 1, ...b }));
  setStored(fresh);
  return fresh;
}

export async function reorderBooks(newBooksList) {
  const ordered = mergeBookOrder(memoryStore, newBooksList);
  // Let storage errors reach the screen so it can restore the old order.
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ordered));
  }
  memoryStore = ordered;
  return memoryStore;
}

export const BOOK_COLORS = [
  '#B91C1C', '#C2410C', '#B45309', '#047857', '#0E7490',
  '#1D4ED8', '#6D28D9', '#BE185D', '#374151', '#4338CA'
];

export function getRandomPaletteColor() {
  return BOOK_COLORS[Math.floor(Math.random() * BOOK_COLORS.length)];
}
