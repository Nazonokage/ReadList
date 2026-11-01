import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { THEME } from '../theme';

export default function SpicyRating({ level = 0, onSelect, size = 18, interactive = false, showLabel = false }) {
  const scaleAnims = useRef([1, 2, 3, 4, 5].map(() => new Animated.Value(1))).current;

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

    onSelect(value);
  };

  const labels = ['Mild / Sweet', 'Warm Chemistry', 'Steamy', 'Scorching', 'Maximum Spice 🔥'];

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {[1, 2, 3, 4, 5].map((pepper) => {
          const isActive = pepper <= level;
          return (
            <TouchableOpacity
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
      {showLabel && level > 0 && (
        <Text style={styles.levelText}>{labels[level - 1] || `${level}/5 Spice`}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
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
