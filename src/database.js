import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

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

// Fallback in-memory / storage store for Web or SQLite failure
let memoryStore = [...INITIAL_BOOKS.map((b, idx) => ({ id: idx + 1, ...b }))];
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
      notes TEXT
    );
  `);

  const countRow = await db.getFirstAsync('SELECT COUNT(*) as count FROM books');
  if (countRow && countRow.count === 0) {
    for (const b of INITIAL_BOOKS) {
      await db.runAsync(
        `INSERT INTO books (book, author, status, subgenres, type, pages, startDate, endDate, rate, spicyLevel, color, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [b.book, b.author, b.status, b.subgenres, b.type, b.pages, b.startDate, b.endDate, b.rate, b.spicyLevel, b.color, b.notes]
      );
    }
  }

  return fetchBooks();
}

export async function fetchBooks() {
  const db = await getDb();
  if (!db) return memoryStore;

  const rows = await db.getAllAsync('SELECT * FROM books ORDER BY id DESC');
  return rows;
}

export async function addBook(book) {
  const db = await getDb();
  const color = book.color || getRandomPaletteColor();
  if (!db) {
    const newBook = { id: Date.now(), ...book, color };
    memoryStore.unshift(newBook);
    return newBook;
  }

  const result = await db.runAsync(
    `INSERT INTO books (book, author, status, subgenres, type, pages, startDate, endDate, rate, spicyLevel, color, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      book.book || "Untitled Book",
      book.author || "Unknown Author",
      book.status || "Want to Read",
      book.subgenres || "",
      book.type || "Paperback",
      Number(book.pages) || 0,
      book.startDate || "",
      book.endDate || "",
      Number(book.rate) || 0,
      Number(book.spicyLevel) || 0,
      color,
      book.notes || ""
    ]
  );

  return { id: result.lastInsertRowId, ...book, color };
}

export async function updateBook(id, book) {
  const db = await getDb();
  if (!db) {
    memoryStore = memoryStore.map((b) => (b.id === id ? { ...b, ...book } : b));
    return;
  }

  await db.runAsync(
    `UPDATE books SET book=?, author=?, status=?, subgenres=?, type=?, pages=?, startDate=?, endDate=?, rate=?, spicyLevel=?, color=?, notes=?
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
  saveUserPreset(newBooksList.map((b) => b.id));
  const db = await getDb();
  if (!db) {
    memoryStore = [...newBooksList];
    return memoryStore;
  }

  await db.runAsync('DELETE FROM books');
  for (const b of newBooksList) {
    await db.runAsync(
      `INSERT INTO books (book, author, status, subgenres, type, pages, startDate, endDate, rate, spicyLevel, color, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [b.book, b.author, b.status, b.subgenres, b.type, b.pages, b.startDate, b.endDate, b.rate, b.spicyLevel, b.color, b.notes]
    );
  }
  return fetchBooks();
}

export async function resetToDefault() {
  const db = await getDb();
  if (!db) {
    memoryStore = [...INITIAL_BOOKS.map((b, idx) => ({ id: idx + 1, ...b }))];
    return memoryStore;
  }

  await db.runAsync('DELETE FROM books');
  for (const b of INITIAL_BOOKS) {
    await db.runAsync(
      `INSERT INTO books (book, author, status, subgenres, type, pages, startDate, endDate, rate, spicyLevel, color, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [b.book, b.author, b.status, b.subgenres, b.type, b.pages, b.startDate, b.endDate, b.rate, b.spicyLevel, b.color, b.notes]
    );
  }
  return fetchBooks();
}

// Export CSV representation matching exact spreadsheet format
export function booksToCsv(books) {
  const headers = ['No.', 'Book', 'Author', 'Status', 'Romance Subgenres', 'Type', 'No. of Pages', 'Start Date', 'End Date', 'Rate', 'Spicy Level'];
  const rows = books.map((b, i) => {
    return [
      i + 1,
      `"${(b.book || '').replace(/"/g, '""')}"`,
      `"${(b.author || '').replace(/"/g, '""')}"`,
      `"${b.status || ''}"`,
      `"${(b.subgenres || '').replace(/"/g, '""')}"`,
      `"${b.type || ''}"`,
      b.pages || 0,
      `"${b.startDate || ''}"`,
      `"${b.endDate || ''}"`,
      b.rate || 0,
      b.spicyLevel || 0
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
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
