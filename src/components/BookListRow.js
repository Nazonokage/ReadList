import { episodeLabel } from '../utils/progress';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../theme';

export default function BookListRow({ book, index, onPress }) {
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open details for ${book.book}`} onPress={() => onPress(book)} style={styles.row}>
      <Text style={styles.number}>{index + 1}</Text>
      <View style={[styles.spine, { backgroundColor: book.color || THEME.colors.gold }]} />
      <View style={styles.titleColumn}>
        <View style={styles.titleRow}>
          <Text numberOfLines={2} style={styles.title}>{book.book}</Text>
          {!!book.isSample && <Text style={styles.badge}>Example</Text>}
        </View>
        <Text numberOfLines={1} style={styles.author}>{book.author || 'Unknown creator'}</Text>
        {!!episodeLabel(book) && <Text style={styles.status}>{episodeLabel(book)}</Text>}
        {!!book.subgenres && <Text numberOfLines={1} style={styles.tags}>{book.subgenres}</Text>}
      </View>
      <View style={styles.statusColumn}>
        <Text style={styles.status}>{book.status}</Text>
        <Text numberOfLines={1} style={styles.author}>{book.type || 'Unspecified'}</Text>
        {!!book.attachmentName && <View style={styles.file}><Ionicons name="document-attach-outline" color={THEME.colors.goldLight} size={13} /><Text style={styles.fileText}>{book.attachmentFormat}</Text></View>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 12, minHeight: 86, borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  number: { width: 22, color: THEME.colors.textSecondary, fontSize: 12, textAlign: 'center' },
  spine: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  titleColumn: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  title: { flexShrink: 1, color: THEME.colors.textPrimary, fontWeight: '600', fontSize: 14 },
  badge: { color: THEME.colors.goldLight, fontSize: 10, fontWeight: '800', borderWidth: 1, borderColor: THEME.colors.borderLight, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden' },
  author: { color: THEME.colors.textSecondary, fontSize: 12, marginTop: 4 },
  tags: { color: THEME.colors.textSecondary, fontSize: 11, marginTop: 5 },
  statusColumn: { width: 96 },
  status: { color: THEME.colors.goldLight, fontSize: 12 },
  file: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  fileText: { color: THEME.colors.goldLight, fontSize: 11 },
});
