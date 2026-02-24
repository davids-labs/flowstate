import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Pressable, Switch, Alert, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { getModuleSpec, updateModuleSpec } from '@flowstate/core';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

const TYPE_LABELS: Record<string, string> = {
  countdown: 'Countdown',
  countup: 'Countup',
  checkbox: 'Checkbox',
  rating: 'Rating',
  data_input: 'Data Input',
  mandatory_session: 'Session',
  text_note: 'Text Note',
  progress_bar: 'Progress Bar',
  streak_counter: 'Streak',
  tally: 'Tally Counter',
  photo_log: 'Photo Log',
  group: 'Group',
  routine_launcher: 'Routine Launcher',
};

const ALL_SURFACES = ['homescreen', 'day', 'session', 'plan', 'week'] as const;

export default function EditModuleScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, isReady } = useDatabaseSafe();
  const { themeColors } = useTheme();

  const [step, setStep] = useState<'config' | 'placements'>('config');
  const [loading, setLoading] = useState(true);
  const [moduleType, setModuleType] = useState('');
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

  // Placements
  const [placements, setPlacements] = useState<string[]>(['day']);

  // Load existing module data
  useEffect(() => {
    if (!db || !isReady || !id) return;
    (async () => {
      try {
        const spec = await getModuleSpec(db, id);
        if (!spec) {
          Alert.alert('Error', 'Module not found');
          router.canGoBack() ? router.back() : router.replace('/(tabs)');
          return;
        }

        setModuleType(spec.type);
        setLabel(spec.label ?? '');
        setEmoji(spec.emoji ?? '');
        setIsLive(!!spec.isLive);
        setRequired(!!spec.required);
        setPlacements(Array.isArray(spec.placements) ? spec.placements : ['day']);

        const config = spec.config ?? {};
        if (config.targetDate) setTargetDate(config.targetDate);
        if (config.startDate) setStartDate(config.startDate);
        if (config.originDate) setOriginDate(config.originDate);
        if (config.unit) setUnit(config.unit);
        if (config.target !== undefined) setTarget(String(config.target));
        if (config.sourceModuleId) setSourceModuleId(config.sourceModuleId);
        if (config.prompt) setPrompt(config.prompt);
        if (config.intention) setIntention(config.intention);
        if (config.childModuleIds) setGroupChildren(config.childModuleIds.join(', '));
        if (config.variant) setCountupVariant(config.variant);
        if (config.resetOnModuleId) setResetOnModuleId(config.resetOnModuleId);
        if (spec.type === 'tally' && config.step) setTarget(String(config.step));
      } catch (err) {
        console.error('Failed to load module for editing:', err);
        Alert.alert('Error', 'Failed to load module');
        router.canGoBack() ? router.back() : router.replace('/(tabs)');
      } finally {
        setLoading(false);
      }
    })();
  }, [db, isReady, id]);

  const togglePlacement = (s: string) => {
    setPlacements(prev => prev.includes(s) ? prev.filter(p => p !== s) : [...prev, s]);
  };

  const buildConfig = (): Record<string, unknown> => {
    switch (moduleType) {
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
      default:
        return {};
    }
  };

  const handleSave = async () => {
    if (!label.trim()) return;
    if (!db || !id) {
      Alert.alert('Error', 'Database is not ready yet.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const config = buildConfig();

    try {
      await updateModuleSpec(db, id, {
        label: label.trim(),
        emoji: emoji || undefined,
        config,
        placements,
        isLive,
        required,
      });
      router.canGoBack() ? router.back() : router.replace('/(tabs)');
    } catch (err) {
      console.error('Failed to update module:', err);
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    }
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <Text style={[styles.loadingText, { color: themeColors.muted }]}>Loading module...</Text>
      </ScreenWrapper>
    );
  }

  // Step 1: Config form
  if (step === 'config') {
    return (
      <ScreenWrapper>
        <SectionHeader title="Edit Module" subtitle={TYPE_LABELS[moduleType] ?? moduleType} />

        <View style={styles.typeBadgeRow}>
          <View style={[styles.typeBadge, { backgroundColor: themeColors.accentLight }]}>
            <Text style={[styles.typeBadgeText, { color: themeColors.accent }]}>{TYPE_LABELS[moduleType] ?? moduleType}</Text>
          </View>
          <Text style={[styles.typeHint, { color: themeColors.muted }]}>Type cannot be changed</Text>
        </View>

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
        {(moduleType === 'countdown' || moduleType === 'progress_bar') && (
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

        {moduleType === 'countdown' && (
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

        {moduleType === 'countup' && (
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

        {moduleType === 'data_input' && (
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

        {moduleType === 'text_note' && (
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

        {moduleType === 'streak_counter' && (
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

        {moduleType === 'group' && (
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

        {moduleType === 'tally' && (
          <>
            <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Step (increment amount)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.surface, borderColor: themeColors.border, color: themeColors.text }]}
              placeholder="1"
              placeholderTextColor={themeColors.muted}
              value={target}
              onChangeText={setTarget}
              keyboardType="numeric"
            />
          </>
        )}

        {moduleType === 'photo_log' && (
          <>
            <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Photo prompt (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.surface, borderColor: themeColors.border, color: themeColors.text }]}
              placeholder="Take a progress photo"
              placeholderTextColor={themeColors.muted}
              value={prompt}
              onChangeText={setPrompt}
            />
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

  // Step 2: Placements
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
          <Text style={[styles.saveBtnText, { color: themeColors.white }]}>Save Changes</Text>
        </Pressable>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  loadingText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    paddingVertical: spacing.xxl,
  },
  typeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  typeBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  typeBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  typeHint: {
    fontSize: fontSize.xs,
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
