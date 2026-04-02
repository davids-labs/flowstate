import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import {
  applyTrackerQuickAction,
  getTrackerRegistryItem,
  upsertTrackerEntry,
  type TrackerQuickAction,
  type TrackerSpec,
  type TrackerSurface,
} from '@flowstate/core';
import { useDatabaseSafe } from '../DatabaseProvider';
import { useTheme } from '../../constants/ThemeContext';
import { radius, space } from '../../constants/theme';
import { AppText } from '../primitives/Text';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function asNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
}

function asPhotos(value: unknown): Array<{ uri: string; caption?: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return { uri: item };
      if (item && typeof item === 'object' && 'uri' in item) {
        const photo = item as { uri: string; caption?: string };
        return { uri: photo.uri, caption: photo.caption };
      }
      return null;
    })
    .filter(Boolean) as Array<{ uri: string; caption?: string }>;
}

interface TrackerQuickLogProps {
  tracker: TrackerSpec & {
    entry?: any;
    quickAction?: TrackerQuickAction | null;
  };
  date?: string;
  surface?: TrackerSurface;
  compact?: boolean;
  onSaved?: () => void;
}

export function TrackerQuickLog({
  tracker,
  date = todayIso(),
  surface = 'today',
  compact = false,
  onSaved,
}: TrackerQuickLogProps) {
  const { db } = useDatabaseSafe();
  const { themeTokens } = useTheme();
  const registry = useMemo(() => getTrackerRegistryItem(tracker.kind), [tracker.kind]);
  const [draftText, setDraftText] = useState(asText(tracker.entry?.value));
  const [draftNumber, setDraftNumber] = useState(
    tracker.entry?.numericValue == null ? '' : String(tracker.entry.numericValue),
  );
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    setDraftText(asText(tracker.entry?.value));
    setDraftNumber(tracker.entry?.numericValue == null ? '' : String(tracker.entry.numericValue));
  }, [tracker.entry?.value, tracker.entry?.numericValue]);

  const saveValue = async (value: unknown) => {
    if (!db) return;
    try {
      setIsBusy(true);
      await upsertTrackerEntry(db, { trackerId: tracker.id, date, value });
      onSaved?.();
    } catch (error) {
      console.error('Failed to save tracker entry', error);
      Alert.alert('Could not save', 'This tracker entry could not be saved.');
    } finally {
      setIsBusy(false);
    }
  };

  const runQuickAction = async () => {
    if (!db || !tracker.quickAction) return;
    try {
      setIsBusy(true);
      await applyTrackerQuickAction(db, tracker.id, surface, { date });
      onSaved?.();
    } catch (error) {
      console.error('Failed to apply tracker quick action', error);
      Alert.alert('Could not quick log', 'The quick action did not complete.');
    } finally {
      setIsBusy(false);
    }
  };

  const currentNumber = asNumber(tracker.entry?.numericValue ?? tracker.entry?.value);
  const presetValues =
    tracker.kind === 'metric'
      ? ((tracker.config as any).presetValues as number[] | undefined) ?? []
      : tracker.kind === 'counter'
        ? ((tracker.config as any).presets as number[] | undefined) ?? []
        : [];

  const incrementBy = async (amount: number) => {
    if (tracker.kind === 'metric' && (tracker.config as any).mode === 'cumulative') {
      await saveValue(currentNumber + amount);
      return;
    }
    await saveValue(currentNumber + amount);
  };

  const appendPhoto = async (mode: 'camera' | 'library') => {
    if (!db) return;
    try {
      setIsBusy(true);
      const permission =
        mode === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Photo access is required for this tracker.');
        return;
      }

      const result =
        mode === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
            });

      if (result.canceled || !result.assets?.[0]?.uri) return;
      const existing = asPhotos(tracker.entry?.value);
      const limit = Number((tracker.config as any).maxPhotosPerDay ?? 0);
      if (limit > 0 && existing.length >= limit) {
        Alert.alert('Limit reached', `This tracker is capped at ${limit} photos per day.`);
        return;
      }
      await saveValue([...existing, { uri: result.assets[0].uri }]);
    } catch (error) {
      console.error('Failed to append tracker photo', error);
      Alert.alert('Photo failed', 'The photo could not be attached.');
    } finally {
      setIsBusy(false);
    }
  };

  if (!registry.capabilities.loggable && !tracker.quickAction) {
    return null;
  }

  return (
    <View style={styles.container}>
      {tracker.quickAction ? (
        <Pressable
          style={[
            styles.quickAction,
            {
              backgroundColor: themeTokens.accentTint,
              borderColor: themeTokens.border,
              opacity: isBusy ? 0.6 : 1,
            },
          ]}
          onPress={runQuickAction}
          disabled={isBusy}
        >
          <Feather name="zap" size={14} color={themeTokens.accent} />
          <AppText variant="caption1" color={themeTokens.accent} style={{ fontWeight: '700' }}>
            {tracker.quickAction.label ?? 'Quick action'}
          </AppText>
        </Pressable>
      ) : null}

      {tracker.kind === 'habit' ? (
        <View style={styles.row}>
          <Pressable
            style={[
              styles.choiceButton,
              {
                backgroundColor: tracker.entry?.booleanValue ? themeTokens.accent : themeTokens.surface,
                borderColor: tracker.entry?.booleanValue ? themeTokens.accent : themeTokens.border,
              },
            ]}
            onPress={() => saveValue(true)}
            disabled={isBusy}
          >
            <Feather name="check" size={14} color={tracker.entry?.booleanValue ? '#fff' : themeTokens.textSecondary} />
            <AppText
              variant="caption1"
              color={tracker.entry?.booleanValue ? '#fff' : themeTokens.textSecondary}
              style={{ fontWeight: '700' }}
            >
              Done
            </AppText>
          </Pressable>
          <Pressable
            style={[
              styles.choiceButton,
              { backgroundColor: themeTokens.surface, borderColor: themeTokens.border },
            ]}
            onPress={() => saveValue(false)}
            disabled={isBusy}
          >
            <Feather name="circle" size={14} color={themeTokens.textSecondary} />
            <AppText variant="caption1" color={themeTokens.textSecondary} style={{ fontWeight: '700' }}>
              Reset
            </AppText>
          </Pressable>
        </View>
      ) : null}

      {tracker.kind === 'rating' ? (
        <View style={styles.row}>
          {Array.from({ length: Number((tracker.config as any).scale ?? 5) }).map((_, index) => {
            const value = index + 1;
            const isActive = currentNumber >= value;
            return (
              <Pressable
                key={value}
                style={[
                  styles.ratingButton,
                  {
                    backgroundColor: isActive ? themeTokens.accentTint : themeTokens.surface,
                    borderColor: isActive ? themeTokens.accent : themeTokens.border,
                  },
                ]}
                onPress={() => saveValue(value)}
                disabled={isBusy}
              >
                <Feather name="star" size={compact ? 12 : 14} color={isActive ? themeTokens.accent : themeTokens.textTertiary} />
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {tracker.kind === 'metric' || tracker.kind === 'counter' ? (
        <>
          <View style={styles.row}>
            <Pressable
              style={[styles.steppedButton, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}
              onPress={() => incrementBy(-Number((tracker.config as any).step ?? 1))}
              disabled={isBusy || (tracker.kind === 'counter' && !(tracker.config as any).allowNegative && currentNumber <= 0)}
            >
              <Feather name="minus" size={14} color={themeTokens.textSecondary} />
            </Pressable>
            <TextInput
              style={[
                styles.input,
                {
                  color: themeTokens.textPrimary,
                  borderColor: themeTokens.border,
                  backgroundColor: themeTokens.surface,
                },
              ]}
              placeholder={tracker.kind === 'metric' ? 'Enter value' : 'Current total'}
              placeholderTextColor={themeTokens.textTertiary}
              keyboardType="decimal-pad"
              value={draftNumber}
              onChangeText={setDraftNumber}
            />
            <Pressable
              style={[styles.steppedButton, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}
              onPress={() => incrementBy(Number((tracker.config as any).step ?? 1))}
              disabled={isBusy}
            >
              <Feather name="plus" size={14} color={themeTokens.textSecondary} />
            </Pressable>
          </View>
          {presetValues.length > 0 ? (
            <View style={styles.presetRow}>
              {presetValues.map((value) => (
                <Pressable
                  key={value}
                  style={[styles.presetChip, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}
                  onPress={() =>
                    saveValue(
                      tracker.kind === 'metric' && (tracker.config as any).mode === 'cumulative'
                        ? currentNumber + Number(value)
                        : value,
                    )
                  }
                  disabled={isBusy}
                >
                  <AppText variant="caption1" color={themeTokens.textSecondary}>
                    {value}
                  </AppText>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Pressable
            style={[styles.saveButton, { backgroundColor: themeTokens.accent, opacity: isBusy ? 0.6 : 1 }]}
            onPress={() => saveValue(Number(draftNumber || 0))}
            disabled={isBusy}
          >
            <AppText variant="caption1" onAccent style={{ fontWeight: '700' }}>
              Save value
            </AppText>
          </Pressable>
        </>
      ) : null}

      {tracker.kind === 'note' || tracker.kind === 'prompt' ? (
        <>
          {(tracker.config as any).prompt ? (
            <AppText variant="caption1" color={themeTokens.textSecondary}>
              {(tracker.config as any).prompt}
            </AppText>
          ) : null}
          <TextInput
            style={[
              styles.textArea,
              {
                color: themeTokens.textPrimary,
                borderColor: themeTokens.border,
                backgroundColor: themeTokens.surface,
              },
            ]}
            placeholder={tracker.kind === 'prompt' ? 'Write your response' : 'Write a quick note'}
            placeholderTextColor={themeTokens.textTertiary}
            value={draftText}
            onChangeText={setDraftText}
            multiline
          />
          <Pressable
            style={[styles.saveButton, { backgroundColor: themeTokens.accent, opacity: isBusy ? 0.6 : 1 }]}
            onPress={() => saveValue(draftText.trim())}
            disabled={isBusy}
          >
            <AppText variant="caption1" onAccent style={{ fontWeight: '700' }}>
              Save note
            </AppText>
          </Pressable>
        </>
      ) : null}

      {tracker.kind === 'photo' ? (
        <>
          <View style={styles.photoGrid}>
            {asPhotos(tracker.entry?.value).slice(0, compact ? 3 : 6).map((photo) => (
              <Image key={photo.uri} source={{ uri: photo.uri }} style={styles.photoThumb} />
            ))}
          </View>
          <View style={styles.row}>
            <Pressable
              style={[styles.choiceButton, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}
              onPress={() => appendPhoto('camera')}
              disabled={isBusy}
            >
              <Feather name="camera" size={14} color={themeTokens.textSecondary} />
              <AppText variant="caption1" color={themeTokens.textSecondary} style={{ fontWeight: '700' }}>
                Camera
              </AppText>
            </Pressable>
            <Pressable
              style={[styles.choiceButton, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}
              onPress={() => appendPhoto('library')}
              disabled={isBusy}
            >
              <Feather name="image" size={14} color={themeTokens.textSecondary} />
              <AppText variant="caption1" color={themeTokens.textSecondary} style={{ fontWeight: '700' }}>
                Library
              </AppText>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space[8],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
  },
  quickAction: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space[12],
    paddingVertical: space[8],
  },
  choiceButton: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space[12],
    paddingVertical: space[8],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[8],
  },
  ratingButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  steppedButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space[12],
    fontSize: 16,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[8],
  },
  presetChip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space[12],
    paddingVertical: space[8],
  },
  saveButton: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: space[12],
    paddingVertical: space[8],
  },
  textArea: {
    minHeight: 88,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space[12],
    paddingVertical: space[12],
    textAlignVertical: 'top',
    fontSize: 15,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[8],
  },
  photoThumb: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
  },
});
