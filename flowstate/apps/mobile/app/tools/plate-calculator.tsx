/**
 * Feature 10 - Plate Calculator
 *
 * Accessible from the Gym stats screen and as a floating tool within
 * any active gym session. Takes a target weight and bar weight, outputs
 * the plates to load on each side, and generates warm-up sets at 50%,
 * 70%, and 90% of working weight.
 *
 * Unit system: kg / lb toggle. Defaults to kg.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

// ─── Plate sets ────────────────────────────────────────────────

const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const LB_PLATES = [45, 35, 25, 10, 5, 2.5];

const DEFAULT_BAR_KG = 20;
const DEFAULT_BAR_LB = 45;

interface PlateRow {
  plate: number;
  count: number;
}

function calculatePlates(targetWeight: number, barWeight: number, plates: number[]): PlateRow[] {
  const sideWeight = (targetWeight - barWeight) / 2;
  if (sideWeight <= 0) return [];

  let remaining = sideWeight;
  const result: PlateRow[] = [];

  for (const plate of plates) {
    if (remaining <= 0) break;
    const count = Math.floor(remaining / plate);
    if (count > 0) {
      result.push({ plate, count });
      remaining -= count * plate;
      remaining = Math.round(remaining * 1000) / 1000; // floating point guard
    }
  }

  return result;
}

interface WarmupSet {
  pct: number;
  weight: number;
  plates: PlateRow[];
}

function generateWarmups(targetWeight: number, barWeight: number, plates: number[]): WarmupSet[] {
  const pcts = [0.5, 0.7, 0.9];
  return pcts.map((pct) => {
    const weight = Math.round((targetWeight * pct) / 2.5) * 2.5; // round to nearest 2.5
    return {
      pct,
      weight,
      plates: calculatePlates(weight, barWeight, plates),
    };
  });
}

export default function PlateCalculatorScreen() {
  const { themeColors } = useTheme();
  const router = useRouter();

  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
  const [targetInput, setTargetInput] = useState('');
  const [barInput, setBarInput] = useState('');

  const plates = unit === 'kg' ? KG_PLATES : LB_PLATES;
  const defaultBar = unit === 'kg' ? DEFAULT_BAR_KG : DEFAULT_BAR_LB;

  const targetWeight = parseFloat(targetInput) || 0;
  const barWeight = parseFloat(barInput) || defaultBar;

  const workingPlates = calculatePlates(targetWeight, barWeight, plates);
  const totalLoaded = workingPlates.reduce((sum, r) => sum + r.plate * r.count * 2, 0) + barWeight;
  const warmups = targetWeight > 0 ? generateWarmups(targetWeight, barWeight, plates) : [];

  const handleUnitToggle = useCallback(() => {
    setUnit((u) => {
      const next = u === 'kg' ? 'lb' : 'kg';
      setBarInput('');
      return next;
    });
  }, []);

  const PLATE_COLORS: Record<number, string> = unit === 'kg'
    ? { 25: '#ef4444', 20: '#3b82f6', 15: '#f59e0b', 10: '#22c55e', 5: '#ffffff', 2.5: '#a855f7', 1.25: '#64748b' }
    : { 45: '#ef4444', 35: '#3b82f6', 25: '#f59e0b', 10: '#22c55e', 5: '#ffffff', 2.5: '#a855f7' };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: themeColors.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
          <Feather name="arrow-left" size={22} color={themeColors.text} />
        </Pressable>
        <Text style={[styles.title, { color: themeColors.text }]}>Plate Calculator</Text>
        <Pressable
          style={[styles.unitToggle, { backgroundColor: themeColors.surface }]}
          onPress={handleUnitToggle}
        >
          <Text style={[styles.unitToggleText, { color: themeColors.accent }]}>{unit.toUpperCase()}</Text>
        </Pressable>
      </View>

      {/* Inputs */}
      <View style={[styles.inputCard, { backgroundColor: themeColors.surface }]}>
        <View style={styles.inputRow}>
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: themeColors.muted }]}>Target Weight</Text>
            <View style={[styles.inputBox, { borderColor: themeColors.surfaceBorder }]}>
              <TextInput
                style={[styles.input, { color: themeColors.text }]}
                value={targetInput}
                onChangeText={setTargetInput}
                keyboardType="decimal-pad"
                placeholder={`e.g. ${unit === 'kg' ? '100' : '225'}`}
                placeholderTextColor={themeColors.muted}
              />
              <Text style={[styles.unitLabel, { color: themeColors.muted }]}>{unit}</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: themeColors.muted }]}>Bar Weight</Text>
            <View style={[styles.inputBox, { borderColor: themeColors.surfaceBorder }]}>
              <TextInput
                style={[styles.input, { color: themeColors.text }]}
                value={barInput}
                onChangeText={setBarInput}
                keyboardType="decimal-pad"
                placeholder={String(defaultBar)}
                placeholderTextColor={themeColors.muted}
              />
              <Text style={[styles.unitLabel, { color: themeColors.muted }]}>{unit}</Text>
            </View>
          </View>
        </View>

        {targetWeight > 0 && (
          <View style={[styles.totalRow, { backgroundColor: themeColors.accentLight }]}>
            <Text style={[styles.totalLabel, { color: themeColors.accent }]}>
              Loaded bar total
            </Text>
            <Text style={[styles.totalValue, { color: themeColors.accent }]}>
              {totalLoaded.toFixed(1)} {unit}
            </Text>
          </View>
        )}
      </View>

      {/* Working weight plates */}
      {targetWeight > 0 && (
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            Working Weight — {targetWeight} {unit} per side
          </Text>
          {workingPlates.length === 0 ? (
            <Text style={[styles.noPlatesText, { color: themeColors.muted }]}>
              {targetWeight <= barWeight
                ? 'Target ≤ bar weight — no plates needed.'
                : 'Cannot make exact weight with standard plates.'}
            </Text>
          ) : (
            <View style={styles.plateVisual}>
              {/* Bar central line */}
              <View style={[styles.barLine, { backgroundColor: themeColors.surfaceBorder }]} />
              <View style={styles.plateStack}>
                {workingPlates.map((row) =>
                  Array.from({ length: row.count }).map((_, i) => (
                    <View
                      key={`${row.plate}-${i}`}
                      style={[styles.plateSlab, {
                        backgroundColor: PLATE_COLORS[row.plate] ?? themeColors.muted,
                        height: Math.max(28, row.plate * 1.4),
                      }]}
                    >
                      <Text style={styles.plateSlabText}>{row.plate}</Text>
                    </View>
                  ))
                )}
              </View>
              {/* Text summary */}
              <View style={styles.plateSummary}>
                {workingPlates.map((row) => (
                  <View key={row.plate} style={styles.plateRow}>
                    <View style={[styles.plateColorDot, { backgroundColor: PLATE_COLORS[row.plate] ?? themeColors.muted }]} />
                    <Text style={[styles.plateSummaryText, { color: themeColors.text }]}>
                      {row.count} × {row.plate} {unit}
                    </Text>
                    <Text style={[styles.plateSummaryBoth, { color: themeColors.muted }]}>
                      ({row.count * 2} total)
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Warm-up sets */}
      {warmups.length > 0 && (
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Warm-Up Sets</Text>
          {warmups.map((w) => (
            <View key={w.pct} style={[styles.warmupRow, { borderBottomColor: themeColors.surfaceBorder }]}>
              <View style={styles.warmupLeft}>
                <Text style={[styles.warmupPct, { color: themeColors.accent }]}>{Math.round(w.pct * 100)}%</Text>
                <Text style={[styles.warmupWeight, { color: themeColors.text }]}>{w.weight} {unit}</Text>
              </View>
              <View style={styles.warmupPlates}>
                {w.plates.length === 0 ? (
                  <Text style={[styles.warmupEmpty, { color: themeColors.muted }]}>Bar only</Text>
                ) : (
                  <Text style={[styles.warmupPlateText, { color: themeColors.text }]}>
                    {w.plates.map((p) => `${p.count}×${p.plate}`).join(' + ')} each side
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Bottom padding */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  backBtn: {
    padding: spacing.xs,
  },
  title: {
    flex: 1,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  unitToggle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.lg,
  },
  unitToggleText: {
    fontWeight: '800',
    fontSize: fontSize.md,
  },
  inputCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  inputGroup: {
    flex: 1,
    gap: 6,
  },
  inputLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: fontSize.xl,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  unitLabel: {
    fontSize: fontSize.sm,
    marginLeft: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  totalLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  section: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  noPlatesText: {
    fontSize: fontSize.md,
    fontStyle: 'italic',
  },
  plateVisual: {
    gap: spacing.md,
  },
  barLine: {
    height: 2,
    width: '100%',
    borderRadius: 1,
  },
  plateStack: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateSlab: {
    width: 48,
    minHeight: 28,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateSlabText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '700',
  },
  plateSummary: {
    gap: spacing.xs,
  },
  plateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  plateColorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  plateSummaryText: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  plateSummaryBoth: {
    fontSize: fontSize.sm,
  },
  warmupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  warmupLeft: {
    width: 80,
  },
  warmupPct: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  warmupWeight: {
    fontSize: fontSize.md,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  warmupPlates: {
    flex: 1,
  },
  warmupEmpty: {
    fontSize: fontSize.sm,
    fontStyle: 'italic',
  },
  warmupPlateText: {
    fontSize: fontSize.sm,
  },
});
