// @ts-check
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, ReduceMotion } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import BookShelfItem from './BookShelfItem';
import { THEME } from '../theme';

export default function DraggableBook({ book, enabled, pressToDrag, active, registerSlot, onStart, onDrop, onSelect }) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const dragging = useSharedValue(false);
  // In Arrange mode the handle starts a drag immediately. Outside it, a press and hold
  // does: a short touch or a swipe never activates, so taps still open details and the
  // page still scrolls.
  const gesture = usePanGesture({
    enabled: enabled || pressToDrag,
    minDistance: 3,
    // 0 means "no long-press gate", which keeps Arrange mode starting on movement.
    activateAfterLongPress: pressToDrag && !enabled ? 420 : 0,
    onActivate: () => {
      dragging.set(true);
      scheduleOnRN(onStart, book.id);
    },
    onUpdate: (event) => {
      x.set(event.translationX);
      y.set(event.translationY);
    },
    onFinalize: (event) => {
      if (dragging.get()) {
        scheduleOnRN(onDrop, book.id, event.absoluteX, event.absoluteY, event.canceled);
      }
      dragging.set(false);
      const spring = { duration: 400, dampingRatio: 0.8, reduceMotion: ReduceMotion.System };
      x.set(withSpring(0, spring));
      y.set(withSpring(0, spring));
    },
  });
  const animatedStyle = useAnimatedStyle(() => (/** @type {import('react-native').ViewStyle} */ ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }],
  })));

  return (
    <View ref={(node) => registerSlot(book.id, node)} collapsable={false} style={active && styles.active}>
      <GestureDetector gesture={gesture} touchAction={enabled ? 'none' : 'auto'}>
        <Animated.View style={animatedStyle}>
          {enabled && (
            <View accessible accessibilityLabel={`Drag ${book.book} to rearrange`} style={styles.handle}>
              <Text style={styles.handleText}>⠿</Text>
            </View>
          )}
          <View pointerEvents={enabled ? 'none' : 'auto'}>
            <BookShelfItem book={book} onPress={onSelect} disabled={enabled} />
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  active: { zIndex: 100, elevation: 20, transform: [{ scale: 1.04 }] },
  handle: { height: 48, alignItems: 'center', justifyContent: 'center' },
  handleText: { color: THEME.colors.gold, fontSize: 28 },
});
