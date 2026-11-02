import { episodeLabel } from '../utils/progress';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { THEME } from '../theme';

export default function BookShelfItem({ book, onPress, disabled = false }) {
  const [pressAnim] = useState(() => new Animated.Value(1));
  const [liftAnim] = useState(() => new Animated.Value(0));

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(pressAnim, {
        toValue: 0.94,
        friction: 8,
        tension: 300,
        useNativeDriver: true
      }),
      Animated.spring(liftAnim, {
        toValue: -14,
        friction: 6,
        tension: 260,
        useNativeDriver: true
      })
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(pressAnim, {
        toValue: 1,
        friction: 6,
        tension: 200,
        useNativeDriver: true
      }),
      Animated.spring(liftAnim, {
        toValue: 0,
        friction: 7,
        tension: 200,
        useNativeDriver: true
      })
    ]).start();
  };

  const handlePress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    onPress(book);
  };

  // Status color pill
  const getStatusColor = (status) => {
    switch (status) {
      case 'Currently Watching':
      case 'Currently Reading': return THEME.colors.statusReading;
      case 'Completed': return THEME.colors.statusCompleted;
      case 'Owned / Downloaded': return THEME.colors.statusOwned;
      case 'Upcoming': return THEME.colors.statusUpcoming;
      case 'Want to Watch':
      case 'Want to Read': return THEME.colors.statusWant;
      default: return THEME.colors.textTertiary;
    }
  };

  const spineBaseColor = book.color || THEME.colors.gold;

  return (
    <Animated.View
      style={[
        styles.spineWrapper,
        {
          transform: [
            { scale: pressAnim },
            { translateY: liftAnim }
          ]
        }
      ]}
    >
      <TouchableOpacity
        disabled={disabled}
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`Open details for ${book.book}`}
        accessibilityHint="Press and hold to move this title"
        style={styles.touchContainer}
      >
        {/* Book Spine Outer with 3D Bevel & Texture */}
        <View style={[styles.spineBody, { backgroundColor: spineBaseColor }]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.22)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.45)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.spineGradient}
          >
            {/* Top gold foil band */}
            <View style={styles.goldBand} />

            {/* Bookmark ribbon on top edge */}
            <View style={[styles.ribbon, { backgroundColor: getStatusColor(book.status) }]} />

            {/* Vertical Book Title & Author */}
            <View style={styles.titleContainer}>
              <Text numberOfLines={2} style={styles.spineTitle}>
                {book.book}
              </Text>
              <Text numberOfLines={1} style={styles.spineAuthor}>
                {book.author}
              </Text>
            </View>

            {/* Bottom Details & Spicy Icons */}
            <View style={styles.bottomMeta}>
              {!!book.isSample && (
                <View style={styles.samplePill} accessibilityLabel="Example title">
                  <Text style={styles.sampleText}>EXAMPLE</Text>
                </View>
              )}
              {!!episodeLabel(book) && <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{episodeLabel(book, true)}</Text>}
              {book.spicyLevel > 0 && (
                <View style={styles.spicePill}>
                  <Text style={styles.spiceIcon}>🌶️ {book.spicyLevel}</Text>
                </View>
              )}
              {book.rate > 0 && (
                <View style={styles.ratePill}>
                  <Text style={styles.rateText}>★ {book.rate}</Text>
                </View>
              )}
            </View>

            {/* Bottom gold foil band */}
            <View style={[styles.goldBand, styles.goldBandBottom]} />
          </LinearGradient>
        </View>

        {/* Realistic Book Spine Bottom Shadow onto Shelf */}
        <View style={styles.baseShadow} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  spineWrapper: {
    marginHorizontal: 5,
    alignItems: 'center',
    marginBottom: 4
  },
  touchContainer: {
    alignItems: 'center'
  },
  spineBody: {
    width: 68,
    height: 220,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    ...THEME.shadows.bookSpine
  },
  spineGradient: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  goldBand: {
    width: '90%',
    height: 3,
    backgroundColor: '#FDE68A',
    borderRadius: 1,
    opacity: 0.8
  },
  goldBandBottom: {
    marginTop: 4
  },
  ribbon: {
    position: 'absolute',
    top: -2,
    right: 8,
    width: 9,
    height: 18,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10
  },
  spineTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3
  },
  spineAuthor: {
    fontSize: 10,
    fontWeight: '600',
    color: '#E4E4E7',
    textAlign: 'center',
    marginTop: 6,
    opacity: 0.9,
    letterSpacing: 0.3
  },
  bottomMeta: {
    alignItems: 'center',
    gap: 4
  },
  samplePill: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(245,189,98,0.6)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6
  },
  sampleText: {
    fontSize: 7,
    color: '#F5BD62',
    fontWeight: '800',
    letterSpacing: 0.5
  },
  spicePill: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8
  },
  spiceIcon: {
    fontSize: 9,
    color: '#FECACA',
    fontWeight: '700'
  },
  ratePill: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8
  },
  rateText: {
    fontSize: 9,
    color: '#FDE68A',
    fontWeight: '800'
  },
  baseShadow: {
    width: 60,
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 3,
    marginTop: 2
  }
});
