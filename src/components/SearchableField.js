import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { THEME } from '../theme';

export default function SearchableField({ label, value, options, onChange, multiple = false, allowCreate = true, freeText = false, placeholder = 'Search or add…' }) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const blurTimer = useRef(null);
  useEffect(() => () => clearTimeout(blurTimer.current), []);
  const selected = multiple ? value : value ? [value] : [];
  const clean = (text) => text.trim().toLocaleLowerCase();
  const unique = Array.from(new Map([...options, ...selected].filter(Boolean).map((item) => [clean(item), item])).values());
  const matches = unique.filter((item) => clean(item).includes(clean(query)) && !selected.some((entry) => clean(entry) === clean(item))).slice(0, 5);
  const candidate = query.trim();
  const canCreate = allowCreate && candidate && (freeText || !candidate.includes(',')) && !(freeText ? options : unique).some((item) => clean(item) === clean(candidate));
  const choose = (item) => {
    clearTimeout(blurTimer.current);
    if (multiple) {
      if (!selected.some((entry) => clean(entry) === clean(item))) onChange([...selected, item]);
    } else onChange(item);
    setQuery('');
    setExpanded(false);
  };
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {multiple && selected.length > 0 && <View style={styles.selected}>
        {selected.map((item) => <TouchableOpacity key={item} accessibilityRole="button" accessibilityLabel={`Remove ${item}`} onPress={() => onChange(selected.filter((entry) => entry !== item))} style={styles.tag}><Text style={styles.tagText}>{item} ×</Text></TouchableOpacity>)}
      </View>}
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={allowCreate ? 'Type to find an option or add a new one' : 'Type to find an option'}
        placeholder={!multiple && value && !expanded ? value : placeholder}
        placeholderTextColor={!multiple && value && !expanded ? THEME.colors.textPrimary : THEME.colors.textSecondary}
        value={freeText && !expanded ? value : query}
        onChangeText={(text) => { setQuery(text); if (freeText) onChange(text); }}
        onFocus={() => { clearTimeout(blurTimer.current); if (freeText) setQuery(value); setExpanded(true); }}
        onBlur={() => { blurTimer.current = setTimeout(() => { setExpanded(false); setQuery(''); }, 160); }}
        onSubmitEditing={() => { if (freeText) { onChange(query.trim()); setExpanded(false); setQuery(''); return; } if (canCreate) choose(candidate); else if (matches.length) choose(matches[0]); }}
        returnKeyType="done"
        style={styles.input}
      />
      {expanded && <View style={styles.results}>
        {matches.map((item) => <TouchableOpacity key={item} accessibilityRole="button" onPress={() => choose(item)} style={styles.option}><Text style={styles.optionText}>{item}</Text></TouchableOpacity>)}
        {!!canCreate && <TouchableOpacity accessibilityRole="button" onPress={() => choose(candidate)} style={styles.option}><Text style={styles.createText}>+ Add “{candidate}”</Text></TouchableOpacity>}
        {!matches.length && !canCreate && <Text style={styles.hint}>{candidate.includes(',') ? 'Add one category at a time.' : 'No other matches.'}</Text>}
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 20 },
  label: { color: THEME.colors.textSecondary, fontSize: 12, marginBottom: 8, fontWeight: '600' },
  input: { color: THEME.colors.textPrimary, backgroundColor: THEME.colors.bgCard, borderWidth: 1, borderColor: THEME.colors.borderLight, borderRadius: 10, padding: 12, minHeight: 48, fontSize: 16 },
  selected: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  tag: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, backgroundColor: THEME.colors.bgHighlight },
  tagText: { color: THEME.colors.goldLight, fontSize: 13 },
  results: { backgroundColor: THEME.colors.bgCard, borderRadius: 10, marginTop: 4, borderWidth: 1, borderColor: THEME.colors.borderLight },
  option: { minHeight: 48, justifyContent: 'center', padding: 12 },
  optionText: { color: THEME.colors.textPrimary, fontSize: 14 },
  createText: { color: THEME.colors.goldLight, fontSize: 14 },
  hint: { padding: 12, color: THEME.colors.textSecondary, fontSize: 13 },
});
