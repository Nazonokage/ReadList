import React, { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, StyleSheet, Alert } from 'react-native';
import { THEME } from '../theme';
import { applyPreset } from '../utils/presets';
import SearchableField from './SearchableField';

export default function PresetManagerModal({ visible, ...props }) {
  if (!visible) return null;
  return <PresetEditor {...props} />;
}

function PresetEditor({ books, presets, onClose, onApply, onSave }) {
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [selectionQuery, setSelectionQuery] = useState('');
  const [bookIds, setBookIds] = useState([]);
  const [categories, setCategories] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const draft = { id: editing || undefined, name, query, bookIds, categories, statuses };
  const count = applyPreset(books, draft).length;
  const choices = books.filter((book) => `${book.book} ${book.author}`.toLocaleLowerCase().includes(selectionQuery.toLocaleLowerCase()));
  const selectPreset = (preset) => {
    setEditing(preset?.id || 'new'); setName(preset?.name || ''); setQuery(preset?.query || '');
    setBookIds(preset?.bookIds || []); setCategories(preset?.categories || []); setStatuses(preset?.statuses || []);
    setSelectionQuery('');
  };
  const save = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await onSave({ ...draft, id: editing === 'new' ? undefined : editing }); onClose(); }
    catch (error) { Alert.alert('Preset not saved', error.message || 'Please try again.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const move = (id, delta) => {
    const index = bookIds.indexOf(id), target = index + delta;
    if (target < 0 || target >= bookIds.length) return;
    const next = [...bookIds]; next.splice(index, 1); next.splice(target, 0, id); setBookIds(next);
  };
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={busy ? () => {} : onClose}>
      <View style={styles.container}>
        <View style={styles.header}><TouchableOpacity disabled={busy} onPress={onClose} style={styles.button}><Text style={styles.accent}>Close</Text></TouchableOpacity><Text style={styles.heading}>Library presets</Text>{editing && <TouchableOpacity disabled={busy} onPress={save} style={styles.button}><Text style={styles.accent}>{busy ? 'Saving…' : 'Save'}</Text></TouchableOpacity>}</View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {!editing ? <>
            <TouchableOpacity onPress={() => { onApply(null); onClose(); }} style={styles.row}><Text style={styles.text}>Full library</Text></TouchableOpacity>
            {presets.map((preset) => <View key={preset.id} style={styles.row}>
              <TouchableOpacity style={styles.flex} onPress={() => { onApply(preset.id); onClose(); }}><Text style={styles.text}>{preset.name}</Text><Text style={styles.muted}>{applyPreset(books, preset).length} matching titles</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => selectPreset(preset)} style={styles.button} accessibilityLabel={`Edit ${preset.name}`}><Text style={styles.accent}>Edit</Text></TouchableOpacity>
            </View>)}
            <TouchableOpacity onPress={() => selectPreset(null)} style={styles.row}><Text style={styles.accent}>+ Create preset</Text></TouchableOpacity>
          </> : <>
            <Text style={styles.label}>Preset name</Text><TextInput accessibilityLabel="Preset name" value={name} onChangeText={setName} placeholder="e.g. Next to read" placeholderTextColor={THEME.colors.textSecondary} style={styles.input} />
            <Text style={styles.label}>Saved search</Text><TextInput accessibilityLabel="Saved search" value={query} onChangeText={setQuery} placeholder="Optional title, author or tag…" placeholderTextColor={THEME.colors.textSecondary} style={styles.input} />
            <SearchableField label="Categories" value={categories} options={books.flatMap((book) => (book.subgenres || '').split(',').map((tag) => tag.trim()).filter(Boolean))} onChange={setCategories} multiple allowCreate={false} />
            <SearchableField label="Statuses" value={statuses} options={[...new Set(books.map((book) => book.status))]} onChange={setStatuses} multiple allowCreate={false} />
            <Text style={styles.heading}>Choose titles</Text><Text style={styles.muted}>No selection includes all matching titles. Selected titles must also match your saved filters.</Text>
            <TextInput accessibilityLabel="Search titles to select" value={selectionQuery} onChangeText={setSelectionQuery} placeholder="Find a book or anime…" placeholderTextColor={THEME.colors.textSecondary} style={styles.input} />
            {choices.map((book) => <TouchableOpacity key={book.id} accessibilityRole="checkbox" accessibilityState={{ checked: bookIds.includes(book.id) }} onPress={() => setBookIds((ids) => ids.includes(book.id) ? ids.filter((id) => id !== book.id) : [...ids, book.id])} style={styles.row}><Text style={styles.accent}>{bookIds.includes(book.id) ? '☑' : '☐'}</Text><Text style={[styles.text, styles.flex]}>{book.book}</Text></TouchableOpacity>)}
            {bookIds.length > 0 && <><Text style={styles.label}>Selected order</Text>{bookIds.map((id, index) => <View key={id} style={styles.row}><Text style={[styles.text, styles.flex]}>{books.find((book) => book.id === id)?.book || 'Missing title'}</Text><TouchableOpacity disabled={index === 0} onPress={() => move(id, -1)} style={styles.button} accessibilityLabel="Move title earlier"><Text style={styles.accent}>↑</Text></TouchableOpacity><TouchableOpacity disabled={index === bookIds.length - 1} onPress={() => move(id, 1)} style={styles.button} accessibilityLabel="Move title later"><Text style={styles.accent}>↓</Text></TouchableOpacity></View>)}</>}
            <Text style={styles.label}>{count} matching {count === 1 ? 'title' : 'titles'}</Text>
          </>}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  content: { padding: 20, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderBottomWidth: 1, borderColor: THEME.colors.border },
  heading: { fontSize: 18, fontWeight: '600', color: THEME.colors.textPrimary },
  label: { marginTop: 18, marginBottom: 8, fontSize: 13, color: THEME.colors.textSecondary },
  input: { padding: 12, fontSize: 16, minHeight: 48, color: THEME.colors.textPrimary, backgroundColor: THEME.colors.bgCard, borderRadius: 10, marginVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10, borderBottomWidth: 1, borderColor: THEME.colors.border },
  text: { fontSize: 15, color: THEME.colors.textPrimary },
  muted: { fontSize: 12, color: THEME.colors.textSecondary, marginTop: 6 },
  accent: { color: THEME.colors.goldLight, fontSize: 15 },
  flex: { flex: 1 },
  button: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
