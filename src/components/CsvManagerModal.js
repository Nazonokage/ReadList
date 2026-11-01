import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { THEME } from '../theme';
import { booksToCsv } from '../database';

export default function CsvManagerModal({
  visible,
  books,
  onClose,
  onResetDefault,
  onImportCsv
}) {
  const [activeTab, setActiveTab] = useState('EXPORT'); // 'EXPORT' | 'IMPORT'
  const [importText, setImportText] = useState('');

  if (!visible) return null;

  const csvContent = booksToCsv(books);

  const handleReset = () => {
    Alert.alert(
      'Reset Library Data',
      'This will reset your local database to the default sample books from the spreadsheet. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (_) {}
            await onResetDefault();
            onClose();
          }
        }
      ]
    );
  };

  const handleParseAndImport = () => {
    if (!importText.trim()) {
      Alert.alert('Empty Input', 'Please paste CSV content with rows to import.');
      return;
    }

    try {
      const lines = importText.trim().split('\n');
      if (lines.length <= 1) {
        Alert.alert('Invalid CSV', 'CSV must have at least one data row.');
        return;
      }

      // Parse CSV rows
      const imported = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Simple regex to match comma separated or quoted fields
        const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
        const clean = matches.map((m) => m.replace(/^"|"$/g, '').trim());

        if (clean.length >= 2) {
          imported.push({
            book: clean[1] || clean[0],
            author: clean[2] || 'Unknown Author',
            status: clean[3] || 'Want to Read',
            subgenres: clean[4] || '',
            type: clean[5] || 'Paperback',
            pages: Number(clean[6]) || 0,
            startDate: clean[7] || '',
            endDate: clean[8] || '',
            rate: Number(clean[9]) || 0,
            spicyLevel: Number(clean[10]) || 0,
            notes: 'Imported from spreadsheet CSV'
          });
        }
      }

      if (imported.length === 0) {
        Alert.alert('Parse Failed', 'Could not parse any books from the input.');
        return;
      }

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (_) {}

      onImportCsv(imported);
      Alert.alert('Success', `Imported ${imported.length} books into your local database!`);
      onClose();
    } catch (err) {
      Alert.alert('Import Error', 'Failed to parse CSV: ' + err.message);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Spreadsheet & Local DB</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close-circle" size={26} color={THEME.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            onPress={() => setActiveTab('EXPORT')}
            style={[styles.tab, activeTab === 'EXPORT' && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === 'EXPORT' && styles.tabTextActive]}>
              Spreadsheet CSV
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('IMPORT')}
            style={[styles.tab, activeTab === 'IMPORT' && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === 'IMPORT' && styles.tabTextActive]}>
              Import CSV
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {activeTab === 'EXPORT' ? (
            <View>
              <Text style={styles.description}>
                This data mirrors your spreadsheet columns:
              </Text>
              <View style={styles.columnPillRow}>
                {['No.', 'Book', 'Author', 'Status', 'Romance Subgenres', 'Type', 'Pages', 'Dates', 'Rate', 'Spicy Level'].map((c, i) => (
                  <View key={i} style={styles.colPill}>
                    <Text style={styles.colPillText}>{c}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.sectionHeader}>CSV FORMATTED DATA</Text>
              <TextInput
                style={styles.csvBox}
                value={csvContent}
                multiline
                editable={false}
                selectTextOnFocus
              />

              <TouchableOpacity onPress={handleReset} style={styles.resetBtn} activeOpacity={0.8}>
                <Ionicons name="refresh-outline" size={18} color={THEME.colors.statusDNF} />
                <Text style={styles.resetBtnText}>Reset to Default Seed Books</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={styles.description}>
                Paste your CSV rows here with columns matching your spreadsheet:
              </Text>
              <Text style={styles.exampleHeader}>Header Template:</Text>
              <Text style={styles.exampleCode}>
                No.,Book,Author,Status,Romance Subgenres,Type,No. of Pages,Start Date,End Date,Rate,Spicy Level
              </Text>

              <TextInput
                style={[styles.csvBox, styles.csvInputBox]}
                placeholder="Paste CSV rows here..."
                placeholderTextColor={THEME.colors.textTertiary}
                value={importText}
                onChangeText={setImportText}
                multiline
              />

              <TouchableOpacity onPress={handleParseAndImport} style={styles.importBtn} activeOpacity={0.8}>
                <Ionicons name="cloud-upload-outline" size={18} color="#18171C" />
                <Text style={styles.importBtnText}>Parse & Append to Database</Text>
              </TouchableOpacity>
            </View>
          )}
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
    color: THEME.colors.textPrimary
  },
  closeBtn: {
    padding: 2
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: THEME.colors.bgCard
  },
  tabActive: {
    backgroundColor: THEME.colors.gold
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textSecondary
  },
  tabTextActive: {
    color: '#18171C'
  },
  content: {
    padding: 16,
    paddingBottom: 40
  },
  description: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginBottom: 10,
    lineHeight: 18
  },
  columnPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16
  },
  colPill: {
    backgroundColor: THEME.colors.bgHighlight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  colPillText: {
    fontSize: 11,
    color: THEME.colors.goldLight,
    fontWeight: '600'
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: 8
  },
  csvBox: {
    backgroundColor: THEME.colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 12,
    fontFamily: 'monospace',
    fontSize: 11,
    color: THEME.colors.textSecondary,
    height: 240,
    textAlignVertical: 'top'
  },
  csvInputBox: {
    color: THEME.colors.textPrimary,
    marginTop: 10
  },
  exampleHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.gold,
    marginTop: 6
  },
  exampleCode: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: THEME.colors.textTertiary,
    backgroundColor: THEME.colors.bgCard,
    padding: 8,
    borderRadius: 6,
    marginTop: 4
  },
  importBtn: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    ...THEME.shadows.glowGold
  },
  importBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#18171C'
  },
  resetBtn: {
    flexDirection: 'row',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.statusDNF
  }
});
