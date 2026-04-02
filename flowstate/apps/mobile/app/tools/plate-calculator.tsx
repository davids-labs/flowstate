/**
 * Plate Calculator — V2 spec §9.3
 *
 * Large numeric target weight input (centred, auto-focused).
 * Bar weight row below.
 * Coloured plate stack output (per side).
 * Warm-up table: 50% · 70% · 90%.
 * kg / lb pill toggle in header.
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { space, radius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';
import { AppText } from '../../components/primitives/Text';
import { useUserPrefsStore } from '../../stores/userPrefsStore';

// ─── Config ───────────────────────────────────────────────────────────────────
const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const LB_PLATES = [45, 35, 25, 10, 5, 2.5];
const DEFAULT_BAR_KG = 20;
const DEFAULT_BAR_LB = 45;

const PLATE_COLOURS: Record<number, string> = {
  25: '#E53E3E', // Red 25kg / 25lb
  45: '#E53E3E', // Red 45lb
  20: '#3B82F6', // Blue 20kg
  35: '#3182CE', // Blue 35lb
  15: '#F59E0B', // Yellow 15kg
  10: '#22C55E', // Green 10kg
  5: '#9CA3AF',  // Grey 5kg/lb
  2.5: '#B45309', // Bronze 2.5kg/lb
  1.25: '#6B7280', // Dark grey 1.25kg
};

function plateColor(plate: number): string {
  return PLATE_COLOURS[plate] ?? '#6B7280';
}

interface PlateRow {
  plate: number;
  count: number;
}

function calculatePlates(
  target: number,
  bar: number,
  availablePlates: number[],
): PlateRow[] {
  const side = (target - bar) / 2;
  if (side <= 0) return [];
  let rem = side;
  const result: PlateRow[] = [];
  for (const p of availablePlates) {
    const count = Math.floor(rem / p + 0.001);
    if (count > 0) {
      result.push({ plate: p, count });
      rem = Math.round((rem - count * p) * 1000) / 1000;
    }
  }
  return result;
}

function generateWarmups(target: number, bar: number, availablePlates: number[]) {
  return [0.5, 0.7, 0.9].map((pct) => {
    const w = Math.round((target * pct) / 2.5) * 2.5;
    return {
      pct,
      weight: w,
      plates: calculatePlates(w, bar, availablePlates),
    };
  });
}

// ─── Plate stack visual ───────────────────────────────────────────────────────
function PlateStack({ rows }: { rows: PlateRow[] }) {
  if (rows.length === 0) return null;
  const allPlates: number[] = [];
  for (const r of rows) {
    for (let i = 0; i < r.count; i++) allPlates.push(r.plate);
  }
  return (
    <View style={PS.row}>
      {allPlates.map((p, i) => (
        <View
          key={i}
          style={[
            PS.plate,
            {
              backgroundColor: plateColor(p),
              height: Math.max(20, 14 + p * 0.5),
              width: Math.max(20, p * 0.7),
            },
          ]}
        >
          <AppText variant="caption2" style={{ color: '#fff', fontWeight: '700' }}>
            {p}
          </AppText>
        </View>
      ))}
    </View>
  );
}
const PS = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    justifyContent: 'center',
    minHeight: 40,
    flexWrap: 'wrap',
  },
  plate: {
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function PlateCalculatorScreen() {
  const { themeTokens } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const getPillarColour = useUserPrefsStore((s) => s.getPillarColour);
  const gymColor = getPillarColour('gym');

  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
  const [targetInput, setTargetInput] = useState('');
  const [barInput, setBarInput] = useState('');
  const targetRef = useRef<TextInput>(null);

  const plates = unit === 'kg' ? KG_PLATES : LB_PLATES;
  const defaultBar = unit === 'kg' ? DEFAULT_BAR_KG : DEFAULT_BAR_LB;
  const target = parseFloat(targetInput) || 0;
  const bar = parseFloat(barInput) || defaultBar;

  const workingPlates = target >= bar ? calculatePlates(target, bar, plates) : [];
  const totalLoaded =
    workingPlates.reduce((s, r) => s + r.plate * r.count * 2, 0) + bar;
  const warmups = target > 0 ? generateWarmups(target, bar, plates) : [];

  const handleUnitToggle = (next: 'kg' | 'lb') => {
    setUnit(next);
    setBarInput('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: themeTokens.background }}
    >
      {/* Header */}
      <View
        style={[
          HDR.wrap,
          {
            paddingTop: insets.top + space[8],
            backgroundColor: themeTokens.background,
            borderBottomColor: themeTokens.border,
          },
        ]}
      >
        <Pressable
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/(tabs)')
          }
          hitSlop={12}
        >
          <Feather name="arrow-left" size={22} color={themeTokens.textPrimary} />
        </Pressable>
        <AppText
          variant="title1"
          style={{ fontWeight: '700', flex: 1, marginLeft: space[12] }}
        >
          Plate Calculator
        </AppText>
        {/* Unit pill toggle */}
        <View
          style={[
            HDR.unitWrap,
            {
              backgroundColor: themeTokens.surface,
              borderColor: themeTokens.border,
            },
          ]}
        >
          {(['kg', 'lb'] as const).map((u) => (
            <Pressable
              key={u}
              style={[
                HDR.unitBtn,
                unit === u && { backgroundColor: gymColor },
              ]}
              onPress={() => handleUnitToggle(u)}
            >
              <AppText
                variant="caption1"
                style={{
                  fontWeight: '600',
                  color: unit === u ? '#fff' : themeTokens.textSecondary,
                }}
              >
                {u}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Target weight input */}
        <Pressable style={TI.area} onPress={() => targetRef.current?.focus()}>
          <AppText
            variant="footnote"
            color={themeTokens.textTertiary}
            style={{ textAlign: 'center' }}
          >
            {`TARGET WEIGHT (${unit.toUpperCase()})`}
          </AppText>
          <TextInput
            ref={targetRef}
            style={[TI.input, { color: themeTokens.textPrimary }]}
            value={targetInput}
            onChangeText={setTargetInput}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={themeTokens.textTertiary}
            autoFocus
            textAlign="center"
          />
        </Pressable>

        {/* Bar weight row */}
        <View
          style={[
            BW.row,
            {
              backgroundColor: themeTokens.surface,
              borderColor: themeTokens.border,
              marginHorizontal: space[16],
            },
          ]}
        >
          <AppText
            variant="subheadline"
            color={themeTokens.textSecondary}
            style={{ flex: 1 }}
          >
            Bar weight
          </AppText>
          <TextInput
            style={[
              BW.input,
              {
                color: themeTokens.textPrimary,
                borderColor: themeTokens.border,
                backgroundColor: themeTokens.surfaceElevated,
              },
            ]}
            value={barInput}
            onChangeText={setBarInput}
            keyboardType="decimal-pad"
            placeholder={String(defaultBar)}
            placeholderTextColor={themeTokens.textTertiary}
            textAlign="right"
          />
          <AppText variant="footnote" color={themeTokens.textTertiary}>
            {unit}
          </AppText>
        </View>

        {target > 0 && (
          <>
            {/* Plate stack card */}
            <View
              style={[
                CARD.wrap,
                {
                  backgroundColor: themeTokens.surfaceElevated,
                  borderColor: themeTokens.border,
                  marginHorizontal: space[16],
                  marginTop: space[20],
                },
              ]}
            >
              <View style={[CARD.stripe, { backgroundColor: gymColor }]} />
              <View style={CARD.body}>
                <AppText
                  variant="caption1"
                  color={themeTokens.textTertiary}
                  style={{ marginBottom: space[12] }}
                >
                  PLATES PER SIDE
                </AppText>
                {workingPlates.length > 0 ? (
                  <>
                    <PlateStack rows={workingPlates} />
                    <View style={{ marginTop: space[12], gap: space[4] }}>
                      {workingPlates.map((r) => (
                        <View
                          key={r.plate}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: space[8],
                          }}
                        >
                          <View
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: 2,
                              backgroundColor: plateColor(r.plate),
                            }}
                          />
                          <AppText
                            variant="footnote"
                            style={{ fontWeight: '600', flex: 1 }}
                          >
                            {r.plate}
                            {unit} × {r.count}
                          </AppText>
                          <AppText
                            variant="footnote"
                            color={themeTokens.textTertiary}
                          >
                            {r.plate * r.count}
                            {unit} per side
                          </AppText>
                        </View>
                      ))}
                    </View>
                  </>
                ) : (
                  <AppText variant="footnote" color={themeTokens.textTertiary}>
                    Target ≤ bar weight — no plates needed.
                  </AppText>
                )}
                <View
                  style={{
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: themeTokens.border,
                    marginTop: space[12],
                    paddingTop: space[12],
                  }}
                >
                  <AppText variant="subheadline" style={{ fontWeight: '600' }}>
                    Total on bar: {totalLoaded}
                    {unit}
                  </AppText>
                </View>
              </View>
            </View>

            {/* Warm-up table */}
            {warmups.length > 0 && (
              <View
                style={[
                  CARD.wrap,
                  {
                    backgroundColor: themeTokens.surfaceElevated,
                    borderColor: themeTokens.border,
                    marginHorizontal: space[16],
                    marginTop: space[16],
                  },
                ]}
              >
                <View
                  style={[CARD.stripe, { backgroundColor: themeTokens.accent }]}
                />
                <View style={CARD.body}>
                  <AppText
                    variant="caption1"
                    color={themeTokens.textTertiary}
                    style={{ marginBottom: space[12] }}
                  >
                    WARM-UP SETS
                  </AppText>
                  {warmups.map((w, i) => (
                    <View
                      key={w.pct}
                      style={[
                        WU.row,
                        i < warmups.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: themeTokens.border,
                        },
                      ]}
                    >
                      <AppText
                        variant="subheadline"
                        style={{ fontWeight: '700', width: 44, color: gymColor }}
                      >
                        {Math.round(w.pct * 100)}%
                      </AppText>
                      <AppText
                        variant="subheadline"
                        style={{ fontWeight: '600', flex: 1 }}
                      >
                        {w.weight}
                        {unit}
                      </AppText>
                      <AppText
                        variant="footnote"
                        color={themeTokens.textSecondary}
                      >
                        {w.plates.map((r) => `${r.plate}×${r.count}`).join('  ') ||
                          'bar only'}
                      </AppText>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {/* Empty prompt */}
        {target === 0 && (
          <View style={{ alignItems: 'center', paddingTop: space[48] }}>
            <Feather name="tool" size={36} color={themeTokens.textTertiary} />
            <AppText
              variant="body"
              color={themeTokens.textTertiary}
              style={{ textAlign: 'center', marginTop: space[12] }}
            >
              Enter a target weight above.
            </AppText>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const HDR = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[16],
    paddingBottom: space[12],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  unitWrap: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  unitBtn: {
    paddingHorizontal: space[12],
    paddingVertical: space[8],
  },
});
const TI = StyleSheet.create({
  area: { alignItems: 'center', paddingTop: space[32], paddingBottom: space[16] },
  input: {
    fontSize: 64,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 80,
    minWidth: 120,
    textAlign: 'center',
  },
});
const BW = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    padding: space[16],
    borderRadius: radius.md,
    borderWidth: 1,
  },
  input: {
    width: 80,
    padding: space[8],
    borderRadius: radius.sm,
    borderWidth: 1,
    fontSize: 16,
    fontWeight: '500',
  },
});
const CARD = StyleSheet.create({
  wrap: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  stripe: { height: 4 },
  body: { padding: space[16] },
});
const WU = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[12],
    gap: space[8],
  },
});
