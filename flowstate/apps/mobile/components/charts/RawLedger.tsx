/**
 * RawLedger — a high-speed searchable list of every entry for a module.
 *
 * No summaries, no insights. Just the raw table.
 * Find what you weighed on October 12th, 2024 in 2 seconds.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

export interface LedgerRow {
  id: string;
  date: string;
  value: string;
  loggedAt: string;
  sessionId: string | null;
}

export interface RawLedgerProps {
  entries: LedgerRow[];
  label?: string;
  unit?: string;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onSearch?: (query: string) => void;
}

export default function RawLedger({
  entries,
  label,
  unit,
  hasMore,
  onLoadMore,
  onSearch,
}: RawLedgerProps) {
  const { themeColors } = useTheme();
  const [search, setSearch] = useState('');

  const handleSearch = useCallback(
    (text: string) => {
      setSearch(text);
      onSearch?.(text);
    },
    [onSearch],
  );

  const renderItem = ({ item }: { item: LedgerRow }) => {
    // Try to format value nicely
    let displayValue = item.value;
    try {
      const parsed = JSON.parse(item.value);
      if (typeof parsed === 'number') {
        displayValue = `${parsed}${unit ? ` ${unit}` : ''}`;
      } else if (typeof parsed === 'boolean') {
        displayValue = parsed ? '✓' : '✗';
      } else if (typeof parsed === 'string') {
        displayValue = parsed;
      }
    } catch {
      // raw string
    }

    const time = item.loggedAt
      ? new Date(item.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <View style={[styles.row, { borderBottomColor: themeColors.border }]}>
        <View style={styles.dateCol}>
          <Text style={[styles.dateText, { color: themeColors.text }]}>{item.date}</Text>
          {time && <Text style={[styles.timeText, { color: themeColors.muted }]}>{time}</Text>}
        </View>
        <Text style={[styles.valueText, { color: themeColors.text }]} numberOfLines={1}>
          {displayValue}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
      <View style={styles.header}>
        {label && <Text style={[styles.label, { color: themeColors.text }]}>{label}</Text>}
        <Text style={[styles.count, { color: themeColors.muted }]}>{entries.length} entries</Text>
      </View>

      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
        <Feather name="search" size={14} color={themeColors.muted} />
        <TextInput
          style={[styles.searchInput, { color: themeColors.text }]}
          placeholder="Search entries..."
          placeholderTextColor={themeColors.muted}
          value={search}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search !== '' && (
          <Pressable onPress={() => handleSearch('')}>
            <Feather name="x" size={14} color={themeColors.muted} />
          </Pressable>
        )}
      </View>

      {/* Table header */}
      <View style={[styles.tableHeader, { borderBottomColor: themeColors.border }]}>
        <Text style={[styles.thDate, { color: themeColors.muted }]}>Date</Text>
        <Text style={[styles.thValue, { color: themeColors.muted }]}>Value</Text>
      </View>

      {/* Rows */}
      <FlatList
        data={entries}
        renderItem={renderItem}
        keyExtractor={(item: { id: string }) => item.id}
        style={styles.list}
        onEndReached={hasMore ? onLoadMore : undefined}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: themeColors.muted }]}>
            {search ? 'No matching entries' : 'No entries yet'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
    maxHeight: 420,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  count: {
    fontSize: fontSize.xs,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.sm,
    paddingVertical: 0,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingBottom: spacing.xs,
    marginBottom: spacing.xs,
  },
  thDate: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    width: 120,
  },
  thValue: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dateCol: {
    width: 120,
  },
  dateText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  timeText: {
    fontSize: fontSize.xs,
  },
  valueText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
