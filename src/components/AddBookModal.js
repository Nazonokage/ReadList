import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { THEME } from '../theme';
import { BOOK_COLORS } from '../database';
import StarRating from './StarRating';
import SpicyRating from './SpicyRating';

const POPULAR_SUBGENRES = [
  'Enemies to Lovers',
  'Slow Burn',
  'Dark Romance',
  'Fantasy Romance',
  'Fake Dating',
  'Grumpy x Sunshine',
  'Isekai / Fantasy',
  'Slice of Life',
  'Psychological',
  'Action / Shonen',
  'Romance / Shoujo',
  'Sports Romance',
  'Mafia Romance'
];

const BOOK_TYPES = [
  'Paperback',
  'Hardcover',
  'Kindle / E-book',
  'Audiobook',
  'Anime Series',
  'Manga / Light Novel',
  'Anime Movie'
];

const STATUS_OPTIONS = [
  'Want to Read',
  'Owned / Downloaded',
  'Currently Reading',
  'Completed',
  'Upcoming',
  'DNF'
];

export default function AddBookModal({ visible, bookToEdit, onClose, onSave }) {
  const [book, setBook] = useState('');
  const [author, setAuthor] = useState('');
  const [status, setStatus] = useState('Want to Read');
  const [subgenres, setSubgenres] = useState('');
  const [type, setType] = useState('Paperback');
  const [pages, setPages] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rate, setRate] = useState(0);
  const [spicyLevel, setSpicyLevel] = useState(0);
  const [color, setColor] = useState(BOOK_COLORS[0]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (bookToEdit) {
      setBook(bookToEdit.book || '');
      setAuthor(bookToEdit.author || '');
      setStatus(bookToEdit.status || 'Want to Read');
      setSubgenres(bookToEdit.subgenres || '');
      setType(bookToEdit.type || 'Paperback');
      setPages(bookToEdit.pages ? String(bookToEdit.pages) : '');
      setStartDate(bookToEdit.startDate || '');
      setEndDate(bookToEdit.endDate || '');
      setRate(bookToEdit.rate || 0);
      setSpicyLevel(bookToEdit.spicyLevel || 0);
      setColor(bookToEdit.color || BOOK_COLORS[0]);
      setNotes(bookToEdit.notes || '');
    } else {
      setBook('');
      setAuthor('');
      setStatus('Want to Read');
      setSubgenres('');
      setType('Paperback');
      setPages('');
      setStartDate('');
      setEndDate('');
      setRate(0);
      setSpicyLevel(0);
      setColor(BOOK_COLORS[Math.floor(Math.random() * BOOK_COLORS.length)]);
      setNotes('');
    }
  }, [bookToEdit, visible]);

  const toggleSubgenrePill = (genre) => {
    try {
      Haptics.selectionAsync();
    } catch (_) {}
    const current = subgenres ? subgenres.split(',').map((s) => s.trim()).filter(Boolean) : [];
    if (current.includes(genre)) {
      const updated = current.filter((g) => g !== genre);
      setSubgenres(updated.join(', '));
    } else {
      current.push(genre);
      setSubgenres(current.join(', '));
    }
  };

  const handleSave = () => {
    if (!book.trim()) {
      Alert.alert('Required Field', 'Please enter a book title.');
      return;
    }
    if (!author.trim()) {
      Alert.alert('Required Field', 'Please enter an author name.');
      return;
    }

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (_) {}

    onSave({
      id: bookToEdit ? bookToEdit.id : undefined,
      book: book.trim(),
      author: author.trim(),
      status,
      subgenres: subgenres.trim(),
      type,
      pages: Number(pages) || 0,
      startDate: startDate.trim(),
      endDate: endDate.trim(),
      rate: Number(rate) || 0,
      spicyLevel: Number(spicyLevel) || 0,
      color,
      notes: notes.trim()
    });
    onClose();
  };

  const activeSubgenresList = subgenres
    ? subgenres.split(',').map((s) => s.trim().toLowerCase())
    : [];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {bookToEdit ? 'Edit Book Record' : 'Add New Book'}
          </Text>
          <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Cover Color Selection */}
          <Text style={styles.label}>BOOK COVER / SPINE COLOR</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorRow}>
            {BOOK_COLORS.map((c, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => {
                  try { Haptics.selectionAsync(); } catch (_) {}
                  setColor(c);
                }}
                style={[
                  styles.colorCircle,
                  { backgroundColor: c },
                  color === c && styles.colorCircleActive
                ]}
              >
                {color === c && <Ionicons name="checkmark" size={16} color="#FFF" />}
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Book Title & Author */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>BOOK TITLE *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Fourth Wing"
              placeholderTextColor={THEME.colors.textTertiary}
              value={book}
              onChangeText={setBook}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>AUTHOR *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Rebecca Yarros"
              placeholderTextColor={THEME.colors.textTertiary}
              value={author}
              onChangeText={setAuthor}
            />
          </View>

          {/* Reading Status */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>STATUS</Text>
            <View style={styles.pillRow}>
              {STATUS_OPTIONS.map((st) => (
                <TouchableOpacity
                  key={st}
                  onPress={() => {
                    try { Haptics.selectionAsync(); } catch (_) {}
                    setStatus(st);
                  }}
                  style={[styles.pill, status === st && styles.pillActive]}
                >
                  <Text style={[styles.pillText, status === st && styles.pillTextActive]}>
                    {st}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Book Type */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>FORMAT / TYPE</Text>
            <View style={styles.pillRow}>
              {BOOK_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => {
                    try { Haptics.selectionAsync(); } catch (_) {}
                    setType(t);
                  }}
                  style={[styles.pill, type === t && styles.pillActive]}
                >
                  <Text style={[styles.pillText, type === t && styles.pillTextActive]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Romance Subgenres Tagging */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>ROMANCE SUBGENRES (SPREADSHEET TAGS)</Text>
            <View style={styles.subgenrePillsWrap}>
              {POPULAR_SUBGENRES.map((genre) => {
                const isSelected = activeSubgenresList.includes(genre.toLowerCase());
                return (
                  <TouchableOpacity
                    key={genre}
                    onPress={() => toggleSubgenrePill(genre)}
                    style={[styles.subgenrePill, isSelected && styles.subgenrePillActive]}
                  >
                    <Text style={[styles.subgenrePillText, isSelected && styles.subgenrePillTextActive]}>
                      {genre}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              style={[styles.textInput, styles.subgenreInput]}
              placeholder="Custom tags (comma separated: e.g. Fantasy, Fae)"
              placeholderTextColor={THEME.colors.textTertiary}
              value={subgenres}
              onChangeText={setSubgenres}
            />
          </View>

          {/* Pages & Dates */}
          <View style={styles.rowTwoCols}>
            <View style={styles.col}>
              <Text style={styles.label}>NO. OF PAGES</Text>
              <TextInput
                style={styles.textInput}
                placeholder="420"
                placeholderTextColor={THEME.colors.textTertiary}
                keyboardType="numeric"
                value={pages}
                onChangeText={setPages}
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>START DATE</Text>
              <TextInput
                style={styles.textInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={THEME.colors.textTertiary}
                value={startDate}
                onChangeText={setStartDate}
              />
            </View>
          </View>

          <View style={styles.rowTwoCols}>
            <View style={styles.col}>
              <Text style={styles.label}>END DATE</Text>
              <TextInput
                style={styles.textInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={THEME.colors.textTertiary}
                value={endDate}
                onChangeText={setEndDate}
              />
            </View>
          </View>

          {/* Ratings: Star & Spicy */}
          <View style={styles.rowTwoCols}>
            <View style={[styles.col, styles.ratingBoxContainer]}>
              <Text style={styles.label}>STAR RATING</Text>
              <StarRating rating={rate} onRate={setRate} size={22} interactive />
            </View>
            <View style={[styles.col, styles.ratingBoxContainer]}>
              <Text style={styles.label}>SPICY LEVEL (1-5)</Text>
              <SpicyRating level={spicyLevel} onSelect={setSpicyLevel} size={22} interactive />
            </View>
          </View>

          {/* Notes */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>READER NOTES</Text>
            <TextInput
              style={[styles.textInput, styles.notesInput]}
              placeholder="Memorable quotes, tropes, favorite characters..."
              placeholderTextColor={THEME.colors.textTertiary}
              multiline
              numberOfLines={4}
              value={notes}
              onChangeText={setNotes}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: 0.3
  },
  cancelBtn: {
    padding: 6
  },
  cancelBtnText: {
    color: THEME.colors.textSecondary,
    fontSize: 15
  },
  saveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: THEME.colors.gold,
    borderRadius: 8
  },
  saveBtnText: {
    color: '#18171C',
    fontSize: 14,
    fontWeight: '800'
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: 8
  },
  colorRow: {
    gap: 10,
    marginBottom: 20
  },
  colorCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent'
  },
  colorCircleActive: {
    borderColor: '#FFF',
    transform: [{ scale: 1.1 }]
  },
  inputGroup: {
    marginBottom: 18
  },
  textInput: {
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: THEME.colors.textPrimary
  },
  subgenreInput: {
    marginTop: 8,
    fontSize: 13
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: THEME.colors.bgCard,
    borderWidth: 1,
    borderColor: THEME.colors.border
  },
  pillActive: {
    backgroundColor: THEME.colors.gold,
    borderColor: THEME.colors.goldLight
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary
  },
  pillTextActive: {
    color: '#18171C',
    fontWeight: '800'
  },
  subgenrePillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  subgenrePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: THEME.colors.bgCard,
    borderWidth: 1,
    borderColor: THEME.colors.border
  },
  subgenrePillActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderColor: THEME.colors.gold
  },
  subgenrePillText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontWeight: '600'
  },
  subgenrePillTextActive: {
    color: THEME.colors.goldLight,
    fontWeight: '700'
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18
  },
  col: {
    flex: 1
  },
  ratingBoxContainer: {
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 12
  },
  notesInput: {
    height: 90,
    textAlignVertical: 'top',
    paddingTop: 10
  }
});
