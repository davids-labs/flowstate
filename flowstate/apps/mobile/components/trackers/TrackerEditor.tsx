import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  TRACKER_KINDS,
  createTracker,
  createTrackerReminder,
  createTrackerSchedule,
  deleteTrackerReminder,
  deleteTrackerSchedule,
  getCollections,
  getDefaultTrackerConfig,
  getDefaultTrackerPinRules,
  getRemindersForTracker,
  getRoutines,
  getSchedulesForTracker,
  getTracker,
  getTrackers,
  getTrackerRegistryItem,
  updateTracker,
  type TrackerKind,
  type TrackerPinRule,
  type TrackerSpec,
} from '@flowstate/core';
import { useDatabaseSafe } from '../DatabaseProvider';
import { useTheme } from '../../constants/ThemeContext';
import { radius, space } from '../../constants/theme';
import { AppText } from '../primitives/Text';
import { FormCard, FormChip, FormSection, FormTextField } from '../primitives/Form';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const SURFACES = ['today', 'session', 'widget'] as const;
const SIZES = ['compact', 'wide', 'full'] as const;
const QUICK_ACTION_TYPES = ['none', 'toggle', 'increment', 'decrement', 'set_number', 'set_text', 'set_boolean'] as const;

type ScheduleDraft = {
  daysOfWeek: number[];
  timeOfDay: string;
  enabled: boolean;
};

type ReminderDraft = {
  daysOfWeek: number[];
  time: string;
  message: string;
  enabled: boolean;
};

function csvToNumbers(value: string): number[] {
  return value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isFinite(part));
}

function numbersToCsv(value: unknown): string {
  return Array.isArray(value) ? value.join(', ') : '';
}

function parseAggregateInputs(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [trackerId, weight] = line.split(':');
      return {
        trackerId: trackerId?.trim() ?? '',
        weight: Number(weight ?? 1) || 1,
      };
    })
    .filter((input) => input.trackerId);
}

function aggregateInputsToText(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return value
    .map((item: any) => `${item.trackerId}:${item.weight ?? 1}`)
    .join('\n');
}

function normalizePinRule(kind: TrackerKind, rule?: TrackerPinRule): TrackerPinRule | undefined {
  if (!rule?.enabled) return undefined;
  const registry = getTrackerRegistryItem(kind);
  const nextRule: TrackerPinRule = {
    enabled: true,
    order: rule.order,
    size: rule.size ?? 'compact',
  };
  if (registry.capabilities.supportsQuickAction && rule.quickAction) {
    nextRule.quickAction = {
      type: rule.quickAction.type as any,
      label: rule.quickAction.label,
      amount: rule.quickAction.amount,
      value: rule.quickAction.value,
    };
  }
  return nextRule;
}

