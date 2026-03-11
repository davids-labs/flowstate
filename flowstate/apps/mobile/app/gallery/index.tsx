import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, Image, StyleSheet, Dimensions, FlatList } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { getSessionPhotos, getModuleSpecs } from '@flowstate/core';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const NUM_COLUMNS = 3;
const ITEM_GAP = 2;
const ITEM_SIZE = (SCREEN_WIDTH - spacing.md * 2 - ITEM_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

interface PhotoItem {
  sessionId: string;
  uri: string;
  date: string;
}

interface ModuleFilter {
  id: string;
  label: string;
  emoji?: string | null;
}

export default function GalleryScreen() {
  const { db, isReady } = useDatabaseSafe();
  const { themeColors } = useTheme();
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [modules, setModules] = useState<ModuleFilter[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);

  const loadData = useCallback(async () => {
    if (!db || !isReady) return;
    try {
      const [photoResults, specs] = await Promise.all([
        getSessionPhotos(db, selectedModuleId ?? undefined, `${FileSystem.documentDirectory}photos/`),
        getModuleSpecs(db),
      ]);
      setPhotos(photoResults);
      setModules(
        specs
          .filter((s: any) => s.type === 'photo_log') // BUG-09: removed 'timer' — timers have no photos
          .map((s: any) => ({ id: s.id, label: s.label, emoji: s.emoji })),
      );
    } catch (err) {
      console.error('Failed to load gallery:', err);
    }
  }, [db, isReady, selectedModuleId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const sortedPhotos = useMemo(
    () => [...photos].sort((a, b) => b.date.localeCompare(a.date)),
    [photos],
  );

  const renderPhoto = ({ item }: { item: PhotoItem }) => (
    <Pressable
      style={styles.photoContainer}
      onPress={() => setSelectedPhoto(item)}
    >
      <Image source={{ uri: item.uri }} style={styles.photo} resizeMode="cover" />
    </Pressable>
  );

  return (
    <ScreenWrapper>
      <SectionHeader title="Gallery" subtitle={`${sortedPhotos.length} photos`} />

      {/* Module filter chips */}
      {modules.length > 0 && (
        <View style={styles.filterRow}>
          <Pressable
            style={[
              styles.filterChip,
              {
                backgroundColor: selectedModuleId === null ? themeColors.accent : themeColors.surface,
                borderColor: themeColors.surfaceBorder,
              },
            ]}
            onPress={() => setSelectedModuleId(null)}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: selectedModuleId === null ? themeColors.white : themeColors.text },
              ]}
            >
              All
            </Text>
          </Pressable>
          {modules.map((m) => (
            <Pressable
              key={m.id}
              style={[
                styles.filterChip,
                {
                  backgroundColor: selectedModuleId === m.id ? themeColors.accent : themeColors.surface,
                  borderColor: themeColors.surfaceBorder,
                },
              ]}
              onPress={() => setSelectedModuleId(m.id)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: selectedModuleId === m.id ? themeColors.white : themeColors.text },
                ]}
              >
                {m.emoji ? `${m.emoji} ` : ''}
                {m.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {sortedPhotos.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="image" size={40} color={themeColors.muted} />
          <Text style={[styles.emptyText, { color: themeColors.text }]}>No photos yet</Text>
          <Text style={[styles.emptySubtext, { color: themeColors.muted }]}>
            Photos from sessions will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedPhotos}
          renderItem={renderPhoto}
          keyExtractor={(item: PhotoItem, index: number) => `${item.sessionId}-${index}`}
          numColumns={NUM_COLUMNS}
        />
      )}

      {/* Full-screen preview */}
      {selectedPhoto && (
        <Pressable
          style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.9)' }]}
          onPress={() => setSelectedPhoto(null)}
        >
          <Image
            source={{ uri: selectedPhoto.uri }}
            style={styles.previewImage}
            resizeMode="contain"
          />
          <Text style={styles.previewDate}>
            {new Date(selectedPhoto.date).toLocaleDateString()}
          </Text>
          <Pressable style={styles.closeBtn} onPress={() => setSelectedPhoto(null)}>
            <Feather name="x" size={24} color="#fff" />
          </Pressable>
        </Pressable>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  filterChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  photoContainer: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: ITEM_GAP / 2,
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: fontSize.sm,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  previewImage: {
    width: SCREEN_WIDTH - spacing.lg * 2,
    height: SCREEN_WIDTH - spacing.lg * 2,
    borderRadius: borderRadius.md,
  },
  previewDate: {
    color: '#fff',
    fontSize: fontSize.sm,
    marginTop: spacing.md,
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.xxl,
    right: spacing.md,
    padding: spacing.sm,
  },
});
