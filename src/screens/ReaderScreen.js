import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, AppState, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { initDatabase, fetchReadingPosition, saveReadingPosition, updateBook, fetchReaderPreferences } from '../database';
import { readDocument, pickDocument, persistDocument } from '../services/documents';
import { parseEpub, toBase64 } from '../utils/epub';
import { readerDocument } from '../reader/document';
import ReaderFrame from '../components/ReaderFrame';

export default function ReaderScreen() {
  const { id } = useLocalSearchParams();
  const [book, setBook] = useState(null);
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [controlsVisible, setControlsVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [revision, setRevision] = useState(0);
  const [relinking, setRelinking] = useState(false);
  const frame = useRef(null);
  const record = useRef(null);
  const pending = useRef(null);
  const timer = useRef(null);
  const saveQueue = useRef(Promise.resolve());
  const exiting = useRef(false);
  const flushWaiter = useRef(null);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const position = pending.current, current = record.current;
    pending.current = null;
    if (position && current) {
      saveQueue.current = saveQueue.current.catch(() => {}).then(() => saveReadingPosition(current.id, { ...position, fileUri: current.attachmentUri, updatedAt: new Date().toISOString() })).catch((failure) => {
        if (!pending.current) pending.current = position;
        setSaveError('Reading position could not be saved. Try closing the reader again.');
        throw failure;
      });
    }
    return saveQueue.current;
  }, []);

  const exit = useCallback(async () => {
    if (exiting.current) return;
    exiting.current = true;
    try {
      if (frame.current) await new Promise((resolve) => {
        const fallback = setTimeout(resolve, 400);
        flushWaiter.current = () => { clearTimeout(fallback); resolve(); };
        frame.current.flush();
      });
      await flush();
      if (router.canGoBack()) router.back(); else router.replace('/');
    } catch { exiting.current = false; }
  }, [flush]);

  const onMessage = useCallback((message) => {
    if (message.type === 'progress' && message.position && ['PDF', 'EPUB'].includes(message.position.format)) {
      pending.current = message.position;
      clearTimeout(timer.current);
      if (AppState.currentState !== 'active') flush().catch(() => {});
      else timer.current = setTimeout(() => { flush().catch(() => {}); }, 200);
    } else if (message.type === 'close') exit();
    else if (message.type === 'controls') setControlsVisible(!!message.visible);
    else if (message.type === 'ready') setReady(true);
    else if (message.type === 'error') { setError(message.message || 'This document could not be opened.'); setReady(true); }
    else if (message.type === 'flushed') flushWaiter.current?.();
  }, [flush, exit]);

  useEffect(() => {
    let live = true;
    (async () => {
      const books = await initDatabase();
      const found = books.find((entry) => String(entry.id) === String(id));
      if (!found?.attachmentUri) throw new Error('This title has no attached PDF or EPUB file. Attach one in Edit.');
      if (live) { record.current = found; setBook(found); }
      const stored = await fetchReadingPosition(found.id);
      const position = stored?.fileUri === found.attachmentUri ? stored : null;
      const preferences = await fetchReaderPreferences();
      const bytes = await readDocument(found.attachmentUri);
      const format = found.attachmentFormat;
      const data = format === 'EPUB' ? { chapters: parseEpub(bytes) } : { base64: toBase64(bytes) };
      if (live) {
        record.current = found;
        setBook(found);
        setHtml(readerDocument({ ...data, format, title: found.book, position, preferences }));
      }
    })().catch((failure) => { if (live) { setError(failure.message); setReady(true); } });
    const appState = AppState.addEventListener('change', (state) => { if (state !== 'active') { frame.current?.flush(); flush().catch(() => {}); } });
    const back = BackHandler.addEventListener('hardwareBackPress', () => { exit(); return true; });
    return () => { live = false; appState.remove(); back.remove(); flush().catch(() => {}); };
  }, [id, exit, flush, revision]);

  const relink = async () => {
    if (relinking || !record.current) return;
    setRelinking(true);
    try {
      const picked = await pickDocument();
      if (!picked) return;
      const linked = await persistDocument(picked.asset);
      const current = record.current;
      const prior = await fetchReadingPosition(current.id);
      await updateBook(current.id, { ...current, ...linked });
      if (prior) await saveReadingPosition(current.id, { ...prior, fileUri: linked.attachmentUri });
      setError(''); setReady(false); setHtml(''); setRevision((value) => value + 1);
    } catch (failure) { setError(failure.message); }
    finally { setRelinking(false); }
  };

  return <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']}>
    <StatusBar hidden={!controlsVisible && !error} />
    {!!error && <View style={styles.header}><TouchableOpacity onPress={exit} accessibilityRole="button" accessibilityLabel="Close reader" style={styles.back}><Text style={styles.accent}>‹ Library</Text></TouchableOpacity><Text numberOfLines={1} style={styles.title}>{book?.book || 'Reader'}</Text></View>}
    {!!saveError && <Text accessibilityRole="alert" style={styles.error}>{saveError}</Text>}
    {!!error && <View style={styles.errorPanel}><Text accessibilityRole="alert" style={styles.error}>{error}</Text>{!!book && <TouchableOpacity onPress={relink} disabled={relinking} style={styles.back} accessibilityRole="button" accessibilityLabel="Relink original file"><Text style={styles.accent}>{relinking ? 'Selecting…' : 'Relink original file'}</Text></TouchableOpacity>}<TouchableOpacity onPress={exit} style={styles.back}><Text style={styles.accent}>Back to library</Text></TouchableOpacity></View>}
    {!!html && <ReaderFrame ref={frame} html={html} onMessage={onMessage} />}
    {!ready && !error && <View pointerEvents="none" style={styles.loading}><ActivityIndicator color="#f5bd62" /><Text style={styles.loadingText}>Opening document…</Text></View>}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#101014' },
  header: { backgroundColor: '#101014', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderColor: '#3d3947', minHeight: 54 },
  back: { minHeight: 48, minWidth: 80, flexShrink: 0, justifyContent: 'center', paddingHorizontal: 8 },
  accent: { color: '#f5bd62', fontSize: 15 },
  title: { flex: 1, minWidth: 0, color: '#f4f4f6', fontSize: 14 },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#101014' },
  loadingText: { color: '#b7b3bf' },
  error: { color: '#f5bd62', padding: 16, fontSize: 14 },
  errorPanel: { padding: 12 },
});
