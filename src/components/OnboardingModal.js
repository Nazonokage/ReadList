import React, { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { THEME } from '../theme';

const STEPS = [
  {
    title: 'Start with a title',
    body: 'Tap Add to save a book, anime, movie, or series. Add just a title to begin; creator, categories, ratings, and notes are optional.',
  },
  {
    title: 'Find it again',
    body: 'Search by title or creator, filter by reading or watching status, and switch between Shelves and List. Presets save a useful set of filters.',
  },
  {
    title: 'Pick up where you left off',
    body: 'Update a title’s status or current episode from its details. For a PDF or EPUB, attach the original file to a title and ReadList can save your reading position.',
  },
];

// The guide keeps its own step while it is open. It is remounted with a new key
// every time it opens, so the step and the library choice start from the props
// instead of being reset by an effect.
export default function OnboardingModal({ visible, firstRun, onChooseLibrary, onFinish }) {
  const [step, setStep] = useState(firstRun ? 0 : 1);
  const [choiceMade, setChoiceMade] = useState(!firstRun);
  const [busy, setBusy] = useState(false);

  const chooseLibrary = async (choice) => {
    if (busy) return;
    setBusy(true);
    try {
      const accepted = await onChooseLibrary(choice);
      if (accepted) {
        setChoiceMade(true);
        setStep(1);
      }
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (firstRun && !choiceMade) {
        const accepted = await onChooseLibrary('empty');
        if (!accepted) return;
        setChoiceMade(true);
      }
      await onFinish();
    } finally {
      setBusy(false);
    }
  };

  const skip = finish;

  const isWelcome = firstRun && step === 0;
  const current = STEPS[Math.max(0, step - 1)];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={skip}>
      <View style={styles.overlay}>
        <View accessibilityViewIsModal style={styles.card}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.eyebrow}>{isWelcome ? 'GETTING STARTED' : `QUICK TOUR · ${step} OF ${STEPS.length}`}</Text>
            <Text style={styles.title}>{isWelcome ? 'Welcome to ReadList' : current.title}</Text>
            <Text style={styles.body}>{isWelcome
              ? 'Keep the books, shows, and films you enjoy together. Start with your own library or explore a few clearly marked examples.'
              : current.body}</Text>

            {isWelcome ? (
              <View style={styles.choices}>
                <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => chooseLibrary('sample')} style={styles.primaryButton}>
                  {busy ? <ActivityIndicator color="#18171C" /> : <Text style={styles.primaryText}>Use sample titles</Text>}
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => chooseLibrary('empty')} style={styles.secondaryButton}>
                  <Text style={styles.secondaryText}>Start with an empty library</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.stepDots} accessibilityLabel={`Tour step ${step} of ${STEPS.length}`}>
                {STEPS.map((item, index) => <View key={item.title} style={[styles.dot, step === index + 1 && styles.activeDot]} />)}
              </View>
            )}
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={skip} style={styles.footerButton}>
              <Text style={styles.skipText}>{isWelcome ? 'Skip guide' : 'Skip'}</Text>
            </TouchableOpacity>
            {!isWelcome && <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={step < STEPS.length ? () => setStep(step + 1) : finish} style={styles.nextButton}>
              <Text style={styles.primaryText}>{step < STEPS.length ? 'Next' : 'Finish guide'}</Text>
            </TouchableOpacity>}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.72)' },
  card: { width: '100%', maxWidth: 480, maxHeight: '88%', borderRadius: 20, borderWidth: 1, borderColor: THEME.colors.borderLight, backgroundColor: THEME.colors.bgCard, overflow: 'hidden' },
  content: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 16 },
  eyebrow: { color: THEME.colors.goldLight, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 12 },
  title: { color: THEME.colors.textPrimary, fontSize: 24, lineHeight: 31, fontWeight: '800' },
  body: { color: THEME.colors.textSecondary, fontSize: 15, lineHeight: 23, marginTop: 12 },
  choices: { gap: 10, marginTop: 24 },
  primaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: THEME.colors.gold, paddingHorizontal: 16 },
  primaryText: { color: '#18171C', fontSize: 15, fontWeight: '800' },
  secondaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: THEME.colors.borderLight, paddingHorizontal: 16 },
  secondaryText: { color: THEME.colors.textPrimary, fontSize: 15, fontWeight: '700' },
  stepDots: { flexDirection: 'row', gap: 8, marginTop: 26 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: THEME.colors.borderLight },
  activeDot: { width: 22, backgroundColor: THEME.colors.gold },
  footer: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: THEME.colors.border, paddingHorizontal: 18 },
  footerButton: { minHeight: 48, minWidth: 72, justifyContent: 'center' },
  skipText: { color: THEME.colors.textSecondary, fontSize: 14, fontWeight: '600' },
  nextButton: { minHeight: 44, minWidth: 112, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: THEME.colors.gold, paddingHorizontal: 14 },
});
