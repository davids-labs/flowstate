import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ModuleType, Surface } from '@flowstate/core';
import { CountdownCard } from './CountdownCard';
import { CountupCard } from './CountupCard';
import { CheckboxCard } from './CheckboxCard';
import { RatingCard } from './RatingCard';
import { DataInputCard } from './DataInputCard';
import { SessionCard } from './SessionCard';
import { ProgressBarCard } from './ProgressBarCard';
import { StreakCard } from './StreakCard';
import { TextNoteCard } from './TextNoteCard';
import { MandatorySessionCard } from './MandatorySessionCard';
import { TallyCard } from './TallyCard';
import { PhotoLogCard } from './PhotoLogCard';
import { RoutineLauncherCard } from './RoutineLauncherCard';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

interface ModuleCardProps {
  id: string;
  type: ModuleType;
  label: string;
  emoji?: string;
  config: Record<string, unknown>;
  surface: Surface;
  compact?: boolean;
  // Values & callbacks for logged modules
  value?: unknown;
  onValueChange?: (value: unknown) => void;
}

/**
 * Generic ModuleCard renderer.
 * Takes a ModuleSpec + Surface and delegates to the correct sub-card component.
 */
export function ModuleCard({
  id,
  type,
  label,
  emoji,
  config,
  surface,
  compact,
  value,
  onValueChange,
}: ModuleCardProps) {
  const { themeColors } = useTheme();
  const isCompact = compact ?? surface === 'homescreen';

  switch (type) {
    case 'countdown':
      return (
        <CountdownCard
          label={label}
          emoji={emoji}
          targetDate={config.targetDate as string | undefined}
          startDate={config.startDate as string | undefined}
          displayMode={(config.displayMode as 'days' | 'dhms' | 'weeks' | 'auto') ?? 'auto'}
          compact={isCompact}
        />
      );

    case 'countup':
      return (
        <CountupCard
          label={label}
          emoji={emoji}
          originDate={config.originDate as string}
          displayMode={(config.displayMode as 'days' | 'dhms' | 'years_days' | 'auto') ?? 'auto'}
          compact={isCompact}
        />
      );

    case 'checkbox':
      return (
        <CheckboxCard
          label={label}
          emoji={emoji}
          checked={value as boolean ?? false}
          streak={config.streak ? (value as number | undefined) : undefined}
          onToggle={() => onValueChange?.(!(value as boolean))}
        />
      );

    case 'rating':
      return (
        <RatingCard
          label={label}
          emoji={emoji}
          value={value as number ?? 0}
          onRate={(v) => onValueChange?.(v)}
        />
      );

    case 'data_input':
      return (
        <DataInputCard
          label={label}
          emoji={emoji}
          value={value as number ?? 0}
          target={(config.target as number) ?? 0}
          unit={(config.unit as string) ?? ''}
          onChangeValue={(v) => onValueChange?.(v)}
          compact={isCompact}
        />
      );

    case 'text_note':
      return (
        <TextNoteCard
          label={label}
          emoji={emoji}
          value={typeof value === 'string' ? value : ''}
          onChangeValue={(v) => onValueChange?.(v)}
          maxLength={(config.maxLength as number) ?? 500}
          prompt={config.prompt as string | undefined}
          compact={isCompact}
        />
      );

    case 'progress_bar':
      return (
        <ProgressBarCard
          label={label}
          emoji={emoji}
          startDate={(config.startDate as string) ?? ''}
          endDate={(config.endDate as string) ?? ''}
          showDaysRemaining={config.showDaysRemaining as boolean}
          showPercentage={config.showPercentage as boolean}
          compact={isCompact}
        />
      );

    case 'streak_counter':
      return (
        <StreakCard
          label={label}
          emoji={emoji}
          currentStreak={typeof value === 'number' ? value : 0}
          bestStreak={0}
          showBest={config.showBest as boolean}
          compact={isCompact}
        />
      );

    case 'mandatory_session':
      return (
        <MandatorySessionCard
          label={label}
          emoji={emoji}
          sessionId={id}
          routineName={(config.routineName as string) ?? label}
          status="pending"
          compact={isCompact}
        />
      );

    case 'tally':
      return (
        <TallyCard
          label={label}
          emoji={emoji}
          value={typeof value === 'number' ? value : (parseInt(String(value), 10) || 0)}
          step={(config.step as number) ?? 1}
          target={config.target as number | undefined}
          onChangeValue={(v) => onValueChange?.(v)}
          compact={isCompact}
        />
      );

    case 'photo_log':
      return (
        <PhotoLogCard
          label={label}
          emoji={emoji}
          value={typeof value === 'string' ? value : ''}
          onValueChange={(v: string) => onValueChange?.(v)}
          maxPhotosPerDay={(config.maxPhotosPerDay as number) ?? 1}
          prompt={config.prompt as string | undefined}
          compact={isCompact}
        />
      );

    case 'routine_launcher':
      return (
        <RoutineLauncherCard
          label={label}
          emoji={emoji}
          moduleId={id}
          routineId={(config.routineId as string) ?? ''}
          autoStartOnTap={config.autoStartOnTap as boolean}
          showBlockPreview={config.showBlockPreview as boolean}
          accentColor={config.accentColor as string}
          compact={isCompact}
          value={value}
        />
      );

    default:
      return (
        <View style={[styles.fallbackCard, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.fallbackLabel, { color: themeColors.text }]}>
            {emoji ?? '❓'} {label}
          </Text>
          <Text style={[styles.fallbackMeta, { color: themeColors.textSecondary }]}>Unknown module type: {type}</Text>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  fallbackCard: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  fallbackEmoji: {
    fontSize: fontSize.xxl,
    marginBottom: spacing.xs,
  },
  fallbackLabel: {
    fontSize: fontSize.md,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  fallbackMeta: {
    fontSize: fontSize.sm,
  },
  progressTrack: {
    height: 6,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    width: '100%',
    marginTop: spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  streakCount: {
    fontSize: fontSize.xl,
    fontWeight: '800',
  },
  groupCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  groupEmoji: {
    fontSize: fontSize.lg,
  },
  groupLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
    flex: 1,
  },
  groupCount: {
    fontSize: fontSize.xs,
  },
});
