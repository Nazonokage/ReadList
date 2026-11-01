import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StatusBar,
  Animated,
  ActivityIndicator
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { THEME } from './src/theme';
import {
  initDatabase,
  fetchBooks,
  addBook,
  updateBook,
  deleteBook,
  reorderBooks,
  getUserPreset,
  resetToDefault
} from './src/database';
import BookShelfItem from './src/components/BookShelfItem';
import DraggableShelf from './src/components/DraggableShelf';
import BookCard from './src/components/BookCard';
import FilterPills from './src/components/FilterPills';
import BookDetailModal from './src/components/BookDetailModal';
import AddBookModal from './src/components/AddBookModal';
import LibraryStatsModal from './src/components/LibraryStatsModal';
import CsvManagerModal from './src/components/CsvManagerModal';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('SHELF'); // 'SHELF' | 'LIST'

  // Modals state
  const [selectedBook, setSelectedBook] = useState(null);
  const [bookToEdit, setBookToEdit] = useState(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [csvModalVisible, setCsvModalVisible] = useState(false);

  // FAB Animated scale
  const fabAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    setLoading(true);
    try {
      const data = await initDatabase();
      const presetIds = getUserPreset();
      if (presetIds && Array.isArray(presetIds)) {
        const sorted = [...data].sort((a, b) => {
          const idxA = presetIds.indexOf(a.id);
          const idxB = presetIds.indexOf(b.id);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return 0;
        });
        setBooks(sorted);
      } else {
        setBooks(data);
      }
    } catch (err) {
      console.error('Error loading library:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBook = (book) => {
    setSelectedBook(book);
  };

  const handleSaveBook = async (bookData) => {
    if (bookData.id) {
      await updateBook(bookData.id, bookData);
    } else {
      await addBook(bookData);
    }
    const updated = await fetchBooks();
    setBooks(updated);
    if (selectedBook && selectedBook.id === bookData.id) {
      setSelectedBook(bookData);
    }
  };

  const handleDeleteBook = async (id) => {
    await deleteBook(id);
    const updated = await fetchBooks();
    setBooks(updated);
    if (selectedBook && selectedBook.id === id) {
      setSelectedBook(null);
    }
  };

  const handleReorder = async (reorderedBooks) => {
    setBooks(reorderedBooks);
    await reorderBooks(reorderedBooks);
  };

  const handleUpdateStatus = async (id, status) => {
    const book = books.find((b) => b.id === id);
    if (!book) return;
    const updatedBook = { ...book, status };
    await updateBook(id, updatedBook);
    const updatedList = await fetchBooks();
    setBooks(updatedList);
    setSelectedBook(updatedBook);
  };

  const handleUpdateRate = async (id, rate) => {
    const book = books.find((b) => b.id === id);
    if (!book) return;
    const updatedBook = { ...book, rate };
    await updateBook(id, updatedBook);
    const updatedList = await fetchBooks();
    setBooks(updatedList);
    setSelectedBook(updatedBook);
  };

  const handleUpdateSpicy = async (id, spicyLevel) => {
    const book = books.find((b) => b.id === id);
    if (!book) return;
    const updatedBook = { ...book, spicyLevel };
    await updateBook(id, updatedBook);
    const updatedList = await fetchBooks();
    setBooks(updatedList);
    setSelectedBook(updatedBook);
  };

  const handleResetDefault = async () => {
    const data = await resetToDefault();
    setBooks(data);
  };

  const handleImportCsv = async (importedBooks) => {
    for (const b of importedBooks) {
      await addBook(b);
    }
    const updated = await fetchBooks();
    setBooks(updated);
  };

  // Filter & Search computation
  const filteredBooks = books
    .filter((b) => {
      // Search query matches title, author, or subgenres
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        (b.book && b.book.toLowerCase().includes(query)) ||
        (b.author && b.author.toLowerCase().includes(query)) ||
        (b.subgenres && b.subgenres.toLowerCase().includes(query));

      if (!matchesSearch) return false;

      // Filter pill logic
      if (activeFilter === 'ALL' || activeFilter === 'RECENT') return true;
      if (activeFilter === 'SPICY') return b.spicyLevel >= 4;
      if (activeFilter === 'TOP_RATED') return b.rate === 5;
      return b.status === activeFilter;
    })
    .sort((a, b) => {
      if (activeFilter === 'RECENT') return (b.id || 0) - (a.id || 0);
      return 0;
    });

  // Group books into shelves of 4 books each for realistic 3D Bookshelf view
  const shelves = [];
  const BOOKS_PER_SHELF = 4;
  for (let i = 0; i < filteredBooks.length; i += BOOKS_PER_SHELF) {
    shelves.push(filteredBooks.slice(i, i + BOOKS_PER_SHELF));
  }

  const handleFabPressIn = () => {
    Animated.spring(fabAnim, {
      toValue: 0.88,
      friction: 5,
      useNativeDriver: true
    }).start();
  };

  const handleFabPressOut = () => {
    Animated.spring(fabAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true
    }).start();
  };

  const handleOpenAddModal = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}
    setBookToEdit(null);
    setAddModalVisible(true);
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="light-content" backgroundColor={THEME.colors.bg} />

        {/* Top Header Bar */}
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.appTitle}>ReadList</Text>
            <Text style={styles.appSubtitle}>Personal Library & Book Log</Text>
          </View>

          <View style={styles.headerIconsRow}>
            {/* Stats Button */}
            <TouchableOpacity
              onPress={() => {
                try { Haptics.selectionAsync(); } catch (_) {}
                setStatsModalVisible(true);
              }}
              style={styles.headerIconBtn}
            >
              <Ionicons name="bar-chart-outline" size={20} color={THEME.colors.gold} />
            </TouchableOpacity>

            {/* CSV / Database Manager */}
            <TouchableOpacity
              onPress={() => {
                try { Haptics.selectionAsync(); } catch (_) {}
                setCsvModalVisible(true);
              }}
              style={styles.headerIconBtn}
            >
              <Ionicons name="document-text-outline" size={20} color={THEME.colors.textPrimary} />
            </TouchableOpacity>

            {/* Toggle View Mode: Shelf vs List */}
            <TouchableOpacity
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
                setViewMode(viewMode === 'SHELF' ? 'LIST' : 'SHELF');
              }}
              style={styles.viewModeToggle}
            >
              <Ionicons
                name={viewMode === 'SHELF' ? 'list-outline' : 'grid-outline'}
                size={18}
                color="#18171C"
              />
              <Text style={styles.viewModeText}>
                {viewMode === 'SHELF' ? 'Catalog' : 'Shelves'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar with Spring Touch Clear */}
        <View style={styles.searchBarContainer}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={THEME.colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search books, authors, or romance tropes..."
              placeholderTextColor={THEME.colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClearBtn}>
                <Ionicons name="close-circle" size={16} color={THEME.colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter Pills Carousel */}
        <FilterPills
          activeFilter={activeFilter}
          onSelectFilter={setActiveFilter}
        />

        {/* Main Content Area */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={THEME.colors.gold} />
            <Text style={styles.loadingText}>Opening library shelves...</Text>
          </View>
        ) : filteredBooks.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="book-outline" size={54} color={THEME.colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Books Found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? `No books matching "${searchQuery}"`
                : 'Your library shelf is empty. Add your first read!'}
            </Text>
            <TouchableOpacity onPress={handleOpenAddModal} style={styles.emptyAddBtn}>
              <Text style={styles.emptyAddBtnText}>+ Add Book</Text>
            </TouchableOpacity>
          </View>
        ) : viewMode === 'SHELF' ? (
          /* Realistic 3D Bookshelf View with Drag & Drop */
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.shelfScrollContent}
          >
            <DraggableShelf
              books={filteredBooks}
              onReorder={handleReorder}
              onSelectBook={handleSelectBook}
            />
          </ScrollView>
        ) : (
          /* Curated Catalog Cards View */
          <FlatList
            data={filteredBooks}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <BookCard book={item} onPress={handleSelectBook} />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Floating Action Button (Add Book) with Tactile Spring */}
        <Animated.View style={[styles.fabWrapper, { transform: [{ scale: fabAnim }] }]}>
          <TouchableOpacity
            activeOpacity={1}
            onPressIn={handleFabPressIn}
            onPressOut={handleFabPressOut}
            onPress={handleOpenAddModal}
            style={styles.fabButton}
          >
            <Ionicons name="add" size={28} color="#18171C" />
          </TouchableOpacity>
        </Animated.View>

        {/* Modals */}
        <BookDetailModal
          visible={!!selectedBook}
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          onUpdateStatus={handleUpdateStatus}
          onUpdateRate={handleUpdateRate}
          onUpdateSpicy={handleUpdateSpicy}
          onEdit={(book) => {
            setBookToEdit(book);
            setAddModalVisible(true);
          }}
          onDelete={handleDeleteBook}
        />

        <AddBookModal
          visible={addModalVisible}
          bookToEdit={bookToEdit}
          onClose={() => {
            setAddModalVisible(false);
            setBookToEdit(null);
          }}
          onSave={handleSaveBook}
        />

        <LibraryStatsModal
          visible={statsModalVisible}
          books={books}
          onClose={() => setStatsModalVisible(false)}
        />

        <CsvManagerModal
          visible={csvModalVisible}
          books={books}
          onClose={() => setCsvModalVisible(false)}
          onResetDefault={handleResetDefault}
          onImportCsv={handleImportCsv}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.bg
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
    letterSpacing: -0.5
  },
  appSubtitle: {
    fontSize: 12,
    color: THEME.colors.goldLight,
    fontWeight: '600',
    letterSpacing: 0.3
  },
  headerIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border
  },
  viewModeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    gap: 5,
    ...THEME.shadows.glowGold
  },
  viewModeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#18171C'
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    marginBottom: 4
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: THEME.colors.border
  },
  searchInput: {
    flex: 1,
    color: THEME.colors.textPrimary,
    fontSize: 13,
    marginLeft: 8
  },
  searchClearBtn: {
    padding: 4
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32
  },
  loadingText: {
    marginTop: 12,
    color: THEME.colors.textSecondary,
    fontSize: 14
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginTop: 14
  },
  emptySubtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18
  },
  emptyAddBtn: {
    marginTop: 18,
    backgroundColor: THEME.colors.gold,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20
  },
  emptyAddBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#18171C'
  },
  shelfScrollContent: {
    paddingVertical: 14,
    paddingBottom: 90
  },
  shelfUnit: {
    marginBottom: 20
  },
  booksOnShelfRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  shelfLedgeContainer: {
    width: '100%'
  },
  shelfWoodTop: {
    height: 12,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3
  },
  shelfWoodFace: {
    height: 16,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    justifyContent: 'flex-end'
  },
  shelfDepthTrim: {
    height: 2,
    backgroundColor: 'rgba(0,0,0,0.6)'
  },
  listContent: {
    paddingVertical: 8,
    paddingBottom: 90
  },
  fabWrapper: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    ...THEME.shadows.glowGold
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8
  }
});
