import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../theme';
import {
  addSampleTitles,
  exportLibrary,
  fetchBooks,
  fetchReaderPreferences,
  fetchShelfSettings,
  importLibrary,
  resetToDefault,
  saveReaderPreferences,
  saveShelfSettings
} from '../database';
import { describeBackup, validateBackup } from '../utils/backup';
import { buildWorkbook, libraryToWorkbook, parseWorkbook, summarizeWorkbook } from '../utils/workbook';
import { pickWorkbook, saveWorkbook } from '../services/workbookFiles';

export default function SettingsModal({ visible, onClose, onOpenGuide, onLibraryChanged }) {
  const [showProgress, setShowProgress] = useState(false);
  const [shelfCount, setShelfCount] = useState('3');
  const [backupText, setBackupText] = useState('');
  const [pending, setPending] = useState(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [workbook, setWorkbook] = useState(null);
  const [workbookName, setWorkbookName] = useState('');
  const [confirmWorkbookReplace, setConfirmWorkbookReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!visible) return undefined;
    let live = true;
    (async () => {
      try {
        const [preferences, shelves] = await Promise.all([fetchReaderPreferences(), fetchShelfSettings()]);
        if (!live) return;
        setShowProgress(!!preferences.showProgress);
        setShelfCount(String(shelves.shelfCount || 3));
      } catch {
        // Keep the defaults; the switch still writes when the user changes it.
      }
    })();
    return () => { live = false; };
  }, [visible]);

  const run = async (action, success) => {
    if (busy) return;
    setBusy(true);
    setStatus('');
    try {
      const message = await action();
      setStatus(typeof message === 'string' ? message : success || 'Done.');
    } catch (error) {
      setStatus(error.message || 'That did not work. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  };

  const changeProgress = (value) => {
    setShowProgress(value);
    run(() => saveReaderPreferences({ showProgress: value }).then(() => (value ? 'Reading progress will show by default in titles you have not changed.' : 'Reading progress stays off by default.')));
  };

  const saveShelves = () => {
    const value = Number(shelfCount);
    if (!Number.isInteger(value) || value < 1 || value > 20) {
      setStatus('Choose between 1 and 20 shelves per page.');
      return;
    }
    run(() => saveShelfSettings(value).then(() => `Shelves per page set to ${value}.`));
  };

  const buildBackup = async () => {
    const snapshot = await exportLibrary();
    const text = JSON.stringify(snapshot, null, 2);
    setBackupText(text);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `readlist-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return 'Backup downloaded. It contains your records and reading positions, not the original PDF/EPUB files.';
    }
    return 'Backup ready below. Copy the text and keep it somewhere safe; it does not contain the original files.';
  };

  const checkBackup = () => {
    try {
      const snapshot = validateBackup(JSON.parse(backupText));
      setPending(snapshot);
      setConfirmReplace(false);
      setStatus(`Backup ready to restore: ${describeBackup(snapshot)}.`);
    } catch (error) {
      setPending(null);
      setStatus(error.message || 'That text is not a ReadList backup.');
    }
  };

  const restore = (replace) => {
    if (!pending) return;
    if (replace && !confirmReplace) {
      setConfirmReplace(true);
      setStatus('Replacing removes titles that are not in the backup. Press the replace button again to confirm.');
      return;
    }
    run(async () => {
      const result = await importLibrary(pending, { replace });
      setConfirmReplace(false);
      setPending(null);
      await onLibraryChanged?.();
      return `${result.imported} ${result.imported === 1 ? 'title' : 'titles'} restored${replace ? ', replacing the previous library' : ' into your library'}.`;
    });
  };

  const exportWorkbook = () => run(async () => {
    const snapshot = await exportLibrary();
    const bytes = buildWorkbook(libraryToWorkbook(snapshot.books, snapshot.readingPositions));
    const name = `readlist-${new Date().toISOString().slice(0, 10)}.xlsx`;
    const saved = await saveWorkbook(bytes, name);
    return Platform.OS === 'web'
      ? 'Workbook downloaded. It holds records and reading positions, never the original files.'
      : `Workbook written to ${saved}. Sharing it out of the app is not implemented yet.`;
  });

  const openWorkbook = async () => {
    if (busy) return;
    setBusy(true);
    setStatus('');
    try {
      const picked = await pickWorkbook();
      if (!picked) { setStatus('No workbook selected.'); return; }
      const summary = summarizeWorkbook(parseWorkbook(picked.bytes));
      // Report what a merge would change before anything is written.
      const existing = await fetchBooks();
      const known = new Set(existing.map((book) => String(book.id)));
      summary.updates = summary.records.filter((record) => known.has(String(record.id))).length;
      summary.additions = summary.total - summary.updates;
      setWorkbook(summary);
      setWorkbookName(picked.name);
      setConfirmWorkbookReplace(false);
      setStatus(`Workbook "${picked.name}": ${summary.total} ${summary.total === 1 ? 'title' : 'titles'} (${summary.book} books, ${summary.series} series, ${summary.movie} movies), ${summary.positions} reading ${summary.positions === 1 ? 'position' : 'positions'}${summary.issues ? `, ${summary.issues} skipped row${summary.issues === 1 ? '' : 's'}` : ''}. Merging adds ${summary.additions} and updates ${summary.updates}.`);
    } catch (error) {
      setWorkbook(null);
      setStatus(error.message || 'That workbook could not be read.');
    } finally {
      setBusy(false);
    }
  };

  const applyWorkbook = (replace) => {
    if (!workbook) return;
    if (replace && !confirmWorkbookReplace) {
      setConfirmWorkbookReplace(true);
      setStatus('Replacing removes titles that are not in the workbook. Press the replace button again to confirm.');
      return;
    }
    run(async () => {
      // Keep a recoverable copy of the current library in the backup box before a
      // replace, so an unwanted import can be undone from this sheet.
      if (replace) {
        const snapshot = await exportLibrary();
        setBackupText(JSON.stringify(snapshot, null, 2));
      }
      const result = await importLibrary(
        { app: 'ReadList', books: workbook.records, readingPositions: workbook.readingPositions, presets: [], shelfSettings: {}, readerPreferences: {} },
        { replace, applyPreferences: false }
      );
      setWorkbook(null);
      setConfirmWorkbookReplace(false);
      await onLibraryChanged?.();
      return `${result.imported} ${result.imported === 1 ? 'title' : 'titles'} imported${replace ? ', replacing the previous library' : ' and merged into the library'}.${replace ? ' The previous library is in the backup box above.' : ''}`;
    });
  };

  const addExamples = () => run(async () => {
    const result = await addSampleTitles();
    await onLibraryChanged?.();
    return result.added ? `${result.added} example ${result.added === 1 ? 'title' : 'titles'} added. Your own titles were not changed.` : 'Every example title is already in your library.';
  });

  const replaceWithExamples = () => {
    Alert.alert(
      'Replace library with examples',
      'This removes your own titles and restores the built-in examples. Original PDF/EPUB files on your device are not deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: () => run(async () => {
            await resetToDefault();
            await onLibraryChanged?.();
            return 'Library replaced with the example titles.';
          })
        }
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close settings" style={styles.closeBtn}>
            <Ionicons name="close-circle" size={26} color={THEME.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionHeader}>READING</Text>
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={styles.rowTitle}>Show reading progress by default</Text>
                <Text style={styles.rowNote}>Off by default. Applies to titles you have not changed in the reader; a change made while reading stays with that title.</Text>
              </View>
              <Switch
                value={showProgress}
                onValueChange={changeProgress}
                accessibilityLabel="Show reading progress by default"
                trackColor={{ false: THEME.colors.border, true: THEME.colors.gold }}
                thumbColor={showProgress ? '#18171C' : '#E4E4E7'}
              />
            </View>
          </View>

          <Text style={styles.sectionHeader}>SHELVES</Text>
          <View style={styles.card}>
            <Text style={styles.rowTitle}>Shelves per page</Text>
            <Text style={styles.rowNote}>Between 1 and 20. Extra titles are kept on further pages.</Text>
            <View style={styles.inlineRow}>
              <TextInput
                value={shelfCount}
                onChangeText={setShelfCount}
                keyboardType="number-pad"
                accessibilityLabel="Shelves per page"
                style={styles.numberInput}
                maxLength={2}
              />
              <TouchableOpacity onPress={saveShelves} disabled={busy} style={styles.primarySmall} accessibilityRole="button">
                <Text style={styles.primarySmallText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.sectionHeader}>HELP</Text>
          <View style={styles.card}>
            <TouchableOpacity onPress={onOpenGuide} accessibilityRole="button" style={styles.linkRow}>
              <Ionicons name="help-circle-outline" size={18} color={THEME.colors.goldLight} />
              <Text style={styles.linkText}>Open the quick guide</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionHeader}>LOCAL DATA</Text>
          <View style={styles.card}>
            <Text style={styles.rowNote}>A backup is readable JSON with your records, presets, reading positions and preferences. It never contains the original PDF/EPUB files, so links may need relinking on another device.</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity onPress={() => run(buildBackup)} disabled={busy} accessibilityRole="button" style={styles.secondaryButton}>
                <Text style={styles.secondaryText}>{Platform.OS === 'web' ? 'Download backup' : 'Create backup'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setBackupText('')} disabled={busy} accessibilityRole="button" style={styles.secondaryButton}>
                <Text style={styles.secondaryText}>Clear</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              value={backupText}
              onChangeText={(text) => { setBackupText(text); setPending(null); setStatus(''); }}
              placeholder="Paste a ReadList backup here to restore it"
              placeholderTextColor={THEME.colors.textTertiary}
              accessibilityLabel="Backup text"
              multiline
              style={styles.backupInput}
            />
            <View style={styles.buttonRow}>
              <TouchableOpacity onPress={checkBackup} disabled={busy || !backupText.trim()} accessibilityRole="button" style={styles.secondaryButton}>
                <Text style={styles.secondaryText}>Check backup</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => restore(false)} disabled={busy || !pending} accessibilityRole="button" style={styles.secondaryButton}>
                <Text style={styles.secondaryText}>Merge into library</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => restore(true)} disabled={busy || !pending} accessibilityRole="button" style={[styles.dangerButton, confirmReplace && styles.dangerButtonArmed]}>
                <Text style={styles.dangerText}>{confirmReplace ? 'Replace everything' : 'Replace library'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <Text style={styles.rowTitle}>Workbook (.xlsx)</Text>
            <Text style={styles.rowNote}>One workbook with Books, Series, Movies and Progress sheets. Pages stay with books and episodes with series, and the original PDF/EPUB files are never included.</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity onPress={exportWorkbook} disabled={busy} accessibilityRole="button" style={styles.secondaryButton}>
                <Text style={styles.secondaryText}>Export workbook</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={openWorkbook} disabled={busy} accessibilityRole="button" style={styles.secondaryButton}>
                <Text style={styles.secondaryText}>Import workbook</Text>
              </TouchableOpacity>
            </View>
            {!!workbook && (
              <View style={styles.workbookPreview}>
                <Text style={styles.rowNote}>{workbookName}: {workbook.total} {workbook.total === 1 ? 'title' : 'titles'} · {workbook.book} books · {workbook.series} series · {workbook.movie} movies · {workbook.positions} positions</Text>
                <Text style={styles.rowNote}>Merging adds {workbook.additions} and updates {workbook.updates} of your {workbook.updates ? 'existing' : 'current'} records.</Text>
                {workbook.problems.slice(0, 3).map((problem) => <Text key={problem} style={styles.rowNote}>· {problem}</Text>)}
                {workbook.problems.length > 3 && <Text style={styles.rowNote}>· and {workbook.problems.length - 3} more skipped rows</Text>}
                <View style={styles.buttonRow}>
                  <TouchableOpacity onPress={() => applyWorkbook(false)} disabled={busy} accessibilityRole="button" style={styles.secondaryButton}>
                    <Text style={styles.secondaryText}>Merge workbook</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => applyWorkbook(true)} disabled={busy} accessibilityRole="button" style={[styles.dangerButton, confirmWorkbookReplace && styles.dangerButtonArmed]}>
                    <Text style={styles.dangerText}>{confirmWorkbookReplace ? 'Replace everything with workbook' : 'Replace with workbook'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.divider} />

            <TouchableOpacity onPress={addExamples} disabled={busy} accessibilityRole="button" style={styles.linkRow}>
              <Ionicons name="sparkles-outline" size={18} color={THEME.colors.goldLight} />
              <Text style={styles.linkText}>Add example titles</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={replaceWithExamples} disabled={busy} accessibilityRole="button" style={styles.linkRow}>
              <Ionicons name="refresh-outline" size={18} color={THEME.colors.statusReading} />
              <Text style={styles.linkText}>Replace library with example titles</Text>
            </TouchableOpacity>
          </View>

          {busy && <View style={styles.busyRow}><ActivityIndicator color={THEME.colors.gold} /><Text style={styles.rowNote}>Working…</Text></View>}
          {!!status && <Text accessibilityRole="alert" style={styles.status}>{status}</Text>}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  title: { fontSize: 18, fontWeight: '800', color: THEME.colors.textPrimary, letterSpacing: 0.3 },
  closeBtn: { padding: 2 },
  content: { padding: 16, paddingBottom: 48, gap: 10 },
  sectionHeader: { fontSize: 11, fontWeight: '800', color: THEME.colors.textTertiary, letterSpacing: 0.8, marginTop: 8 },
  card: { backgroundColor: THEME.colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: THEME.colors.border, padding: 16, gap: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { flex: 1, gap: 4 },
  rowTitle: { color: THEME.colors.textPrimary, fontSize: 14, fontWeight: '700' },
  rowNote: { color: THEME.colors.textSecondary, fontSize: 12, lineHeight: 17 },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  numberInput: { width: 64, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: THEME.colors.borderLight, color: THEME.colors.textPrimary, textAlign: 'center', fontSize: 14 },
  primarySmall: { minHeight: 44, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: THEME.colors.gold },
  primarySmallText: { color: '#18171C', fontSize: 13, fontWeight: '800' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  linkText: { color: THEME.colors.textPrimary, fontSize: 14, fontWeight: '600' },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  secondaryButton: { minHeight: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: THEME.colors.borderLight },
  secondaryText: { color: THEME.colors.textPrimary, fontSize: 13, fontWeight: '700' },
  dangerButton: { minHeight: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: THEME.colors.statusReading },
  dangerButtonArmed: { backgroundColor: 'rgba(239,68,68,0.18)' },
  dangerText: { color: THEME.colors.statusReading, fontSize: 13, fontWeight: '800' },
  backupInput: { minHeight: 96, maxHeight: 160, borderRadius: 10, borderWidth: 1, borderColor: THEME.colors.borderLight, color: THEME.colors.textPrimary, padding: 10, fontSize: 12, textAlignVertical: 'top' },
  divider: { height: 1, backgroundColor: THEME.colors.border, marginVertical: 4 },
  workbookPreview: { gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: THEME.colors.borderLight },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  status: { color: THEME.colors.goldLight, fontSize: 12, lineHeight: 17, paddingHorizontal: 4 }
});
