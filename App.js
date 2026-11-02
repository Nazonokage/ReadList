import { statusDates } from './src/utils/progress';
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
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import { mergeBookOrder } from './src/utils/reorder';
import { applyPreset } from './src/utils/presets';
import { resolveOnboardingMode } from './src/utils/onboarding';

import { THEME } from './src/theme';
import {
  initDatabase,
  fetchBooks,
  addBook,
  updateBook,
  deleteBook,
  reorderBooks,
  fetchLibraryPresets,
  saveLibraryPreset,
  fetchOnboardingComplete,
  setOnboardingComplete,
  seedSampleLibrary
} from './src/database';
import DraggableShelf from './src/components/DraggableShelf';
import BookListRow from './src/components/BookListRow';
import { pickDocument, persistDocument, removeDocument } from './src/services/documents';
import FilterPills from './src/components/FilterPills';
import BookDetailModal from './src/components/BookDetailModal';
import AddBookModal from './src/components/AddBookModal';
import LibraryStatsModal from './src/components/LibraryStatsModal';
import PresetManagerModal from './src/components/PresetManagerModal';
import OnboardingModal from './src/components/OnboardingModal';
import SettingsModal from './src/components/SettingsModal';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState([]);
  // The first-run guide is reopened from Help too, so it owns a session counter:
  // each opening remounts the modal and starts it from the right step.
  const [guide, setGuide] = useState({ visible: false, firstRun: false, session: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('SHELF'); // 'SHELF' | 'LIST'
  const [pickingFile, setPickingFile] = useState(false);
  const pickLock = useRef(false);
  const [reorderBusy, setReorderBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const reorderLock = useRef(false);
  const [presets, setPresets] = useState([]);
  const [activePresetId, setActivePresetId] = useState(null);
  const [presetModalVisible, setPresetModalVisible] = useState(false);
  const activePreset = presets.find((preset) => preset.id === activePresetId);

  // Modals state
  const [selectedBook, setSelectedBook] = useState(null);
  const [bookToEdit, setBookToEdit] = useState(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  // The settings sheet is remounted on each opening, so a stale status message or
  // pasted backup never survives into the next visit.
  const [settingsSession, setSettingsSession] = useState(0);

  // FAB Animated scale
  const [fabAnim] = useState(() => new Animated.Value(1));

  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    setLoading(true);
    try {
      const data = await initDatabase();
      setBooks(data);
      setPresets(await fetchLibraryPresets());
      const completed = await fetchOnboardingComplete();
      const mode = resolveOnboardingMode({ completed, librarySize: data.length });
      if (mode !== 'done') {
        setGuide({ visible: true, firstRun: mode === 'first-run', session: 1 });
      }
    } catch (err) {
      console.error('Error loading library:', err);
    } finally {
      setLoading(false);
    }
  };

  const openGuide = (firstRun = false) => {
    setGuide((current) => ({ visible: true, firstRun, session: current.session + 1 }));
  };

  const closeGuide = () => {
    setGuide((current) => ({ ...current, visible: false }));
  };

  // The guide returns false when the chosen library could not be created, so it
  // stays open instead of closing over a failed seed.
  const handleChooseLibrary = async (choice) => {
    if (choice !== 'sample') return true;
    try {
      const samples = await seedSampleLibrary();
      setBooks(samples);
      return true;
    } catch (error) {
      Alert.alert('Sample titles not added', error.message || 'Your library was left unchanged.');
      return false;
    }
  };

  const handleFinishGuide = async () => {
    closeGuide();
    try {
      await setOnboardingComplete(true);
    } catch (error) {
      console.warn('Could not record the guide as seen:', error);
    }
  };

  const handleSelectBook = (book) => {
    setSelectedBook(book);
  };

  const handleSaveBook = async (bookData) => {
    const { attachmentDraft, ...record } = bookData;
    let copied = null;
    let savedRecord = record;
    try {
      if (attachmentDraft) { copied = await persistDocument(attachmentDraft); Object.assign(record, copied); }
      if (record.id) await updateBook(record.id, record);
      else savedRecord = await addBook(record);
    } catch (error) {
      if (copied) await removeDocument(copied.attachmentUri).catch(() => {});
      throw error;
    }
    try {
      setBooks(await fetchBooks());
    } catch (error) {
      // The write already committed: do not invite a retry that duplicates it.
      setBooks((previous) => record.id ? previous.map((book) => book.id === record.id ? savedRecord : book) : [savedRecord, ...previous]);
      console.warn('Library refresh failed after saving:', error);
    }
    if (selectedBook && selectedBook.id === savedRecord.id) {
      setSelectedBook(savedRecord);
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
    if (reorderLock.current) return;
    reorderLock.current = true;
    setReorderBusy(true);
    const previous = books;
    try {
      const completeOrder = mergeBookOrder(books, reorderedBooks);
      setBooks(completeOrder);
      const saved = await reorderBooks(completeOrder);
      setBooks([...saved]);
    } catch (error) {
      setBooks(previous);
      Alert.alert('Order not saved', 'Your previous order has been restored. Please try again.');
      console.error('Error saving library order:', error);
    } finally {
      reorderLock.current = false;
      setReorderBusy(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    const book = books.find((b) => b.id === id);
    if (!book) return;
    const updatedBook = statusDates(book, status, book.status);
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

  // Filter & Search computation
  const filteredBooks = applyPreset(books, activePreset)
    .filter((b) => {
      // Search query matches title, author, or subgenres
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        (b.book && b.book.toLowerCase().includes(query)) ||
        (b.author && b.author.toLowerCase().includes(query)) ||
        (b.subgenres && b.subgenres.toLowerCase().includes(query)) ||
        (b.type && b.type.toLowerCase().includes(query)) ||
        (b.notes && b.notes.toLowerCase().includes(query));

      if (!matchesSearch) return false;

      // Filter pill logic
      if (activeFilter === 'ALL' || activeFilter === 'RECENT') return true;
      if (activeFilter === 'Currently Reading') return ['Currently Reading', 'Currently Watching'].includes(b.status);
      if (activeFilter === 'Want to Read') return ['Want to Read', 'Want to Watch'].includes(b.status);
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

  const handlePickFile = async () => {
    if (pickLock.current) return;
    pickLock.current = true; setPickingFile(true);
    try {
      const picked = await pickDocument();
      if (!picked) return;
      const { warning, ...metadata } = picked.metadata;
      setBookToEdit({ ...metadata, attachmentDraft: picked.asset, fileNote: warning });
      setAddModalVisible(true);
    } catch (error) { Alert.alert('File not added', error.message || 'Please choose the file again.'); }
    finally { pickLock.current = false; setPickingFile(false); }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="light-content" backgroundColor={THEME.colors.bg} />

        {/* Top Header Bar */}
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.appTitle}>ReadList</Text>
            <Text style={styles.appSubtitle}>Books, anime & movies</Text>
          </View>

          <View style={styles.headerIconsRow}>
            {/* Help / replay the guide */}
            <TouchableOpacity
              onPress={() => {
                try { Haptics.selectionAsync(); } catch (_) {}
                openGuide(false);
              }}
              style={styles.headerIconBtn}
              accessibilityRole="button"
              accessibilityLabel="Open the quick guide"
            >
              <Ionicons name="help-circle-outline" size={20} color={THEME.colors.textPrimary} />
            </TouchableOpacity>

            {/* Stats Button */}
            <TouchableOpacity
              onPress={() => {
                try { Haptics.selectionAsync(); } catch (_) {}
                setStatsModalVisible(true);
              }}
              style={styles.headerIconBtn}
              accessibilityRole="button"
              accessibilityLabel="Open library statistics"
            >
              <Ionicons name="bar-chart-outline" size={20} color={THEME.colors.gold} />
            </TouchableOpacity>

            {/* Settings: reader defaults, shelves, backups and example data */}
            <TouchableOpacity
              onPress={() => {
                try { Haptics.selectionAsync(); } catch (_) {}
                setSettingsSession((session) => session + 1);
                setSettingsVisible(true);
              }}
              style={styles.headerIconBtn}
              accessibilityRole="button"
              accessibilityLabel="Open settings"
            >
              <Ionicons name="settings-outline" size={20} color={THEME.colors.textPrimary} />
            </TouchableOpacity>

          </View>
        </View>

        {/* Search Bar with Spring Touch Clear */}
        <View style={styles.searchBarContainer}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={THEME.colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search titles, creators, categories..."
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
        <View style={styles.layoutControls}>
          <View style={styles.layoutOptions}>
            {['LIST', 'SHELF'].map((mode) => <TouchableOpacity key={mode} accessibilityRole="button" accessibilityState={{ selected: viewMode === mode }} accessibilityLabel={mode === 'LIST' ? 'List view' : 'Shelf view'} onPress={() => setViewMode(mode)} style={[styles.layoutOption, viewMode === mode && styles.layoutSelected]}><Text style={styles.presetText}>{mode === 'LIST' ? 'List' : 'Shelves'}</Text></TouchableOpacity>)}
          </View>
          <TouchableOpacity onPress={handlePickFile} disabled={pickingFile} accessibilityLabel="Import PDF or EPUB" style={styles.openFileButton}><Ionicons name="folder-open-outline" size={16} color={THEME.colors.goldLight} /><Text style={styles.presetText}>{pickingFile ? 'Reading…' : 'Open PDF / EPUB'}</Text></TouchableOpacity>
        </View>
        <FilterPills
          activeFilter={activeFilter}
          onSelectFilter={setActiveFilter}
        />
        <View style={styles.presetBar}>
          <TouchableOpacity onPress={() => setPresetModalVisible(true)} style={styles.presetControl} accessibilityLabel="Choose or create a library preset">
            <Ionicons name="bookmark-outline" size={16} color={THEME.colors.goldLight} />
            <Text numberOfLines={1} style={styles.presetText}>{activePreset?.name || 'Full library · Presets'}</Text>
            <Ionicons name="chevron-down" size={14} color={THEME.colors.textSecondary} />
          </TouchableOpacity>
          {activePreset && <TouchableOpacity onPress={() => setActivePresetId(null)} style={styles.presetControl} accessibilityLabel="Clear preset"><Text style={styles.presetText}>Clear</Text></TouchableOpacity>}
        </View>

        {/* Main Content Area */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={THEME.colors.gold} />
            <Text style={styles.loadingText}>Opening library shelves...</Text>
          </View>
        ) : filteredBooks.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="book-outline" size={54} color={THEME.colors.textTertiary} />
            <Text style={styles.emptyTitle}>{searchQuery || activeFilter !== 'ALL' || activePreset ? 'No matching titles' : 'Your library is empty'}</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? `Nothing here matches "${searchQuery}". Clear the search or add the title you have in mind.`
                : activeFilter !== 'ALL' || activePreset
                  ? 'No titles match the current filter or preset. Choose a different one to see your library.'
                  : 'Add the first book, manga, anime, movie or series you want to keep track of.'}
            </Text>
            <TouchableOpacity onPress={handleOpenAddModal} style={styles.emptyAddBtn} accessibilityRole="button" accessibilityLabel="Add a title">
              <Text style={styles.emptyAddBtnText}>+ Add a title</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openGuide(false)} style={styles.emptyGuideBtn} accessibilityRole="button">
              <Text style={styles.emptyGuideText}>Show the quick guide</Text>
            </TouchableOpacity>
          </View>
        ) : viewMode === 'SHELF' ? (
          /* Realistic 3D Bookshelf View with Drag & Drop */
          <ScrollView
            scrollEnabled={!dragging}
            removeClippedSubviews={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.shelfScrollContent}
          >
            <DraggableShelf
              books={filteredBooks}
              onReorder={handleReorder}
              onSelectBook={handleSelectBook}
              onDragStateChange={setDragging}
              reorderDisabled={reorderBusy || !!searchQuery.trim() || activeFilter !== 'ALL' || !!activePreset}
            />
          </ScrollView>
        ) : (
          /* Curated Catalog Cards View */
          <FlatList
            data={filteredBooks}
            keyExtractor={(item) => String(item.id)}
            ListHeaderComponent={<View style={styles.listHeading}><Text style={[styles.listHeadingText, { flex: 1 }]}>Title / creator</Text><Text style={[styles.listHeadingText, { width: 96 }]}>Status / format</Text></View>}
            renderItem={({ item, index }) => (
              <BookListRow book={item} index={index} onPress={handleSelectBook} />
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
            accessibilityRole="button"
            accessibilityLabel="Add a title"
          >
            <Ionicons name="add" size={28} color="#18171C" />
            <Text style={styles.emptyAddBtnText}>Add</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Modals */}
        <PresetManagerModal
          visible={presetModalVisible}
          books={books}
          presets={presets}
          onClose={() => setPresetModalVisible(false)}
          onApply={(id) => { setActivePresetId(id); setSearchQuery(''); setActiveFilter('ALL'); setViewMode('LIST'); }}
          onSave={async (preset) => {
            const saved = await saveLibraryPreset(preset);
            setPresets(await fetchLibraryPresets());
            setActivePresetId(saved.id);
            setSearchQuery(''); setActiveFilter('ALL'); setViewMode('LIST');
          }}
        />
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
          onRead={(book) => { setSelectedBook(null); router.push({ pathname: '/reader', params: { id: String(book.id) } }); }}
        />

        <AddBookModal
          library={books}
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

        <OnboardingModal
          key={guide.session}
          visible={guide.visible}
          firstRun={guide.firstRun}
          onChooseLibrary={handleChooseLibrary}
          onFinish={handleFinishGuide}
        />

        <SettingsModal
          key={settingsSession}
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
          onOpenGuide={() => { setSettingsVisible(false); openGuide(false); }}
          onLibraryChanged={async () => {
            setBooks(await fetchBooks());
            setPresets(await fetchLibraryPresets());
          }}
        />
      </SafeAreaView>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  layoutControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  layoutOptions: { flexDirection: 'row', backgroundColor: THEME.colors.bgCard, borderRadius: 10, padding: 3 },
  layoutOption: { minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  layoutSelected: { backgroundColor: THEME.colors.bgHighlight },
  openFileButton: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', minHeight: 48, flexShrink: 1 },
  listHeading: { flexDirection: 'row', paddingVertical: 8, paddingLeft: 58, paddingRight: 12, borderBottomWidth: 1, borderColor: THEME.colors.border },
  listHeadingText: { color: THEME.colors.textSecondary, fontSize: 11 },
  presetBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  presetControl: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 8, maxWidth: '85%' },
  presetText: { color: THEME.colors.goldLight, fontSize: 13, flexShrink: 1 },
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
  emptyGuideBtn: {
    marginTop: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyGuideText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.goldLight
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
    width: 104,
    flexDirection: 'row',
    gap: 4,
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
