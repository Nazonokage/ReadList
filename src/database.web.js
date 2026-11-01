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
  return INITIAL_BOOKS.map((b, i) => ({ id: i + 1, ...b }));
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

export async function initDatabase() {
  memoryStore = getStored();
  return memoryStore;
}

export async function fetchBooks() {
  return [...memoryStore];
}

export async function addBook(book) {
  const color = book.color || getRandomPaletteColor();
  const newBook = { id: Date.now() + Math.floor(Math.random() * 1000), ...book, color };
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

export async function resetToDefault() {
  const fresh = INITIAL_BOOKS.map((b, i) => ({ id: i + 1, ...b }));
  setStored(fresh);
  return fresh;
}

export async function reorderBooks(newBooksList) {
  memoryStore = [...newBooksList];
  setStored(memoryStore);
  saveUserPreset(newBooksList.map((b) => b.id));
  return memoryStore;
}

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
  '#B91C1C', '#C2410C', '#B45309', '#047857', '#0E7490',
  '#1D4ED8', '#6D28D9', '#BE185D', '#374151', '#4338CA'
];

export function getRandomPaletteColor() {
  return BOOK_COLORS[Math.floor(Math.random() * BOOK_COLORS.length)];
}
