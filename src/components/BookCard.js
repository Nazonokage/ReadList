import { episodeLabel } from '../utils/progress';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { THEME } from '../theme';
import StarRating from './StarRating';
import SpicyRating from './SpicyRating';

export default function BookCard({ book, onPress }) {
  const [scaleAnim] = useState(() => new Animated.Value(1));

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.965,
      friction: 7,
      tension: 300,
      useNativeDriver: true
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 200,
      useNativeDriver: true
    }).start();
  };

  const handlePress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    onPress(book);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Currently Watching':
      case 'Currently Reading':
        return { bg: 'rgba(59, 130, 246, 0.15)', text: '#60A5FA', icon: 'book-open-outline' };
      case 'Completed':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#34D399', icon: 'checkmark-circle-outline' };
      case 'Owned / Downloaded':
        return { bg: 'rgba(139, 92, 246, 0.15)', text: '#A78BFA', icon: 'download-outline' };
      case 'Upcoming':
        return { bg: 'rgba(236, 72, 153, 0.15)', text: '#F472B6', icon: 'calendar-outline' };
      case 'Want to Watch':
      case 'Want to Read':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#FBBF24', icon: 'bookmark-outline' };
      default:
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#F87171', icon: 'close-circle-outline' };
    }
  };

  const badge = getStatusBadge(book.status);
  const coverColor = book.color || THEME.colors.gold;

  // Split subgenres
  const subgenresList = book.subgenres
    ? book.subgenres.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <Animated.View style={[styles.cardWrapper, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={styles.cardContainer}
      >
        {/* Left: Book Cover Miniature with depth spine */}
        <View style={styles.coverShadowContainer}>
          <View style={[styles.coverContainer, { backgroundColor: coverColor }]}>
            <LinearGradient
              colors={['rgba(255,255,255,0.25)', 'transparent', 'rgba(0,0,0,0.5)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.coverGradient}
            >
              {/* Spine highlight line */}
              <View style={styles.spineHighlight} />
              <Ionicons name="book" size={24} color="rgba(255,255,255,0.7)" />
              <Text numberOfLines={2} style={styles.coverTitleText}>
                {book.book}
              </Text>
            </LinearGradient>
          </View>
        </View>

        {/* Right: Book Details & Meta */}
        <View style={styles.contentContainer}>
          {/* Header Row: Status & Type */}
          <View style={styles.headerRow}>
            <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.statusText, { color: badge.text }]}>
                {book.status}
              </Text>
            </View>
            <Text style={styles.typeText}>{book.type || 'Unspecified'}</Text>
          </View>

          {/* Book Title & Author */}
          <Text numberOfLines={1} style={styles.titleText}>
            {book.book}
          </Text>
          {!!book.author && <Text numberOfLines={1} style={styles.authorText}>
            by {book.author}
          </Text>}

          {!!episodeLabel(book) && <Text style={{ color: THEME.colors.goldLight, fontSize: 12, marginVertical: 6 }}>{episodeLabel(book)}</Text>}
          {/* Subgenre Chips */}
          {subgenresList.length > 0 && (
            <View style={styles.subgenresRow}>
              {subgenresList.slice(0, 2).map((sub, i) => (
                <View key={i} style={styles.subgenreChip}>
                  <Text numberOfLines={1} style={styles.subgenreChipText}>
                    {sub}
                  </Text>
                </View>
              ))}
              {subgenresList.length > 2 && (
                <View style={styles.subgenreChipMore}>
                  <Text style={styles.subgenreChipMoreText}>+{subgenresList.length - 2}</Text>
                </View>
              )}
            </View>
          )}

          {/* Bottom Ratings: Stars & Spicy Chili */}
          <View style={styles.footerRow}>
            <View style={styles.ratingsCluster}>
              <StarRating rating={book.rate || 0} size={14} />
              {book.spicyLevel > 0 && (
                <View style={styles.spicyCluster}>
                  <Text style={styles.spicyDot}>•</Text>
                  <SpicyRating level={book.spicyLevel} size={14} />
                </View>
              )}
            </View>

            {book.pages > 0 && (
              <Text style={styles.pagesText}>{book.pages} pages</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    marginHorizontal: 16,
    marginVertical: 6
  },
  cardContainer: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.cardElevated
  },
  coverShadowContainer: {
    ...THEME.shadows.bookSpine
  },
  coverContainer: {
    width: 74,
    height: 108,
    borderRadius: 7,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)'
  },
  coverGradient: {
    flex: 1,
    padding: 6,
    justifyContent: 'space-between'
  },
  spineHighlight: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.18)'
  },
  coverTitleText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2
  },
  contentContainer: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'space-between'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase'
  },
  typeText: {
    fontSize: 11,
    color: THEME.colors.textTertiary,
    fontWeight: '500'
  },
  titleText: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginTop: 4,
    letterSpacing: 0.2
  },
  authorText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginBottom: 6
  },
  subgenresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 5,
    marginBottom: 6
  },
  subgenreChip: {
    backgroundColor: THEME.colors.bgHighlight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: 120
  },
  subgenreChipText: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    fontWeight: '500'
  },
  subgenreChipMore: {
    backgroundColor: THEME.colors.bgHighlight,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4
  },
  subgenreChipMoreText: {
    fontSize: 9,
    color: THEME.colors.textTertiary,
    fontWeight: '600'
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2
  },
  ratingsCluster: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  spicyCluster: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  spicyDot: {
    color: THEME.colors.textTertiary,
    marginHorizontal: 4,
    fontSize: 12
  },
  pagesText: {
    fontSize: 11,
    color: THEME.colors.textTertiary,
    fontWeight: '500'
  }
});
