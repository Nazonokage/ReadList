import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableOpacity,
  ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { THEME } from '../theme';
import BookShelfItem from './BookShelfItem';
import { saveActiveLayout, getActiveLayout, saveUserPreset } from '../database';

const BOOK_WIDTH = 78;
const BOOKS_PER_SHELF = 4;

export const LAYOUT_MODES = [
  { key: 'CUSTOM', label: '⭐ My Custom Preset', subtitle: 'User-arranged layout (Default)' },
  { key: 'STATUS_SHELVES', label: '🏷️ Rows by Status', subtitle: 'Reading, Completed, Want to Read' },
  { key: 'SUBGENRE_SHELVES', label: '🌹 Rows by Subgenre', subtitle: 'Enemies to Lovers, Dark, Fantasy' },
  { key: 'RECENT', label: '⚡ Recently Added', subtitle: 'Newest books first' },
  { key: 'A_Z_TITLE', label: '🔤 Title A → Z', subtitle: 'Alphabetical order' },
  { key: 'A_Z_AUTHOR', label: '✍️ Author A → Z', subtitle: 'Grouped by writer' },
  { key: 'SPICY_HIGH', label: '🌶️ Highest Spice First', subtitle: '5-chili heat to mild' },
  { key: 'RATING_HIGH', label: '⭐ Highest Rated First', subtitle: '5-star favorites first' }
];

