import React, { useState } from 'react';
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
import SearchableField from './SearchableField';
import { currentTimestamp, isSeries, isWatching, statusDates } from '../utils/progress';
import { pickDocument } from '../services/documents';

const POPULAR_SUBGENRES = [
  'Documentary',
  'Biography',
  'Nonfiction',
  'Football',
  'Sports',
  'History',
  'Science',
  'Technology',
  'Drama',
  'Comedy',
  'Thriller',
  'Crime',
  'Animation',
  'Family',
  'Fantasy',
  'Science fiction',
  'Mystery',
  'Adventure',
  'Horror',
  'Historical',
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
  'Anime Movie',
  'Movie',
  'Documentary',
  'TV Series',
  'Short Film',
  'PDF',
  'EPUB'
];

const STATUS_OPTIONS = [
  'Want to Read',
  'Owned / Downloaded',
  'Currently Reading',
  'Want to Watch',
  'Currently Watching',
  'Completed',
  'Upcoming',
  'DNF'
];

export default function AddBookModal(props) {
  if (!props.visible) return null;
  return <BookForm key={props.bookToEdit?.id || 'new'} {...props} />;
}

function BookForm({ visible, bookToEdit, onClose, onSave, library = [] }) {
  const [book, setBook] = useState(bookToEdit?.book || '');
  const [author, setAuthor] = useState(bookToEdit?.author || '');
  const [status, setStatus] = useState(bookToEdit?.status || 'Want to Read');
  const [subgenres, setSubgenres] = useState(bookToEdit?.subgenres || '');
  const [type, setType] = useState(bookToEdit?.type || 'Paperback');
  const [pages, setPages] = useState(bookToEdit?.pages ? String(bookToEdit.pages) : '');
  const [startDate, setStartDate] = useState(() => bookToEdit?.id ? bookToEdit.startDate || '' : currentTimestamp());
  const [episodes, setEpisodes] = useState(() => String(bookToEdit?.episodes ?? (isSeries(bookToEdit?.type) ? bookToEdit?.pages || '' : '')));
  const [currentEpisode, setCurrentEpisode] = useState(() => String(bookToEdit?.currentEpisode || ''));
  const [endDate, setEndDate] = useState(bookToEdit?.endDate || '');
  const [rate, setRate] = useState(bookToEdit?.rate || 0);
  const [spicyLevel, setSpicyLevel] = useState(bookToEdit?.spicyLevel || 0);
  const [color, setColor] = useState(() => bookToEdit?.color || BOOK_COLORS[Math.floor(Math.random() * BOOK_COLORS.length)]);
  const [notes, setNotes] = useState(bookToEdit?.notes || '');
  const [saving, setSaving] = useState(false);
  const saveLock = React.useRef(false);
  const [attachmentDraft, setAttachmentDraft] = useState(bookToEdit?.attachmentDraft || null);
  const [picking, setPicking] = useState(false);
  const pickLock = React.useRef(false);
  const [fileNote, setFileNote] = useState(bookToEdit?.fileNote || '');

  const chooseFile = async () => {
    if (pickLock.current) return;
    pickLock.current = true; setPicking(true);
    try {
      const picked = await pickDocument();
      if (!picked) return;
      setAttachmentDraft(picked.asset);
      if (!bookToEdit?.id || !book.trim()) setBook(picked.metadata.book);
      if (!bookToEdit?.id || !author.trim()) setAuthor(picked.metadata.author);
      if (!bookToEdit?.id || !subgenres) setSubgenres(picked.metadata.subgenres);
      setType(picked.metadata.type);
      setPages(picked.metadata.pages ? String(picked.metadata.pages) : '');
      setFileNote(picked.metadata.warning || 'Metadata found. You can edit every field before saving.');
    } catch (error) { Alert.alert('File not added', error.message || 'Please choose the file again.'); }
    finally { pickLock.current = false; setPicking(false); }
  };

  const handleSave = async () => {
    if (saveLock.current || pickLock.current) return;
    if (!book.trim()) {
      Alert.alert('Required Field', 'Please enter a title.');
      return;
    }
    if (isSeries(type) && (!/^\d*$/.test(episodes) || !/^\d*$/.test(currentEpisode) || (Number(episodes) > 0 && Number(currentEpisode) > Number(episodes)))) {
      Alert.alert('Check episode progress', 'Use whole episode numbers. The current episode cannot exceed the total.');
      return;
    }
    saveLock.current = true;
    setSaving(true);
    try {
      await onSave(statusDates({
      id: bookToEdit ? bookToEdit.id : undefined,
      attachmentDraft,
      attachmentUri: bookToEdit?.attachmentUri || '',
      attachmentName: bookToEdit?.attachmentName || '',
      attachmentFormat: bookToEdit?.attachmentFormat || '',
      book: book.trim(),
      author: author.trim(),
      status,
      subgenres: subgenres.trim(),
      type,
      pages: isWatching(type) ? 0 : Number(pages) || 0,
      episodes: Number(episodes) || 0,
      currentEpisode: Number(currentEpisode) || 0,
      startDate: startDate.trim(),
      endDate: endDate.trim(),
      rate: Number(rate) || 0,
      spicyLevel: Number(spicyLevel) || 0,
      color,
      notes: notes.trim(),
      // Editing an example keeps it marked as an example until it is deleted.
      isSample: bookToEdit?.isSample ? 1 : 0
    }, status, bookToEdit?.status));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onClose();
    } catch (_) {
      Alert.alert('Title not saved', 'Your changes are still here. Please try saving again.');
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  const selectedCategories = subgenres.split(',').map((entry) => entry.trim()).filter(Boolean);
  const categories = [...POPULAR_SUBGENRES, ...library.flatMap((entry) => (entry.subgenres || '').split(',').map((tag) => tag.trim()).filter(Boolean))];

  return (
    <Modal visible={visible} transparent animationType="fade" presentationStyle="overFullScreen" supportedOrientations={['portrait', 'landscape']} onRequestClose={saving || picking ? () => {} : onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Dismiss title form" activeOpacity={1} disabled={saving || picking} onPress={onClose} style={styles.backdrop} />
        <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={saving || picking} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {bookToEdit?.id ? 'Edit Record' : 'Add New Title'}
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={saving || picking} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <TouchableOpacity onPress={chooseFile} disabled={saving || picking} accessibilityLabel="Choose PDF or EPUB file" style={styles.filePicker}>
            <Ionicons name="folder-open-outline" size={22} color={THEME.colors.goldLight} />
            <View style={{ flex: 1 }}><Text style={styles.fileTitle}>{picking ? 'Reading file details…' : attachmentDraft || bookToEdit?.attachmentName ? 'Replace PDF / EPUB' : 'Choose PDF / EPUB'}</Text><Text style={styles.fileDescription}>{attachmentDraft?.name || bookToEdit?.attachmentName || 'Pick a file, review its details, then save'}</Text></View>
          </TouchableOpacity>
          {!!fileNote && <Text style={styles.fileDescription}>{fileNote}</Text>}
          <Text style={styles.fileDescription}>Your document stays in its original folder. ReadList saves its reference and your progress.</Text>
          {/* Cover Color Selection */}
          <Text style={styles.label}>COVER / SPINE COLOR</Text>
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
            <Text style={styles.label}>TITLE *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Fourth Wing"
              placeholderTextColor={THEME.colors.textTertiary}
              value={book}
              onChangeText={setBook}
            />
          </View>

          <SearchableField
            key={`author-${visible}-${bookToEdit?.id || 'new'}`}
            label="Author / creator"
            freeText
            value={author}
            options={library.map((entry) => entry.author).filter(Boolean)}
            onChange={setAuthor}
            placeholder="Search or add an author…"
          />
          <SearchableField
            key={`status-${visible}-${bookToEdit?.id || 'new'}`}
            label="Status"
            value={status}
            options={STATUS_OPTIONS}
            onChange={setStatus}
            allowCreate={false}
            placeholder="Find a reading or watching status…"
          />
          <SearchableField
            key={`format-${visible}-${bookToEdit?.id || 'new'}`}
            label="Format / type"
            value={type}
            options={[...BOOK_TYPES, ...library.map((entry) => entry.type).filter(Boolean)]}
            onChange={(value) => {
              const watching = isWatching(value);
              setType(value);
              setStatus((current) => {
                if (watching && current === 'Want to Read') return 'Want to Watch';
                if (watching && current === 'Currently Reading') return 'Currently Watching';
                if (!watching && current === 'Want to Watch') return 'Want to Read';
                if (!watching && current === 'Currently Watching') return 'Currently Reading';
                return current;
              });
            }}
            placeholder="Search or add a format…"
          />
          <SearchableField
            key={`categories-${visible}-${bookToEdit?.id || 'new'}`}
            label="Categories and tags"
            value={selectedCategories}
            options={categories}
            onChange={(values) => setSubgenres(values.join(', '))}
            multiple
            placeholder="Search or add another category…"
          />

          <Text style={styles.fileDescription}>Add as many categories as you like, one at a time. Tap a selected category to remove it.</Text>
          {/* Pages & Dates */}
          <View style={styles.rowTwoCols}>
            {!isWatching(type) && <View style={styles.col}>
              <Text style={styles.label}>NO. OF PAGES</Text>
              <TextInput
                style={styles.textInput}
                accessibilityLabel="Total pages"
                placeholder={type === 'EPUB' ? 'No fixed page count' : 'Total pages'}
                placeholderTextColor={THEME.colors.textTertiary}
                keyboardType="numeric"
                value={pages}
                onChangeText={setPages}
              />
            </View>}
          </View>
          {isSeries(type) && <View style={styles.rowTwoCols}>
            <View style={styles.col}><Text style={styles.label}>TOTAL EPISODES</Text><TextInput accessibilityLabel="Total episodes" style={styles.textInput} keyboardType="numeric" placeholder="Unknown / ongoing" placeholderTextColor={THEME.colors.textTertiary} value={episodes} onChangeText={setEpisodes} /></View>
            <View style={styles.col}><Text style={styles.label}>CURRENT EPISODE</Text><TextInput accessibilityLabel="Current episode" style={styles.textInput} keyboardType="numeric" placeholder="0" placeholderTextColor={THEME.colors.textTertiary} value={currentEpisode} onChangeText={setCurrentEpisode} /></View>
          </View>}
          <View style={styles.rowTwoCols}>
            <View style={styles.col}>
              <Text style={styles.label}>START DATE & TIME</Text>
              <TextInput
                style={styles.textInput}
                accessibilityLabel="Start date and time"
                placeholder="YYYY-MM-DD or date and time"
                placeholderTextColor={THEME.colors.textTertiary}
                value={startDate}
                onChangeText={setStartDate}
              />
            </View>
          </View>

          <View style={styles.rowTwoCols}>
            <View style={styles.col}>
              <Text style={styles.label}>END DATE (OPTIONAL)</Text>
              <TextInput
                style={styles.textInput}
                accessibilityLabel="End date"
                placeholder="Ongoing"
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
              <Text style={styles.label}>SPICE (OPTIONAL)</Text>
              <SpicyRating level={spicyLevel} onSelect={setSpicyLevel} size={22} interactive />
            </View>
          </View>

          {/* Notes */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>PERSONAL NOTES</Text>
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: 'rgba(0,0,0,0.7)' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  filePicker: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 72, marginBottom: 12, borderRadius: 12, backgroundColor: THEME.colors.bgCard, borderWidth: 1, borderColor: THEME.colors.borderLight },
  fileTitle: { color: THEME.colors.goldLight, fontSize: 16, fontWeight: '600' },
  fileDescription: { color: THEME.colors.textSecondary, fontSize: 12, marginVertical: 6 },
  container: {
    width: '100%',
    maxWidth: 720,
    height: '94%',
    borderRadius: 16,
    overflow: 'hidden',
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
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18
  },
  col: {
    flex: 1
  },
  ratingBoxContainer: {
    minWidth: 140,
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
