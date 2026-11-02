import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { THEME } from '../theme';

export default function StarRating({ rating = 0, onRate, size = 18, interactive = false }) {
  const [scaleAnims] = useState(() => [1, 2, 3, 4, 5].map(() => new Animated.Value(1)));

  const handlePress = (value) => {
    if (!interactive || !onRate) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}

    Animated.sequence([
      Animated.spring(scaleAnims[value - 1], {
        toValue: 1.45,
        friction: 4,
        useNativeDriver: true
      }),
      Animated.spring(scaleAnims[value - 1], {
        toValue: 1,
        friction: 6,
        useNativeDriver: true
      })
    ]).start();

    onRate(value);
  };

  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = star <= rating;
        return (
          <TouchableOpacity
            key={star}
            disabled={!interactive}
            onPress={() => handlePress(star)}
            activeOpacity={0.7}
            style={styles.touchArea}
          >
            <Animated.View style={{ transform: [{ scale: scaleAnims[star - 1] }] }}>
              <Ionicons
                name={isFilled ? 'star' : 'star-outline'}
                size={size}
                color={isFilled ? THEME.colors.gold : THEME.colors.textTertiary}
              />
            </Animated.View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3
  },
  touchArea: {
    padding: 2
  }
});