export default function DraggableShelf({ books, onReorder, onSelectBook }) {
  const [activeLayout, setActiveLayout] = useState('CUSTOM');
  const [reorderMode, setReorderMode] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [activeDragId, setActiveDragId] = useState(null);

  const pan = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const saved = getActiveLayout();
    if (saved) setActiveLayout(saved);
  }, []);

  const handleSelectLayout = (layoutKey) => {
    try {
      Haptics.selectionAsync();
    } catch (_) {}
    setActiveLayout(layoutKey);
    saveActiveLayout(layoutKey);
    setShowLayoutMenu(false);

    // If switching to an auto sort, we sort the books list
    let sorted = [...books];
    if (layoutKey === 'A_Z_TITLE') {
      sorted.sort((a, b) => (a.book || '').localeCompare(b.book || ''));
    } else if (layoutKey === 'A_Z_AUTHOR') {
      sorted.sort((a, b) => (a.author || '').localeCompare(b.author || ''));
    } else if (layoutKey === 'RECENT') {
      sorted.sort((a, b) => (b.id || 0) - (a.id || 0));
    } else if (layoutKey === 'SPICY_HIGH') {
      sorted.sort((a, b) => (b.spicyLevel || 0) - (a.spicyLevel || 0));
    } else if (layoutKey === 'RATING_HIGH') {
      sorted.sort((a, b) => (b.rate || 0) - (a.rate || 0));
    }
    if (layoutKey !== 'CUSTOM' && layoutKey !== 'STATUS_SHELVES' && layoutKey !== 'SUBGENRE_SHELVES') {
      onReorder(sorted);
    }
  };

  const handleSaveCurrentAsPreset = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (_) {}
    saveUserPreset(books.map((b) => b.id));
    setActiveLayout('CUSTOM');
    saveActiveLayout('CUSTOM');
  };

  // Build Shelves based on layout
  let shelfSections = [];

  if (activeLayout === 'STATUS_SHELVES') {
    const statusGroups = [
      { name: '📖 CURRENTLY READING / WATCHING', filter: 'Currently Reading' },
      { name: '📥 OWNED / DOWNLOADED (TBR)', filter: 'Owned / Downloaded' },
      { name: '✓ COMPLETED', filter: 'Completed' },
      { name: '⏳ UPCOMING / ANNOUNCED', filter: 'Upcoming' },
      { name: '★ WANT TO READ / WATCH', filter: 'Want to Read' },
      { name: 'DNF / PAUSED', filter: 'DNF' }
    ];

    statusGroups.forEach((grp) => {
      const groupBooks = books.filter((b) => b.status === grp.filter);
      if (groupBooks.length > 0) {
        for (let i = 0; i < groupBooks.length; i += BOOKS_PER_SHELF) {
          shelfSections.push({
            label: i === 0 ? grp.name : `${grp.name} (CONT.)`,
            items: groupBooks.slice(i, i + BOOKS_PER_SHELF)
          });
        }
      }
    });
  } else if (activeLayout === 'SUBGENRE_SHELVES') {
    // Collect distinct first subgenres
    const genreMap = {};
    books.forEach((b) => {
      const firstGenre = b.subgenres
        ? b.subgenres.split(',')[0].trim()
        : 'General Romance';
      if (!genreMap[firstGenre]) genreMap[firstGenre] = [];
      genreMap[firstGenre].push(b);
    });

    Object.entries(genreMap).forEach(([genreName, groupBooks]) => {
      for (let i = 0; i < groupBooks.length; i += BOOKS_PER_SHELF) {
        shelfSections.push({
          label: i === 0 ? `🌹 ${genreName.toUpperCase()}` : `🌹 ${genreName.toUpperCase()} (CONT.)`,
          items: groupBooks.slice(i, i + BOOKS_PER_SHELF)
        });
      }
    });
  } else {
    // Normal or Sorted Flat Shelves of 4 books each
    for (let i = 0; i < books.length; i += BOOKS_PER_SHELF) {
      shelfSections.push({
        label: `SHELF ${Math.floor(i / BOOKS_PER_SHELF) + 1}`,
        items: books.slice(i, i + BOOKS_PER_SHELF)
      });
    }
  }

  // Quick move handlers for accessible reordering
  const moveBook = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= books.length) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}

    const updated = [...books];
    const [movedItem] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, movedItem);
    setActiveLayout('CUSTOM');
    saveActiveLayout('CUSTOM');
    onReorder(updated);
  };

  const createPanResponder = (book, globalIndex) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => reorderMode,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return reorderMode && (Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5);
      },
      onPanResponderGrant: () => {
        setActiveDragId(book.id);
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } catch (_) {}

        pan.setValue({ x: 0, y: 0 });
        Animated.parallel([
          Animated.spring(scale, { toValue: 1.12, friction: 5, useNativeDriver: false }),
          Animated.spring(lift, { toValue: -28, friction: 5, useNativeDriver: false })
        ]).start();
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false
      }),
      onPanResponderRelease: (_, gesture) => {
        const offsetSlots = Math.round(gesture.dx / BOOK_WIDTH);
        const verticalShelfOffset = Math.round(gesture.dy / 250);
        const targetIndex = Math.max(
          0,
          Math.min(books.length - 1, globalIndex + offsetSlots + verticalShelfOffset * BOOKS_PER_SHELF)
        );

        Animated.parallel([
          Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: false }),
          Animated.spring(lift, { toValue: 0, friction: 6, useNativeDriver: false }),
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 6, useNativeDriver: false })
        ]).start(() => {
          setActiveDragId(null);
          if (targetIndex !== globalIndex) {
            moveBook(globalIndex, targetIndex);
          }
        });
      }
    });
  };

  const activeLayoutInfo = LAYOUT_MODES.find((m) => m.key === activeLayout) || LAYOUT_MODES[0];

  return (
    <View style={styles.container}>
      {/* Top Shelf Controls Bar */}
      <View style={styles.controlsBar}>
        {/* Layout Preset Dropdown Trigger */}
        <TouchableOpacity
          onPress={() => {
            try { Haptics.selectionAsync(); } catch (_) {}
            setShowLayoutMenu(!showLayoutMenu);
          }}
          style={styles.layoutPickerTrigger}
          activeOpacity={0.8}
        >
          <View style={styles.layoutIconWrap}>
            <Ionicons name="funnel-outline" size={14} color={THEME.colors.gold} />
          </View>
          <View>
            <Text style={styles.layoutLabelSmall}>SHELF AUTO-LAYOUT</Text>
            <Text numberOfLines={1} style={styles.layoutActiveText}>
              {activeLayoutInfo.label}
            </Text>
          </View>
          <Ionicons
            name={showLayoutMenu ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={THEME.colors.textSecondary}
            style={styles.dropdownChevron}
          />
        </TouchableOpacity>

        {/* Rearrange Mode Toggle */}
        <TouchableOpacity
          onPress={() => {
            try { Haptics.selectionAsync(); } catch (_) {}
            setReorderMode(!reorderMode);
          }}
          style={[styles.rearrangeBtn, reorderMode && styles.rearrangeBtnActive]}
          activeOpacity={0.8}
        >
          <Ionicons
            name={reorderMode ? 'checkmark-circle' : 'move'}
            size={16}
            color={reorderMode ? '#18171C' : THEME.colors.gold}
          />
          <Text style={[styles.rearrangeBtnText, reorderMode && styles.rearrangeBtnTextActive]}>
            {reorderMode ? 'Done' : 'Drag'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Expanded Layout Menu Card */}
      {showLayoutMenu && (
        <View style={styles.layoutMenuCard}>
          <Text style={styles.menuHeader}>CHOOSE SHELF PRESET OR AUTO-LAYOUT</Text>
          {LAYOUT_MODES.map((mode) => {
            const isSelected = activeLayout === mode.key;
            return (
              <TouchableOpacity
                key={mode.key}
                onPress={() => handleSelectLayout(mode.key)}
                style={[styles.menuItem, isSelected && styles.menuItemActive]}
                activeOpacity={0.7}
              >
                <View style={styles.menuItemTextWrap}>
                  <Text style={[styles.menuItemTitle, isSelected && styles.menuItemTitleActive]}>
                    {mode.label}
                  </Text>
                  <Text style={styles.menuItemSubtitle}>{mode.subtitle}</Text>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={18} color={THEME.colors.gold} />}
              </TouchableOpacity>
            );
          })}

          {activeLayout !== 'CUSTOM' && (
            <TouchableOpacity
              onPress={handleSaveCurrentAsPreset}
              style={styles.savePresetBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="bookmark" size={16} color="#18171C" />
              <Text style={styles.savePresetBtnText}>Save Current Order as My Default Preset</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Reorder Hint Banner */}
      {reorderMode && (
        <View style={styles.dragBanner}>
          <Ionicons name="hand-right" size={14} color={THEME.colors.gold} />
          <Text style={styles.dragBannerText}>
            Drag book spine or use ‹ › arrows to rearrange. Your custom preset is automatically saved!
          </Text>
        </View>
      )}

      {/* Categorized Wooden Shelves */}
      {shelfSections.map((shelf, shelfIdx) => (
        <View key={shelfIdx} style={styles.shelfUnit}>
          {/* Books Row */}
          <View style={styles.booksRow}>
            {shelf.items.map((book) => {
              const globalIndex = books.findIndex((b) => b.id === book.id);
              const isDragging = activeDragId === book.id;
              const panResponder = createPanResponder(book, globalIndex);

              return (
                <View key={book.id} style={styles.bookSlot}>
                  {reorderMode && (
                    <View style={styles.arrowRow}>
                      <TouchableOpacity
                        onPress={() => moveBook(globalIndex, globalIndex - 1)}
                        disabled={globalIndex === 0}
                        style={[styles.arrowBtn, globalIndex === 0 && styles.arrowBtnDisabled]}
                      >
                        <Ionicons
                          name="chevron-back"
                          size={14}
                          color={globalIndex === 0 ? THEME.colors.textTertiary : THEME.colors.gold}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => moveBook(globalIndex, globalIndex + 1)}
                        disabled={globalIndex === books.length - 1}
                        style={[styles.arrowBtn, globalIndex === books.length - 1 && styles.arrowBtnDisabled]}
                      >
                        <Ionicons
                          name="chevron-forward"
                          size={14}
                          color={globalIndex === books.length - 1 ? THEME.colors.textTertiary : THEME.colors.gold}
                        />
                      </TouchableOpacity>
                    </View>
                  )}

                  <Animated.View
                    {...panResponder.panHandlers}
                    style={[
                      styles.dragWrapper,
                      isDragging && {
                        transform: [
                          { translateX: pan.x },
                          { translateY: Animated.add(pan.y, lift) },
                          { scale: scale }
                        ],
                        zIndex: 999,
                        elevation: 20
                      }
                    ]}
                  >
                    <BookShelfItem
                      book={book}
                      onPress={() => {
                        if (!reorderMode) onSelectBook(book);
                      }}
                    />
                  </Animated.View>
                </View>
              );
            })}
          </View>

          {/* Wooden Shelf Structure with Carved Category Nameplate */}
          <View style={styles.shelfLedgeContainer}>
            <LinearGradient
              colors={['#8D6E63', '#5D4037', '#3E2723']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.shelfWoodTop}
            >
              {/* Brass / Gold Nameplate on the wood ledge */}
              <View style={styles.shelfPlacard}>
                <Text numberOfLines={1} style={styles.shelfPlacardText}>
                  {shelf.label}
                </Text>
              </View>
            </LinearGradient>
            <LinearGradient
              colors={['#271714', '#150C0A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.shelfWoodFace}
            >
              <View style={styles.shelfDepthTrim} />
            </LinearGradient>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    paddingBottom: 90
  },
  controlsBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
    alignItems: 'center'
  },
  layoutPickerTrigger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 8
  },
  layoutIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.bgHighlight,
    alignItems: 'center',
    justifyContent: 'center'
  },
  layoutLabelSmall: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.colors.textTertiary,
    letterSpacing: 0.8
  },
  layoutActiveText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.goldLight
  },
  dropdownChevron: {
    marginLeft: 'auto'
  },
  rearrangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.bgCard,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    gap: 6
  },
  rearrangeBtnActive: {
    backgroundColor: THEME.colors.gold,
    borderColor: THEME.colors.goldLight,
    ...THEME.shadows.glowGold
  },
  rearrangeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.gold
  },
  rearrangeBtnTextActive: {
    color: '#18171C',
    fontWeight: '800'
  },
  layoutMenuCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    ...THEME.shadows.cardElevated
  },
  menuHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 4
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8
  },
  menuItemActive: {
    backgroundColor: THEME.colors.bgHighlight
  },
  menuItemTextWrap: {
    flex: 1
  },
  menuItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary
  },
  menuItemTitleActive: {
    color: THEME.colors.gold
  },
  menuItemSubtitle: {
    fontSize: 11,
    color: THEME.colors.textTertiary,
    marginTop: 1
  },
  savePresetBtn: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.gold,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 6,
    ...THEME.shadows.glowGold
  },
  savePresetBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#18171C'
  },
  dragBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8
  },
  dragBannerText: {
    flex: 1,
    fontSize: 11,
    color: THEME.colors.goldLight,
    lineHeight: 15,
    fontWeight: '500'
  },
  shelfUnit: {
    marginBottom: 26
  },
  booksRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 10,
    minHeight: 230
  },
  bookSlot: {
    alignItems: 'center'
  },
  arrowRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8
  },
  arrowBtn: {
    padding: 2
  },
  arrowBtnDisabled: {
    opacity: 0.3
  },
  dragWrapper: {
    cursor: 'grab'
  },
  shelfLedgeContainer: {
    width: '100%'
  },
  shelfWoodTop: {
    height: 18,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    justifyContent: 'center',
    alignItems: 'center'
  },
  shelfPlacard: {
    backgroundColor: 'rgba(24, 23, 28, 0.85)',
    borderWidth: 1,
    borderColor: '#D4AF37',
    paddingHorizontal: 12,
    paddingVertical: 1,
    borderRadius: 3
  },
  shelfPlacardText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FDE68A',
    letterSpacing: 1.2
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
  }
});
