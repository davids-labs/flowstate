import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Switch, Alert, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { createModuleSpec, getModuleSpec, getRoutines } from '@flowstate/core';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

const MODULE_TYPES = [
  { value: 'countdown', label: 'Countdown', emoji: '⏳', desc: 'Count down to a target date' },
  { value: 'countup', label: 'Countup', emoji: '📈', desc: 'Count up from an origin date' },
  { value: 'checkbox', label: 'Checkbox', emoji: '✅', desc: 'Daily yes/no toggle' },
  { value: 'rating', label: 'Rating', emoji: '⭐', desc: 'Rate on a 1–5 scale' },
  { value: 'data_input', label: 'Data Input', emoji: '🔢', desc: 'Track a numeric value with target' },
  { value: 'text_note', label: 'Text Note', emoji: '📝', desc: 'Free-text daily capture' },
  { value: 'tally', label: 'Tally Counter', emoji: '🔄', desc: 'Simple +/- counter with persistence' },
  { value: 'photo_log', label: 'Photo Log', emoji: '📸', desc: 'Capture daily progress photos' },
  { value: 'progress_bar', label: 'Progress Bar', emoji: '📊', desc: 'Visual date-range progress' },
  { value: 'streak_counter', label: 'Streak', emoji: '🔥', desc: 'Track consecutive completions' },
  { value: 'group', label: 'Group', emoji: '📁', desc: 'Group related modules together' },
  { value: 'routine_launcher', label: 'Routine Launcher', emoji: '🚀', desc: 'Launch a timed routine from your homescreen' },
] as const;

const ALL_SURFACES = ['homescreen', 'day', 'session', 'plan', 'week'] as const;