function TrackerSourcePicker({
  label,
  trackers,
  selectedId,
  onSelect,
}: {
  label: string;
  trackers: TrackerSpec[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={{ gap: space[8] }}>
      <AppText variant="caption1" style={{ textTransform: 'uppercase', letterSpacing: 0.7 }}>
        {label}
      </AppText>
      <View style={styles.chipWrap}>
        {trackers.map((tracker) => (
          <FormChip
            key={tracker.id}
            label={tracker.label}
            selected={selectedId === tracker.id}
            onPress={() => onSelect(tracker.id)}
          />
        ))}
      </View>
    </View>
  );
}

export function TrackerEditor({ trackerId }: { trackerId?: string }) {
  const router = useRouter();
  const { db } = useDatabaseSafe();
  const { themeTokens } = useTheme();
  const [loading, setLoading] = useState(Boolean(trackerId));
  const [kind, setKind] = useState<TrackerKind>('habit');
  const [label, setLabel] = useState('');
  const [emoji, setEmoji] = useState('');
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [config, setConfig] = useState<Record<string, any>>(getDefaultTrackerConfig('habit'));
  const [pinRules, setPinRules] = useState<Record<string, any>>(getDefaultTrackerPinRules('habit'));
  const [collections, setCollections] = useState<any[]>([]);
  const [trackers, setTrackers] = useState<TrackerSpec[]>([]);
  const [routines, setRoutines] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<ScheduleDraft[]>([]);
  const [reminders, setReminders] = useState<ReminderDraft[]>([]);
  const isEditing = Boolean(trackerId);
  const registry = useMemo(() => getTrackerRegistryItem(kind), [kind]);

  useEffect(() => {
    if (!db) return;
    let mounted = true;
    (async () => {
      const [nextCollections, nextTrackers, nextRoutines] = await Promise.all([
        getCollections(db),
        getTrackers(db, { includeArchived: false }),
        getRoutines(db),
      ]);
      if (!mounted) return;
      setCollections(nextCollections);
      setTrackers(nextTrackers);
      setRoutines(nextRoutines);
    })().catch((error) => console.error('Failed to load tracker editor options', error));
    return () => {
      mounted = false;
    };
  }, [db]);

  useEffect(() => {
    if (!db || !trackerId) return;
    let mounted = true;
    (async () => {
      const [tracker, trackerSchedules, trackerReminders] = await Promise.all([
        getTracker(db, trackerId),
        getSchedulesForTracker(db, trackerId),
        getRemindersForTracker(db, trackerId),
      ]);
      if (!mounted || !tracker) return;
      setKind(tracker.kind);
      setLabel(tracker.label);
      setEmoji(tracker.emoji ?? '');
      setCollectionId(tracker.collectionId ?? null);
      setConfig(tracker.config ?? {});
      setPinRules(tracker.pinRules ?? {});
      setSchedules(
        trackerSchedules.map((schedule) => ({
          daysOfWeek: schedule.daysOfWeek ?? [],
          timeOfDay: schedule.timeOfDay ?? '',
          enabled: Boolean(schedule.enabled),
        })),
      );
      setReminders(
        trackerReminders.map((reminder) => ({
          daysOfWeek: reminder.daysOfWeek ?? [],
          time: reminder.time ?? '',
          message: reminder.message ?? '',
          enabled: Boolean(reminder.enabled),
        })),
      );
      setLoading(false);
    })().catch((error) => {
      console.error('Failed to load tracker editor data', error);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [db, trackerId]);

  const changeConfig = (key: string, value: unknown) => {
    setConfig((current) => ({ ...current, [key]: value }));
  };

  const changePinRule = (surface: (typeof SURFACES)[number], patch: Partial<TrackerPinRule>) => {
    setPinRules((current: any) => ({
      ...current,
      [surface]: {
        enabled: false,
        size: 'compact',
        ...(current?.[surface] ?? {}),
        ...patch,
      },
    }));
  };

  const toggleDays = (
    setList: React.Dispatch<React.SetStateAction<any[]>>,
    index: number,
    day: number,
  ) => {
    setList((current) =>
      current.map((item, currentIndex) =>
        currentIndex !== index
          ? item
          : {
              ...item,
              daysOfWeek: item.daysOfWeek.includes(day)
                ? item.daysOfWeek.filter((value: number) => value !== day)
                : [...item.daysOfWeek, day].sort(),
            },
      ),
    );
  };

  const saveTracker = async () => {
    if (!db || !label.trim()) return;
    try {
      const nextConfig: Record<string, any> = { ...config };
      if (kind === 'countdown' && typeof nextConfig.alertDays === 'string') nextConfig.alertDays = csvToNumbers(nextConfig.alertDays);
      if (kind === 'metric' && typeof nextConfig.presetValues === 'string') nextConfig.presetValues = csvToNumbers(nextConfig.presetValues);
      if (kind === 'counter' && typeof nextConfig.presets === 'string') nextConfig.presets = csvToNumbers(nextConfig.presets);
      if (kind === 'aggregate' && typeof nextConfig.inputs === 'string') nextConfig.inputs = parseAggregateInputs(nextConfig.inputs);

      const nextPinRules = Object.fromEntries(
        SURFACES.map((surface) => [surface, normalizePinRule(kind, pinRules?.[surface])]).filter(([, value]) => Boolean(value)),
      );

      const id = isEditing && trackerId
        ? trackerId
        : await createTracker(db, {
            kind,
            label: label.trim(),
            emoji: emoji.trim() || null,
            config: nextConfig,
            collectionId,
            pinRules: nextPinRules,
          });

      if (isEditing && trackerId) {
        await updateTracker(db, trackerId, {
          label: label.trim(),
          emoji: emoji.trim() || null,
          config: nextConfig,
          collectionId,
          pinRules: nextPinRules,
        });
      }

      const [existingSchedules, existingReminders] = await Promise.all([
        getSchedulesForTracker(db, id),
        getRemindersForTracker(db, id),
      ]);

      await Promise.all(existingSchedules.map((schedule) => deleteTrackerSchedule(db, schedule.id)));
      await Promise.all(existingReminders.map((reminder) => deleteTrackerReminder(db, reminder.id)));

      for (const schedule of schedules.filter((item) => item.daysOfWeek.length > 0)) {
        await createTrackerSchedule(db, {
          trackerId: id,
          daysOfWeek: schedule.daysOfWeek,
          timeOfDay: schedule.timeOfDay || null,
          enabled: schedule.enabled,
        });
      }

      for (const reminder of reminders.filter((item) => item.daysOfWeek.length > 0 && item.time.trim())) {
        await createTrackerReminder(db, {
          trackerId: id,
          daysOfWeek: reminder.daysOfWeek,
          time: reminder.time.trim(),
          message: reminder.message.trim() || null,
          enabled: reminder.enabled,
        });
      }

      router.replace(`/trackers/${id}` as any);
    } catch (error) {
      console.error('Failed to save tracker', error);
      Alert.alert('Could not save tracker', 'Please review the tracker configuration and try again.');
    }
  };

  const renderKindFields = () => {
    switch (kind) {
      case 'countdown':
        return (
          <FormCard>
            <FormSection eyebrow="Countdown" title="Finish line">
              <FormTextField label="Target date" placeholder="2026-12-31" value={config.targetDate ?? ''} onChangeText={(value) => changeConfig('targetDate', value)} />
              <FormTextField label="Start date" placeholder="2026-01-01" value={config.startDate ?? ''} onChangeText={(value) => changeConfig('startDate', value)} />
              <FormTextField label="Alert days" hint="30, 14, 7, 1" value={typeof config.alertDays === 'string' ? config.alertDays : numbersToCsv(config.alertDays)} onChangeText={(value) => changeConfig('alertDays', value)} />
              <FormTextField label="Finished label" placeholder="Done" value={config.finishedLabel ?? ''} onChangeText={(value) => changeConfig('finishedLabel', value)} />
            </FormSection>
          </FormCard>
        );
      case 'countup':
        return (
          <FormCard>
            <FormSection eyebrow="Countup" title="Origin">
              <FormTextField label="Origin date" placeholder="2026-01-01" value={config.originDate ?? ''} onChangeText={(value) => changeConfig('originDate', value)} />
              <View style={styles.chipWrap}>
                {['since_date', 'since_event'].map((mode) => (
                  <FormChip key={mode} label={mode} selected={(config.mode ?? 'since_date') === mode} onPress={() => changeConfig('mode', mode)} />
                ))}
              </View>
            </FormSection>
          </FormCard>
        );
      case 'habit':
        return (
          <FormCard>
            <FormSection eyebrow="Habit" title="Cadence">
              <View style={styles.chipWrap}>
                {['daily', 'weekdays', 'custom'].map((cadence) => (
                  <FormChip key={cadence} label={cadence} selected={(config.cadence ?? 'daily') === cadence} onPress={() => changeConfig('cadence', cadence)} />
                ))}
              </View>
              <FormTextField label="Prompt" placeholder="Tiny nudge" value={config.prompt ?? ''} onChangeText={(value) => changeConfig('prompt', value)} />
              <View style={styles.toggleRow}>
                <AppText variant="subheadline">Allow skip</AppText>
                <Switch value={Boolean(config.allowSkip ?? true)} onValueChange={(value) => changeConfig('allowSkip', value)} />
              </View>
              <View style={styles.toggleRow}>
                <AppText variant="subheadline">Confirm on tap</AppText>
                <Switch value={Boolean(config.confirmOnTap ?? false)} onValueChange={(value) => changeConfig('confirmOnTap', value)} />
              </View>
            </FormSection>
          </FormCard>
        );
      case 'rating':
        return (
          <FormCard>
            <FormSection eyebrow="Rating" title="Scale">
              <View style={styles.chipWrap}>
                {[5, 10].map((scale) => (
                  <FormChip key={scale} label={`${scale} point`} selected={Number(config.scale ?? 5) === scale} onPress={() => changeConfig('scale', scale)} />
                ))}
              </View>
            </FormSection>
          </FormCard>
        );
      case 'metric':
        return (
          <FormCard>
            <FormSection eyebrow="Metric" title="Measurement">
              <FormTextField label="Unit" placeholder="steps, kg, ml" value={config.unit ?? ''} onChangeText={(value) => changeConfig('unit', value)} />
              <FormTextField label="Target" placeholder="10000" value={config.target == null ? '' : String(config.target)} onChangeText={(value) => changeConfig('target', value ? Number(value) : undefined)} keyboardType="decimal-pad" />
              <FormTextField label="Step" placeholder="1" value={config.step == null ? '' : String(config.step)} onChangeText={(value) => changeConfig('step', value ? Number(value) : undefined)} keyboardType="decimal-pad" />
              <FormTextField label="Preset values" hint="1, 2, 5, 10" value={typeof config.presetValues === 'string' ? config.presetValues : numbersToCsv(config.presetValues)} onChangeText={(value) => changeConfig('presetValues', value)} />
              <View style={styles.chipWrap}>
                {['set', 'cumulative'].map((mode) => (
                  <FormChip key={mode} label={mode} selected={(config.mode ?? 'set') === mode} onPress={() => changeConfig('mode', mode)} />
                ))}
              </View>
            </FormSection>
          </FormCard>
        );
      case 'counter':
        return (
          <FormCard>
            <FormSection eyebrow="Counter" title="High frequency logging">
              <FormTextField label="Step" placeholder="1" value={config.step == null ? '' : String(config.step)} onChangeText={(value) => changeConfig('step', value ? Number(value) : undefined)} keyboardType="decimal-pad" />
              <FormTextField label="Target" placeholder="8" value={config.target == null ? '' : String(config.target)} onChangeText={(value) => changeConfig('target', value ? Number(value) : undefined)} keyboardType="decimal-pad" />
              <FormTextField label="Presets" hint="1, 2, 5" value={typeof config.presets === 'string' ? config.presets : numbersToCsv(config.presets)} onChangeText={(value) => changeConfig('presets', value)} />
              <View style={styles.toggleRow}>
                <AppText variant="subheadline">Allow negative values</AppText>
                <Switch value={Boolean(config.allowNegative ?? false)} onValueChange={(value) => changeConfig('allowNegative', value)} />
              </View>
            </FormSection>
          </FormCard>
        );
      case 'note':
        return (
          <FormCard>
            <FormSection eyebrow="Note" title="Prompting">
              <FormTextField label="Prompt" placeholder="What happened today?" value={config.prompt ?? ''} onChangeText={(value) => changeConfig('prompt', value)} />
              <FormTextField label="Template" placeholder="Wins, blockers, next steps" value={config.template ?? ''} onChangeText={(value) => changeConfig('template', value)} multiline />
            </FormSection>
          </FormCard>
        );
      case 'photo':
        return (
          <FormCard>
            <FormSection eyebrow="Photo" title="Gallery rules">
              <FormTextField label="Prompt" placeholder="Progress photo" value={config.prompt ?? ''} onChangeText={(value) => changeConfig('prompt', value)} />
              <FormTextField label="Max photos per day" placeholder="3" value={config.maxPhotosPerDay == null ? '' : String(config.maxPhotosPerDay)} onChangeText={(value) => changeConfig('maxPhotosPerDay', value ? Number(value) : undefined)} keyboardType="number-pad" />
              <View style={styles.toggleRow}>
                <AppText variant="subheadline">Allow captions</AppText>
                <Switch value={Boolean(config.allowCaptions ?? true)} onValueChange={(value) => changeConfig('allowCaptions', value)} />
              </View>
              <View style={styles.toggleRow}>
                <AppText variant="subheadline">Compare mode</AppText>
                <Switch value={Boolean(config.compareMode ?? true)} onValueChange={(value) => changeConfig('compareMode', value)} />
              </View>
            </FormSection>
          </FormCard>
        );
      case 'progress':
        return (
          <FormCard>
            <FormSection eyebrow="Progress" title="Derived progress">
              <View style={styles.chipWrap}>
                {['date', 'metric'].map((mode) => (
                  <FormChip key={mode} label={mode} selected={(config.mode ?? 'date') === mode} onPress={() => changeConfig('mode', mode)} />
                ))}
              </View>
              {(config.mode ?? 'date') === 'date' ? (
                <>
                  <FormTextField label="Start date" placeholder="2026-01-01" value={config.startDate ?? ''} onChangeText={(value) => changeConfig('startDate', value)} />
                  <FormTextField label="End date" placeholder="2026-12-31" value={config.endDate ?? ''} onChangeText={(value) => changeConfig('endDate', value)} />
                </>
              ) : (
                <>
                  <TrackerSourcePicker label="Source tracker" trackers={trackers.filter((tracker) => tracker.id !== trackerId)} selectedId={config.sourceTrackerId ?? ''} onSelect={(value) => changeConfig('sourceTrackerId', value)} />
                  <FormTextField label="Start value" placeholder="0" value={config.startValue == null ? '' : String(config.startValue)} onChangeText={(value) => changeConfig('startValue', value ? Number(value) : undefined)} keyboardType="decimal-pad" />
                  <FormTextField label="Target value" placeholder="100" value={config.targetValue == null ? '' : String(config.targetValue)} onChangeText={(value) => changeConfig('targetValue', value ? Number(value) : undefined)} keyboardType="decimal-pad" />
                </>
              )}
            </FormSection>
          </FormCard>
        );
      case 'streak':
        return (
          <FormCard>
            <FormSection eyebrow="Streak" title="Source tracker">
              <TrackerSourcePicker label="Source tracker" trackers={trackers.filter((tracker) => tracker.id !== trackerId)} selectedId={config.sourceTrackerId ?? ''} onSelect={(value) => changeConfig('sourceTrackerId', value)} />
              <FormTextField label="Grace hours" placeholder="4" value={config.graceHours == null ? '' : String(config.graceHours)} onChangeText={(value) => changeConfig('graceHours', value ? Number(value) : undefined)} keyboardType="decimal-pad" />
            </FormSection>
          </FormCard>
        );
      case 'session':
        return (
          <FormCard>
            <FormSection eyebrow="Session" title="Launcher behaviour">
              <View style={styles.chipWrap}>
                {['timer', 'routine_launcher', 'required_session'].map((variant) => (
                  <FormChip key={variant} label={variant.replace('_', ' ')} selected={(config.variant ?? 'routine_launcher') === variant} onPress={() => changeConfig('variant', variant)} />
                ))}
              </View>
              <View style={styles.chipWrap}>
                {routines.map((routine) => (
                  <FormChip key={routine.id} label={routine.name} selected={config.routineId === routine.id} onPress={() => changeConfig('routineId', routine.id)} />
                ))}
              </View>
              <FormTextField label="Default duration seconds" placeholder="1500" value={config.defaultDurationSeconds == null ? '' : String(config.defaultDurationSeconds)} onChangeText={(value) => changeConfig('defaultDurationSeconds', value ? Number(value) : undefined)} keyboardType="number-pad" />
            </FormSection>
          </FormCard>
        );
      case 'prompt':
        return (
          <FormCard>
            <FormSection eyebrow="Prompt" title="Prompt card">
              <FormTextField label="Prompt" placeholder="What mattered most today?" value={config.prompt ?? ''} onChangeText={(value) => changeConfig('prompt', value)} multiline />
              <FormTextField label="Helper text" placeholder="Optional framing" value={config.helperText ?? ''} onChangeText={(value) => changeConfig('helperText', value)} />
            </FormSection>
          </FormCard>
        );
      case 'aggregate':
        return (
          <FormCard>
            <FormSection eyebrow="Aggregate" title="Meta-tracker formula">
              <FormTextField label="Inputs" hint="One per line: trackerId:weight" value={typeof config.inputs === 'string' ? config.inputs : aggregateInputsToText(config.inputs)} onChangeText={(value) => changeConfig('inputs', value)} multiline />
              <FormTextField label="Precision" placeholder="2" value={config.precision == null ? '' : String(config.precision)} onChangeText={(value) => changeConfig('precision', value ? Number(value) : undefined)} keyboardType="number-pad" />
              <FormTextField label="Max value" placeholder="100" value={config.maxValue == null ? '' : String(config.maxValue)} onChangeText={(value) => changeConfig('maxValue', value ? Number(value) : undefined)} keyboardType="decimal-pad" />
              <FormTextField label="Low label" placeholder="Drained" value={config.labelLow ?? ''} onChangeText={(value) => changeConfig('labelLow', value)} />
              <FormTextField label="High label" placeholder="Thriving" value={config.labelHigh ?? ''} onChangeText={(value) => changeConfig('labelHigh', value)} />
            </FormSection>
          </FormCard>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <AppText variant="body" color={themeTokens.textSecondary}>
          Loading tracker…
        </AppText>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <FormSection eyebrow="Tracker" title={isEditing ? 'Refine tracker' : 'Build tracker'} description="One tracker engine now powers Today, the library, quick actions, and comparison analytics.">
        <FormTextField label="Name" placeholder="Sleep quality" value={label} onChangeText={setLabel} />
        <FormTextField label="Emoji" placeholder="😴" value={emoji} onChangeText={setEmoji} containerStyle={{ maxWidth: 120 }} />
      </FormSection>

      <FormCard>
        <FormSection eyebrow="Kind" title="Tracker family">
          <View style={styles.chipWrap}>
            {TRACKER_KINDS.map((option) => (
              <FormChip
                key={option}
                label={option}
                selected={kind === option}
                onPress={() => {
                  if (isEditing) return;
                  setKind(option);
                  setConfig(getDefaultTrackerConfig(option));
                  setPinRules(getDefaultTrackerPinRules(option));
                }}
              />
            ))}
          </View>
          {isEditing ? <AppText variant="caption1" color={themeTokens.textSecondary}>Kind is fixed after creation.</AppText> : null}
        </FormSection>
      </FormCard>

      {renderKindFields()}

      <FormCard>
        <FormSection eyebrow="Folder" title="Collection">
          <View style={styles.chipWrap}>
            <FormChip label="Unfiled" selected={!collectionId} onPress={() => setCollectionId(null)} />
            {collections.map((collection) => (
              <FormChip key={collection.id} label={`${collection.emoji ? `${collection.emoji} ` : ''}${collection.name}`} selected={collectionId === collection.id} onPress={() => setCollectionId(collection.id)} />
            ))}
          </View>
        </FormSection>
      </FormCard>

      <FormCard>
        <FormSection eyebrow="Pins" title="Visibility and quick actions">
          <View style={styles.surfaceStack}>
            {SURFACES.map((surface) => {
              const rule = pinRules?.[surface] ?? { enabled: false, size: 'compact' };
              return (
                <View key={surface} style={[styles.surfaceCard, { borderColor: themeTokens.border, backgroundColor: themeTokens.surface }]}>
                  <View style={styles.toggleRow}>
                    <AppText variant="headline" style={{ fontWeight: '700' }}>{surface}</AppText>
                    <Switch value={Boolean(rule.enabled)} onValueChange={(value) => changePinRule(surface, { enabled: value })} />
                  </View>
                  {rule.enabled ? (
                    <>
                      <View style={styles.chipWrap}>
                        {SIZES.map((size) => (
                          <FormChip key={size} label={size} selected={(rule.size ?? 'compact') === size} onPress={() => changePinRule(surface, { size })} />
                        ))}
                      </View>
                      {registry.capabilities.supportsQuickAction ? (
                        <>
                          <View style={styles.chipWrap}>
                            {QUICK_ACTION_TYPES.map((type) => (
                              <FormChip
                                key={type}
                                label={type === 'none' ? 'No quick action' : type}
                                selected={(rule.quickAction?.type ?? 'none') === type}
                                onPress={() => changePinRule(surface, { quickAction: type === 'none' ? null : { type: type as any } })}
                              />
                            ))}
                          </View>
                          {rule.quickAction && rule.quickAction.type !== 'none' ? (
                            <>
                              <FormTextField label="Action label" placeholder="Quick add" value={rule.quickAction.label ?? ''} onChangeText={(value) => changePinRule(surface, { quickAction: { ...rule.quickAction, label: value } })} />
                              {rule.quickAction.type === 'increment' || rule.quickAction.type === 'decrement' ? (
                                <FormTextField label="Amount" placeholder="1" value={rule.quickAction.amount == null ? '' : String(rule.quickAction.amount)} onChangeText={(value) => changePinRule(surface, { quickAction: { ...rule.quickAction, amount: value ? Number(value) : undefined } })} keyboardType="decimal-pad" />
                              ) : null}
                              {rule.quickAction.type === 'set_number' || rule.quickAction.type === 'set_text' || rule.quickAction.type === 'set_boolean' ? (
                                <FormTextField
                                  label="Value"
                                  placeholder={rule.quickAction.type === 'set_boolean' ? 'true or false' : '42'}
                                  value={rule.quickAction.value == null ? '' : String(rule.quickAction.value)}
                                  onChangeText={(value) =>
                                    changePinRule(surface, {
                                      quickAction: {
                                        ...rule.quickAction,
                                        value:
                                          rule.quickAction.type === 'set_number'
                                            ? Number(value || 0)
                                            : rule.quickAction.type === 'set_boolean'
                                              ? value.toLowerCase() === 'true'
                                              : value,
                                      },
                                    })
                                  }
                                />
                              ) : null}
                            </>
                          ) : null}
                        </>
                      ) : null}
                    </>
                  ) : null}
                </View>
              );
            })}
          </View>
        </FormSection>
      </FormCard>

      <FormCard>
        <FormSection eyebrow="Schedules" title="Recurring rules">
          <View style={styles.stack}>
            {schedules.map((schedule, index) => (
              <View key={`schedule-${index}`} style={[styles.ruleCard, { borderColor: themeTokens.border, backgroundColor: themeTokens.surface }]}>
                <View style={styles.toggleRow}>
                  <AppText variant="headline" style={{ fontWeight: '700' }}>Schedule {index + 1}</AppText>
                  <Switch value={schedule.enabled} onValueChange={(value) => setSchedules((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: value } : item))} />
                </View>
                <View style={styles.chipWrap}>
                  {DAY_LABELS.map((dayLabel, day) => (
                    <FormChip key={`${index}-${day}`} label={dayLabel} selected={schedule.daysOfWeek.includes(day)} onPress={() => toggleDays(setSchedules, index, day)} />
                  ))}
                </View>
                <FormTextField label="Time of day" placeholder="08:00" value={schedule.timeOfDay} onChangeText={(value) => setSchedules((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, timeOfDay: value } : item))} />
                <Pressable onPress={() => setSchedules((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                  <AppText variant="caption1" color={themeTokens.destructive}>Remove schedule</AppText>
                </Pressable>
              </View>
            ))}
            <Pressable onPress={() => setSchedules((current) => [...current, { daysOfWeek: [], timeOfDay: '', enabled: true }])}>
              <AppText variant="caption1" color={themeTokens.accent}>Add schedule</AppText>
            </Pressable>
          </View>
        </FormSection>
      </FormCard>

      <FormCard>
        <FormSection eyebrow="Reminders" title="Attached nudges">
          <View style={styles.stack}>
            {reminders.map((reminder, index) => (
              <View key={`reminder-${index}`} style={[styles.ruleCard, { borderColor: themeTokens.border, backgroundColor: themeTokens.surface }]}>
                <View style={styles.toggleRow}>
                  <AppText variant="headline" style={{ fontWeight: '700' }}>Reminder {index + 1}</AppText>
                  <Switch value={reminder.enabled} onValueChange={(value) => setReminders((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: value } : item))} />
                </View>
                <View style={styles.chipWrap}>
                  {DAY_LABELS.map((dayLabel, day) => (
                    <FormChip key={`${index}-${day}`} label={dayLabel} selected={reminder.daysOfWeek.includes(day)} onPress={() => toggleDays(setReminders, index, day)} />
                  ))}
                </View>
                <FormTextField label="Time" placeholder="21:00" value={reminder.time} onChangeText={(value) => setReminders((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, time: value } : item))} />
                <FormTextField label="Message" placeholder="Time to check in" value={reminder.message} onChangeText={(value) => setReminders((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, message: value } : item))} />
                <Pressable onPress={() => setReminders((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                  <AppText variant="caption1" color={themeTokens.destructive}>Remove reminder</AppText>
                </Pressable>
              </View>
            ))}
            <Pressable onPress={() => setReminders((current) => [...current, { daysOfWeek: [], time: '', message: '', enabled: true }])}>
              <AppText variant="caption1" color={themeTokens.accent}>Add reminder</AppText>
            </Pressable>
          </View>
        </FormSection>
      </FormCard>

      <View style={styles.footerRow}>
        <Pressable style={[styles.secondaryButton, { borderColor: themeTokens.border }]} onPress={() => router.back()}>
          <AppText variant="headline" style={{ fontWeight: '700' }}>Cancel</AppText>
        </Pressable>
        <Pressable style={[styles.primaryButton, { backgroundColor: themeTokens.accent }]} onPress={saveTracker}>
          <AppText variant="headline" onAccent style={{ fontWeight: '700' }}>{isEditing ? 'Save tracker' : 'Create tracker'}</AppText>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: space[16],
    paddingBottom: space[48],
    gap: space[16],
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[8],
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[12],
  },
  surfaceStack: {
    gap: space[12],
  },
  surfaceCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space[12],
    gap: space[12],
  },
  stack: {
    gap: space[12],
  },
  ruleCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space[12],
    gap: space[12],
  },
  footerRow: {
    flexDirection: 'row',
    gap: space[12],
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryButton: {
    flex: 2,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  loadingState: {
    padding: space[24],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
