import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { THEME } from '../theme';

export default function SpicyRating({ level = 0, onSelect, size = 18, interactive = false, showLabel = false }) {
  const [scaleAnims] = useState(() => [1, 2, 3, 4, 5].map(() => new Animated.Value(1)));

  const handlePress = (value) => {
    if (!interactive || !onSelect) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}

    Animated.sequence([
      Animated.spring(scaleAnims[value - 1], {
        toValue: 1.5,
        friction: 3,
        useNativeDriver: true
      }),
      Animated.spring(scaleAnims[value - 1], {
        toValue: 1,
        friction: 5,
        useNativeDriver: true
      })
    ]).start();

    onSelect(value === level ? 0 : value);
  };

  const labels = ['Mild / Sweet', 'Warm Chemistry', 'Steamy', 'Scorching', 'Maximum Spice 🔥'];

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, { flexWrap: 'wrap' }]}>
        {[1, 2, 3, 4, 5].map((pepper) => {
          const isActive = pepper <= level;
          return (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Spice level ${pepper}`}
              accessibilityState={{ selected: pepper === level }}
              key={pepper}
              disabled={!interactive}
              onPress={() => handlePress(pepper)}
              activeOpacity={0.7}
              style={styles.touchArea}
            >
              <Animated.View style={{ transform: [{ scale: scaleAnims[pepper - 1] }] }}>
                <MaterialCommunityIcons
                  name="chili-hot"
                  size={size}
                  color={isActive ? THEME.colors.spicyActive : THEME.colors.spicyInactive}
                />
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </View>
      {interactive && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Spice not applicable" onPress={() => onSelect?.(0)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: THEME.colors.textSecondary, fontSize: 12 }}>{level > 0 ? 'Clear / N/A' : 'Not applicable'}</Text></TouchableOpacity>}
      {showLabel && level > 0 && (
        <Text style={styles.levelText}>{labels[level - 1] || `${level}/5 Spice`}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 8
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2
  },
  touchArea: {
    padding: 2
  },
  levelText: {
    fontSize: 12,
    color: THEME.colors.spicyActive,
    fontWeight: '600',
    letterSpacing: 0.3
  }
});