export default function CreateModuleScreen() {
  const router = useRouter();
  const { db, isReady } = useDatabaseSafe();
  const { themeColors } = useTheme();

  const [step, setStep] = useState<'type' | 'config' | 'placements'>('type');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [emoji, setEmoji] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [required, setRequired] = useState(false);

  // Config fields
  const [targetDate, setTargetDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [originDate, setOriginDate] = useState('');
  const [unit, setUnit] = useState('');
  const [target, setTarget] = useState('');
  const [sourceModuleId, setSourceModuleId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [intention, setIntention] = useState('');
  const [groupChildren, setGroupChildren] = useState('');
  const [countupVariant, setCountupVariant] = useState<'standard' | 'last_seen'>('standard');
  const [resetOnModuleId, setResetOnModuleId] = useState('');
  const [routineIdInput, setRoutineIdInput] = useState('');
  const [availableRoutines, setAvailableRoutines] = useState<Array<{id: string; name: string; totalDurationMinutes: number}>>([]);

  // Load routines for routine_launcher picker
  useEffect(() => {
    if (selectedType === 'routine_launcher' && db) {
      getRoutines(db).then((r: any[]) => {
        setAvailableRoutines(r.filter((x: any) => !x.archivedAt).map((x: any) => ({
          id: x.id, name: x.name, totalDurationMinutes: x.totalDurationMinutes,
        })));
      }).catch(() => {});
    }
  }, [selectedType, db]);

  // Placements
  const [placements, setPlacements] = useState<string[]>(['day']);

  const togglePlacement = (s: string) => {
    setPlacements(prev => prev.includes(s) ? prev.filter(p => p !== s) : [...prev, s]);
  };

  const handleSelectType = (type: string) => {
    setSelectedType(type);
    const isLiveType = ['countdown', 'countup', 'progress_bar', 'streak_counter'].includes(type);
    setIsLive(isLiveType);
    if (type === 'group') setPlacements(['homescreen', 'day']);
    if (type === 'routine_launcher') setPlacements(['homescreen']);
    setStep('config');
  };

  const buildConfig = (): Record<string, unknown> => {
    if (!selectedType) return {};
    switch (selectedType) {
      case 'countdown':
        return {
          targetDate: targetDate || '2026-12-31',
          startDate: startDate || undefined,
          displayMode: 'auto',
          showProgressBar: !!startDate,
          intention: intention.trim() || undefined,
        };
      case 'countup':
        return {
          originDate: originDate || '2026-01-01',
          displayMode: 'auto',
          variant: countupVariant,
          resetOnModuleId: countupVariant === 'last_seen' ? (resetOnModuleId || undefined) : undefined,
        };
      case 'checkbox':
        return { resetDaily: true, streak: true };
      case 'rating':
        return { scale: 5, style: 'stars', resetDaily: true };
      case 'data_input':
        return {
          unit: unit || 'units',
          target: target ? Number(target) : undefined,
          resetDaily: true,
          cumulativeEntry: true,
        };
      case 'text_note':
        return { maxLength: 500, prompt: prompt || undefined, resetDaily: true };
      case 'progress_bar':
        return {
          startDate: startDate || '2026-01-01',
          endDate: targetDate || '2026-12-31',
          style: 'linear',
          showDaysRemaining: true,
          showPercentage: true,
        };
      case 'streak_counter':
        return {
          sourceModuleId: sourceModuleId || '',
          graceHours: 4,
          showBest: true,
        };
      case 'group':
        return {
          childModuleIds: groupChildren.split(',').map(s => s.trim()).filter(Boolean),
          collapsed: false,
        };
      case 'tally':
        return {
          step: target ? Number(target) : 1,
          resetDaily: true,
          target: undefined,
        };
      case 'photo_log':
        return {
          maxPhotosPerDay: 1,
          prompt: prompt || undefined,
          resetDaily: true,
        };
      case 'routine_launcher':
        return {
          routineId: routineIdInput || '',
          autoStartOnTap: false,
          showBlockPreview: true,
        };
      default:
        return {};
    }
  };

  const handleSave = async () => {
    if (!selectedType || !label.trim()) return;
    if (!db) {
      Alert.alert('Error', 'Database is not ready yet.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const baseId = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    let id = baseId || `mod_${Date.now()}`;

    // Ensure unique ID by checking DB and appending suffix if needed
    try {
      let suffix = 1;
      while (true) {
        const existing = await getModuleSpec(db, id);
        if (!existing) break;
        suffix++;
        id = `${baseId}-${suffix}`;
      }
    } catch (e) {
      console.warn('ID uniqueness check failed, proceeding with generated ID:', e);
    }

    const config = buildConfig();

    try {
      await createModuleSpec(db, {
        id,
        type: selectedType,
        label: label.trim(),
        emoji: emoji || undefined,
        config,
        placements,
        isLive,
        required,
      });
      router.canGoBack() ? router.back() : router.replace('/(tabs)');
    } catch (err) {
      console.error('Failed to save module:', err);
      Alert.alert('Error', 'Failed to create module. Please try again.');
    }
  };

  // Step 1: Type picker
  if (step === 'type') {
    return (
      <ScreenWrapper>
        <SectionHeader title="Choose Type" subtitle="What kind of module?" />
        {MODULE_TYPES.map(t => (
          <Pressable
            key={t.value}
            style={[styles.typeRow, { backgroundColor: themeColors.surface }]}
            onPress={() => handleSelectType(t.value)}
          >
            <Text style={styles.typeEmoji}>{t.emoji}</Text>
            <View style={styles.typeInfo}>
              <Text style={[styles.typeLabel, { color: themeColors.text }]}>{t.label}</Text>
              <Text style={[styles.typeDesc, { color: themeColors.muted }]}>{t.desc}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={themeColors.muted} />
          </Pressable>
        ))}
      </ScreenWrapper>
    );
  }

  // Step 2: Config form
  if (step === 'config') {
    return (
      <ScreenWrapper>
        <SectionHeader title="Configure" subtitle={MODULE_TYPES.find(t => t.value === selectedType)?.label} />

        <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Label *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: themeColors.surface, borderColor: themeColors.border, color: themeColors.text }]}
          placeholder="e.g. Holiday Countdown"
          placeholderTextColor={themeColors.muted}
          value={label}
          onChangeText={setLabel}
        />

        <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Emoji</Text>
        <TextInput
          style={[styles.input, { width: 60, backgroundColor: themeColors.surface, borderColor: themeColors.border, color: themeColors.text }]}
          placeholder="✈️"
          placeholderTextColor={themeColors.muted}
          value={emoji}
          onChangeText={setEmoji}
        />

        {/* Type-specific fields */}
        {(selectedType === 'countdown' || selectedType === 'progress_bar') && (
          <>
            <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Target Date (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.surface, borderColor: themeColors.border, color: themeColors.text }]}
              placeholder="2026-07-10"
              placeholderTextColor={themeColors.muted}
              value={targetDate}
              onChangeText={setTargetDate}
            />
            <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Start Date (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.surface, borderColor: themeColors.border, color: themeColors.text }]}
              placeholder="2026-01-01"
              placeholderTextColor={themeColors.muted}
              value={startDate}
              onChangeText={setStartDate}
            />
          </>
        )}

        {selectedType === 'countdown' && (
          <>
            <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Intention (optional)</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top', backgroundColor: themeColors.surface, borderColor: themeColors.border, color: themeColors.text }]}
              placeholder="Why does this countdown matter to you?"
              placeholderTextColor={themeColors.muted}
              value={intention}
              onChangeText={setIntention}
              multiline
            />
          </>
        )}

        {selectedType === 'countup' && (
          <>
            <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Origin Date (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.surface, borderColor: themeColors.border, color: themeColors.text }]}
              placeholder="2003-08-14"
              placeholderTextColor={themeColors.muted}
              value={originDate}
              onChangeText={setOriginDate}
            />

            <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Variant</Text>
            <View style={styles.variantRow}>
              <Pressable
                style={[styles.variantChip, { borderColor: themeColors.border }, countupVariant === 'standard' && { borderColor: themeColors.accent, backgroundColor: themeColors.accentLight }]}
                onPress={() => setCountupVariant('standard')}
              >
                <Text style={[styles.variantChipText, { color: themeColors.muted }, countupVariant === 'standard' && { color: themeColors.accent }]}>Standard</Text>
              </Pressable>
              <Pressable
                style={[styles.variantChip, { borderColor: themeColors.border }, countupVariant === 'last_seen' && { borderColor: themeColors.accent, backgroundColor: themeColors.accentLight }]}
                onPress={() => setCountupVariant('last_seen')}
              >
                <Text style={[styles.variantChipText, { color: themeColors.muted }, countupVariant === 'last_seen' && { color: themeColors.accent }]}>Last Seen</Text>
              </Pressable>
            </View>

            {countupVariant === 'last_seen' && (
              <>
                <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Reset when module changes (module ID)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.surface, borderColor: themeColors.border, color: themeColors.text }]}
                  placeholder="e.g. morning_check"
                  placeholderTextColor={themeColors.muted}
                  value={resetOnModuleId}
                  onChangeText={setResetOnModuleId}
                />
              </>
            )}
          </>
        )}

        {selectedType === 'data_input' && (
          <>
            <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Unit</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.surface, borderColor: themeColors.border, color: themeColors.text }]}
              placeholder="steps, ml, kg..."
              placeholderTextColor={themeColors.muted}
              value={unit}
              onChangeText={setUnit}
            />
            <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Daily Target</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.surface, borderColor: themeColors.border, color: themeColors.text }]}
              placeholder="10000"
              placeholderTextColor={themeColors.muted}
              value={target}
              onChangeText={setTarget}
              keyboardType="numeric"
            />
          </>
        )}

        {selectedType === 'text_note' && (
          <>
            <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Prompt (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.surface, borderColor: themeColors.border, color: themeColors.text }]}
              placeholder="What did you learn today?"
              placeholderTextColor={themeColors.muted}
              value={prompt}
              onChangeText={setPrompt}
            />
          </>
        )}

        {selectedType === 'streak_counter' && (
          <>
            <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Source Module ID</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.surface, borderColor: themeColors.border, color: themeColors.text }]}
              placeholder="skincare_am"
              placeholderTextColor={themeColors.muted}
              value={sourceModuleId}
              onChangeText={setSourceModuleId}
            />
          </>
        )}

        {selectedType === 'group' && (
          <>
            <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Child Module IDs (comma-separated)</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top', backgroundColor: themeColors.surface, borderColor: themeColors.border, color: themeColors.text }]}
              placeholder="skincare_am, hydration, sleep_rating"
              placeholderTextColor={themeColors.muted}
              value={groupChildren}
              onChangeText={setGroupChildren}
              multiline
            />
          </>
        )}

        {selectedType === 'routine_launcher' && (
          <>
            <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Select Routine *</Text>
            {availableRoutines.length === 0 ? (
              <View style={[styles.input, { paddingVertical: spacing.md, backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                <Text style={{ color: themeColors.muted, fontSize: fontSize.sm }}>
                  No routines found. Create a routine first.
                </Text>
              </View>
            ) : (
              availableRoutines.map(r => (
                <Pressable
                  key={r.id}
                  style={[
                    styles.placementRow,
                    { backgroundColor: themeColors.surface },
                    routineIdInput === r.id && { borderWidth: 1, borderColor: themeColors.accent },
                  ]}
                  onPress={() => setRoutineIdInput(r.id)}
                >
                  <Feather
                    name={routineIdInput === r.id ? 'check-circle' : 'circle'}
                    size={20}
                    color={routineIdInput === r.id ? themeColors.accent : themeColors.muted}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.placementLabel, { color: themeColors.text }]}>{r.name}</Text>
                    <Text style={{ fontSize: fontSize.xs, color: themeColors.muted }}>{r.totalDurationMinutes} min</Text>
                  </View>
                </Pressable>
              ))
            )}
          </>
        )}

        <View style={styles.switchRow}>
          <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Required</Text>
          <Switch value={required} onValueChange={setRequired} trackColor={{ true: themeColors.accent }} />
        </View>

        <Pressable style={[styles.nextBtn, { backgroundColor: themeColors.accent }]} onPress={() => setStep('placements')}>
          <Text style={[styles.nextBtnText, { color: themeColors.white }]}>Next: Placements →</Text>
        </Pressable>
      </ScreenWrapper>
    );
  }

  // Step 3: Placements
  return (
    <ScreenWrapper>
      <SectionHeader title="Placements" subtitle="Where should this module appear?" />

      {ALL_SURFACES.map(s => (
        <Pressable
          key={s}
          style={[styles.placementRow, { backgroundColor: themeColors.surface }, placements.includes(s) && { borderWidth: 1, borderColor: themeColors.accent }]}
          onPress={() => togglePlacement(s)}
        >
          <Feather
            name={placements.includes(s) ? 'check-square' : 'square'}
            size={20}
            color={placements.includes(s) ? themeColors.accent : themeColors.muted}
          />
          <Text style={[styles.placementLabel, { color: themeColors.text }]}>{s.charAt(0).toUpperCase() + s.slice(1)}</Text>
        </Pressable>
      ))}

      <View style={styles.actionRow}>
        <Pressable style={[styles.backBtn, { borderColor: themeColors.border }]} onPress={() => setStep('config')}>
          <Text style={[styles.backBtnText, { color: themeColors.text }]}>← Back</Text>
        </Pressable>
        <Pressable
          style={[styles.saveBtn, { backgroundColor: themeColors.accent }, (!label.trim() || placements.length === 0) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!label.trim() || placements.length === 0}
        >
          <Feather name="check" size={18} color={themeColors.white} />
          <Text style={[styles.saveBtnText, { color: themeColors.white }]}>Save Module</Text>
        </Pressable>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  typeEmoji: {
    fontSize: 28,
    marginRight: spacing.sm,
  },
  typeInfo: {
    flex: 1,
  },
  typeLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  typeDesc: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  input: {
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    padding: spacing.sm,
    fontSize: fontSize.md,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  nextBtn: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  nextBtnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  placementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  placementLabel: {
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  backBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  variantRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  variantChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  variantChipText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
});
