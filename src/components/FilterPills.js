import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { THEME } from '../theme';

const FILTERS = [
  { key: 'ALL', label: 'All Library' },
  { key: 'RECENT', label: '⚡ Recently Added' },
  { key: 'Currently Reading', label: '📖 Reading / Watching' },
  { key: 'Owned / Downloaded', label: '📥 Owned / Downloaded' },
  { key: 'Upcoming', label: '⏳ Upcoming' },
  { key: 'Completed', label: '✓ Completed' },
  { key: 'Want to Read', label: '★ Wishlist' },
  { key: 'SPICY', label: '🌶️ Extra Spicy' },
  { key: 'TOP_RATED', label: '⭐ 5-Stars' }
];

export default function FilterPills({ activeFilter, onSelectFilter }) {
  const handlePress = (key) => {
    try {
      Haptics.selectionAsync();
    } catch (_) {}
    onSelectFilter(key);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {FILTERS.map((item) => {
          const isActive = activeFilter === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => handlePress(item.key)}
              activeOpacity={0.7}
              style={[
                styles.pill,
                isActive ? styles.pillActive : styles.pillInactive
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  isActive ? styles.pillTextActive : styles.pillTextInactive
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1
  },
  pillActive: {
    backgroundColor: THEME.colors.gold,
    borderColor: THEME.colors.goldLight,
    ...THEME.shadows.glowGold
  },
  pillInactive: {
    backgroundColor: THEME.colors.bgCard,
    borderColor: THEME.colors.border
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2
  },
  pillTextActive: {
    color: '#18171C'
  },
  pillTextInactive: {
    color: THEME.colors.textSecondary
  }
});
