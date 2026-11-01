import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { THEME } from '../theme';
import StarRating from './StarRating';
import SpicyRating from './SpicyRating';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function BookDetailModal({
  visible,
  book,
  onClose,
  onUpdateStatus,
  onUpdateRate,
  onUpdateSpicy,
  onEdit,
  onDelete
}) {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 180,
          friction: 22,
          useNativeDriver: true
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true
        })
      ]).start();
    }
  }, [visible]);

  if (!book) return null;

  const handleClose = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 200, useNativeDriver: true })
    ]).start(() => onClose());
  };

  const handleQuickStatus = (status) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}
    onUpdateStatus(book.id, status);
  };

  const handleDeletePrompt = () => {
    Alert.alert(
      "Remove Book",
      `Are you sure you want to remove "${book.book}" from your library?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (_) {}
            onDelete(book.id);
            handleClose();
          }
        }
      ]
    );
  };

  const coverColor = book.color || THEME.colors.gold;
  const subgenresList = book.subgenres
    ? book.subgenres.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const statuses = ['Want to Read', 'Owned / Downloaded', 'Currently Reading', 'Completed', 'Upcoming', 'DNF'];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={handleClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheetContainer,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          {/* Grab Handle */}
          <View style={styles.handleBar} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Header Hero Area with Book Cover Gradient */}
            <View style={styles.heroRow}>
              <View style={[styles.largeCover, { backgroundColor: coverColor }]}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.25)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.6)']}
                  style={styles.largeCoverGradient}
                >
                  <View style={styles.coverRibbon} />
                  <Ionicons name="book" size={36} color="rgba(255,255,255,0.7)" />
                  <Text numberOfLines={3} style={styles.coverLargeTitle}>
                    {book.book}
                  </Text>
                </LinearGradient>
              </View>

              <View style={styles.heroInfo}>
                <Text style={styles.recordNumber}>Record #{book.id}</Text>
                <Text style={styles.bookTitle}>{book.book}</Text>
                <Text style={styles.bookAuthor}>by {book.author}</Text>

                <View style={styles.typeBadge}>
                  <MaterialCommunityIcons name="book-open-page-variant" size={14} color={THEME.colors.gold} />
                  <Text style={styles.typeBadgeText}>{book.type || 'Standard Book'}</Text>
                </View>

                {book.pages > 0 && (
                  <Text style={styles.pagesDetail}>{book.pages} pages total</Text>
                )}
              </View>
            </View>

            {/* Quick Status Bar */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>READING STATUS</Text>
              <View style={styles.statusButtonsRow}>
                {statuses.map((st) => {
                  const isCurrent = book.status === st;
                  return (
                    <TouchableOpacity
                      key={st}
                      onPress={() => handleQuickStatus(st)}
                      style={[
                        styles.statusButton,
                        isCurrent && styles.statusButtonActive
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.statusButtonText,
                          isCurrent && styles.statusButtonTextActive
                        ]}
                      >
                        {st}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Romance Subgenres from Spreadsheet */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ROMANCE SUBGENRES</Text>
              <View style={styles.subgenreChipsWrap}>
                {subgenresList.length > 0 ? (
                  subgenresList.map((genre, idx) => (
                    <View key={idx} style={styles.subgenreTag}>
                      <Text style={styles.subgenreTagText}>{genre}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyNote}>No romance subgenres tagged yet.</Text>
                )}
              </View>
            </View>

            {/* Interactive Rating & Spicy Level Meters */}
            <View style={styles.ratingGrid}>
              {/* Star Rating Box */}
              <View style={styles.ratingBox}>
                <Text style={styles.ratingBoxTitle}>YOUR RATING</Text>
                <StarRating
                  rating={book.rate || 0}
                  onRate={(val) => onUpdateRate(book.id, val)}
                  size={24}
                  interactive
                />
                <Text style={styles.ratingScoreText}>
                  {book.rate > 0 ? `${book.rate} of 5 Stars` : 'Tap to rate'}
                </Text>
              </View>

              {/* Spicy Level Box */}
              <View style={styles.ratingBox}>
                <Text style={styles.ratingBoxTitle}>SPICY LEVEL</Text>
                <SpicyRating
                  level={book.spicyLevel || 0}
                  onSelect={(val) => onUpdateSpicy(book.id, val)}
                  size={24}
                  interactive
                  showLabel
                />
              </View>
            </View>

            {/* Reading Timeline / Dates */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>READING LOG DATES</Text>
              <View style={styles.timelineRow}>
                <View style={styles.timelineItem}>
                  <Ionicons name="calendar-outline" size={16} color={THEME.colors.textSecondary} />
                  <View style={styles.timelineTextWrap}>
                    <Text style={styles.timelineTitle}>Start Date</Text>
                    <Text style={styles.timelineValue}>{book.startDate || 'Not recorded'}</Text>
                  </View>
                </View>

                <View style={styles.timelineItem}>
                  <Ionicons name="flag-outline" size={16} color={THEME.colors.textSecondary} />
                  <View style={styles.timelineTextWrap}>
                    <Text style={styles.timelineTitle}>Finished Date</Text>
                    <Text style={styles.timelineValue}>{book.endDate || 'In progress'}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Personal Notes */}
            {book.notes ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>READER NOTES</Text>
                <View style={styles.notesBox}>
                  <Text style={styles.notesText}>{book.notes}</Text>
                </View>
              </View>
            ) : null}

            {/* Actions: Edit & Delete */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                onPress={() => {
                  handleClose();
                  setTimeout(() => onEdit(book), 250);
                }}
                style={styles.editBtn}
                activeOpacity={0.8}
              >
                <Ionicons name="create-outline" size={18} color="#18171C" />
                <Text style={styles.editBtnText}>Edit Book</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDeletePrompt}
                style={styles.deleteBtn}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={18} color={THEME.colors.statusDNF} />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)'
  },
  backdropTouch: {
    flex: 1
  },
  sheetContainer: {
    backgroundColor: THEME.colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.88,
    borderTopWidth: 1,
    borderColor: THEME.colors.borderLight,
    paddingTop: 8,
    ...THEME.shadows.cardElevated
  },
  handleBar: {
    width: 38,
    height: 4,
    backgroundColor: THEME.colors.textTertiary,
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: 8
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40
  },
  heroRow: {
    flexDirection: 'row',
    marginVertical: 14,
    alignItems: 'center'
  },
  largeCover: {
    width: 96,
    height: 142,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    ...THEME.shadows.bookSpine
  },
  largeCoverGradient: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between'
  },
  coverRibbon: {
    position: 'absolute',
    top: 0,
    left: 8,
    width: 8,
    height: 24,
    backgroundColor: THEME.colors.gold,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3
  },
  coverLargeTitle: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2
  },
  heroInfo: {
    flex: 1,
    marginLeft: 16
  },
  recordNumber: {
    fontSize: 11,
    color: THEME.colors.gold,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },
  bookTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginTop: 2,
    letterSpacing: 0.2
  },
  bookAuthor: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    marginTop: 2
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.bgHighlight,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
    gap: 4
  },
  typeBadgeText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontWeight: '600'
  },
  pagesDetail: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
    marginTop: 6
  },
  section: {
    marginTop: 18
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textTertiary,
    letterSpacing: 1,
    marginBottom: 8
  },
  statusButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: THEME.colors.bgHighlight,
    borderWidth: 1,
    borderColor: THEME.colors.border
  },
  statusButtonActive: {
    backgroundColor: THEME.colors.gold,
    borderColor: THEME.colors.goldLight
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary
  },
  statusButtonTextActive: {
    color: '#18171C',
    fontWeight: '800'
  },
  subgenreChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  subgenreTag: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14
  },
  subgenreTagText: {
    fontSize: 12,
    color: THEME.colors.goldLight,
    fontWeight: '600'
  },
  emptyNote: {
    fontSize: 13,
    color: THEME.colors.textTertiary,
    fontStyle: 'italic'
  },
  ratingGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20
  },
  ratingBox: {
    flex: 1,
    backgroundColor: THEME.colors.bgCardElevated,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border
  },
  ratingBoxTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: 8
  },
  ratingScoreText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 6
  },
  timelineRow: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.bgCardElevated,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    justifyContent: 'space-around'
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  timelineTextWrap: {
    gap: 2
  },
  timelineTitle: {
    fontSize: 11,
    color: THEME.colors.textTertiary,
    fontWeight: '600'
  },
  timelineValue: {
    fontSize: 13,
    color: THEME.colors.textPrimary,
    fontWeight: '700'
  },
  notesBox: {
    backgroundColor: THEME.colors.bgCardElevated,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border
  },
  notesText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    lineHeight: 19
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: THEME.colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...THEME.shadows.glowGold
  },
  editBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#18171C'
  },
  deleteBtn: {
    width: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
    justifyContent: 'center'
  }
});
