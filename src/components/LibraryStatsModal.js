import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../theme';

export default function LibraryStatsModal({ visible, books, onClose }) {
  if (!visible) return null;

  const totalBooks = books.length;
  const completedBooks = books.filter((b) => b.status === 'Completed');
  const readingBooks = books.filter((b) => b.status === 'Currently Reading');
  const wantBooks = books.filter((b) => b.status === 'Want to Read');

  const totalPages = books.reduce((acc, b) => acc + (Number(b.pages) || 0), 0);
  const completedPages = completedBooks.reduce((acc, b) => acc + (Number(b.pages) || 0), 0);

  const ratedBooks = books.filter((b) => b.rate > 0);
  const avgRating = ratedBooks.length
    ? (ratedBooks.reduce((acc, b) => acc + b.rate, 0) / ratedBooks.length).toFixed(1)
    : '—';

  const spicyBooks = books.filter((b) => b.spicyLevel > 0);
  const avgSpice = spicyBooks.length
    ? (spicyBooks.reduce((acc, b) => acc + b.spicyLevel, 0) / spicyBooks.length).toFixed(1)
    : '—';

  // Subgenre counts
  const genreCounts = {};
  books.forEach((b) => {
    if (b.subgenres) {
      b.subgenres.split(',').forEach((g) => {
        const clean = g.trim();
        if (clean) genreCounts[clean] = (genreCounts[clean] || 0) + 1;
      });
    }
  });

  const sortedGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Library Statistics</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close-circle" size={26} color={THEME.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Top High-level Metric Cards */}
          <View style={styles.metricGrid}>
            <View style={styles.metricCard}>
              <Ionicons name="library" size={24} color={THEME.colors.gold} />
              <Text style={styles.metricValue}>{totalBooks}</Text>
              <Text style={styles.metricLabel}>Total Books</Text>
            </View>

            <View style={styles.metricCard}>
              <Ionicons name="book" size={24} color={THEME.colors.statusCompleted} />
              <Text style={styles.metricValue}>{completedBooks.length}</Text>
              <Text style={styles.metricLabel}>Finished</Text>
            </View>

            <View style={styles.metricCard}>
              <Ionicons name="star" size={24} color={THEME.colors.gold} />
              <Text style={styles.metricValue}>{avgRating}</Text>
              <Text style={styles.metricLabel}>Avg Rating</Text>
            </View>

            <View style={styles.metricCard}>
              <MaterialCommunityIcons name="chili-hot" size={24} color={THEME.colors.spicyActive} />
              <Text style={styles.metricValue}>{avgSpice}</Text>
              <Text style={styles.metricLabel}>Avg Spice 🔥</Text>
            </View>
          </View>

          {/* Pages Read Progress */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>PAGES PROGRESS</Text>
            <View style={styles.pagesRow}>
              <Text style={styles.pagesBigNumber}>{completedPages.toLocaleString()}</Text>
              <Text style={styles.pagesTotalNumber}> / {totalPages.toLocaleString()} total pages</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: totalPages > 0 ? `${Math.min(100, (completedPages / totalPages) * 100)}%` : '0%' }
                ]}
              />
            </View>
          </View>

          {/* Reading Status Breakdown */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>SHELF BREAKDOWN</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusItem}>
                <View style={[styles.statusDot, { backgroundColor: THEME.colors.statusReading }]} />
                <Text style={styles.statusName}>Reading: {readingBooks.length}</Text>
              </View>
              <View style={styles.statusItem}>
                <View style={[styles.statusDot, { backgroundColor: THEME.colors.statusCompleted }]} />
                <Text style={styles.statusName}>Completed: {completedBooks.length}</Text>
              </View>
              <View style={styles.statusItem}>
                <View style={[styles.statusDot, { backgroundColor: THEME.colors.statusWant }]} />
                <Text style={styles.statusName}>Want: {wantBooks.length}</Text>
              </View>
            </View>
          </View>

          {/* Top Romance Subgenres */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>TOP ROMANCE SUBGENRES</Text>
            {sortedGenres.map(([genre, count], idx) => {
              const pct = totalBooks > 0 ? (count / totalBooks) * 100 : 0;
              return (
                <View key={idx} style={styles.genreBarContainer}>
                  <View style={styles.genreLabelRow}>
                    <Text style={styles.genreName}>{genre}</Text>
                    <Text style={styles.genreCount}>{count} books</Text>
                  </View>
                  <View style={styles.genreBarBg}>
                    <View style={[styles.genreBarFill, { width: `${pct}%` }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bg
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: 0.3
  },
  closeBtn: {
    padding: 2
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginTop: 6
  },
  metricLabel: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
    marginTop: 2,
    fontWeight: '600'
  },
  sectionCard: {
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 16
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: 12
  },
  pagesRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8
  },
  pagesBigNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.colors.goldLight
  },
  pagesTotalNumber: {
    fontSize: 14,
    color: THEME.colors.textTertiary,
    fontWeight: '600'
  },
  progressBarBg: {
    height: 8,
    backgroundColor: THEME.colors.bgHighlight,
    borderRadius: 4,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: THEME.colors.gold,
    borderRadius: 4
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  statusName: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '600'
  },
  genreBarContainer: {
    marginBottom: 12
  },
  genreLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  genreName: {
    fontSize: 13,
    color: THEME.colors.textPrimary,
    fontWeight: '600'
  },
  genreCount: {
    fontSize: 12,
    color: THEME.colors.gold,
    fontWeight: '700'
  },
  genreBarBg: {
    height: 6,
    backgroundColor: THEME.colors.bgHighlight,
    borderRadius: 3,
    overflow: 'hidden'
  },
  genreBarFill: {
    height: '100%',
    backgroundColor: THEME.colors.gold,
    borderRadius: 3
  }
});
