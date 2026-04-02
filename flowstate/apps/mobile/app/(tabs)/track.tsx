import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  createCollection,
  getCollections,
  getTrackers,
  getTrackerSummary,
  updateTracker,
} from '@flowstate/core';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import { useTheme } from '../../constants/ThemeContext';
import { radius, space } from '../../constants/theme';
import { AppText } from '../../components/primitives/Text';
import { refreshAmbientState } from '../../services/systemSync';

interface TrackTracker {
  id: string;
  label: string;
  emoji?: string | null;
  kind: string;
  collectionId?: string | null;
  archivedAt?: string | null;
  summary?: {
    currentDisplay: string;
    currentStreak?: number | null;
  };
}

export default function TrackScreen() {
  const router = useRouter();
  const { db } = useDatabaseSafe();
  const { themeTokens } = useTheme();
  const [folders, setFolders] = useState<any[]>([]);
  const [trackers, setTrackers] = useState<TrackTracker[]>([]);
  const [folderStack, setFolderStack] = useState<Array<{ id: string | null; name: string }>>([{ id: null, name: 'Track' }]);
  const [query, setQuery] = useState('');
  const [newFolderName, setNewFolderName] = useState('');

  const load = useCallback(async () => {
    if (!db) return;
    const [nextFolders, nextTrackers] = await Promise.all([
      getCollections(db),
      getTrackers(db, { includeArchived: true }),
    ]);
    const trackersWithSummary = await Promise.all(
      nextTrackers.map(async (tracker) => ({
        ...tracker,
        summary: await getTrackerSummary(db, tracker.id),
      })),
    );
    setFolders(nextFolders.filter((folder: any) => (folder.type ?? 'module') === 'module'));
    setTrackers(trackersWithSummary);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load().catch((error) => console.error('Failed to load tracker home', error));
    }, [load]),
  );

  const currentFolderId = folderStack[folderStack.length - 1]?.id ?? null;
  const filteredFolders = useMemo(
    () =>
      folders.filter((folder) => {
        const matchesFolder = currentFolderId === null ? !folder.parentId : folder.parentId === currentFolderId;
        const matchesSearch = !query.trim() || folder.name.toLowerCase().includes(query.trim().toLowerCase());
        return matchesFolder && matchesSearch;
      }),
    [folders, currentFolderId, query],
  );
  const visibleTrackers = useMemo(
    () =>
      trackers.filter((tracker) => {
        const matchesFolder = currentFolderId === null ? !tracker.collectionId : tracker.collectionId === currentFolderId;
        const matchesSearch = !query.trim() || tracker.label.toLowerCase().includes(query.trim().toLowerCase());
        return matchesFolder && matchesSearch && !tracker.archivedAt;
      }),
    [trackers, currentFolderId, query],
  );
  const archivedTrackers = useMemo(
    () => trackers.filter((tracker) => !query.trim() && !currentFolderId && tracker.archivedAt),
    [trackers, currentFolderId, query],
  );

  return (
    <ScreenWrapper>
      <View style={styles.hero}>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="title1" style={{ fontWeight: '800' }}>
            {folderStack[folderStack.length - 1]?.name ?? 'Track'}
          </AppText>
          <AppText variant="subheadline" color={themeTokens.textSecondary}>
            Your logging home for quick capture, tracker collections, and light-weight insight checks.
          </AppText>
        </View>
        {folderStack.length > 1 ? (
          <Pressable style={[styles.backButton, { borderColor: themeTokens.border }]} onPress={() => setFolderStack((current) => current.slice(0, -1))}>
            <Feather name="arrow-left" size={16} color={themeTokens.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.searchRow, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
        <Feather name="search" size={16} color={themeTokens.textTertiary} />
        <TextInput
          style={[styles.searchInput, { color: themeTokens.textPrimary }]}
          placeholder="Search folders or trackers"
          placeholderTextColor={themeTokens.textTertiary}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <View style={[styles.folderComposer, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
        <TextInput
          style={[styles.searchInput, { color: themeTokens.textPrimary }]}
          placeholder={currentFolderId ? 'Create a sub-folder' : 'Create a new folder'}
          placeholderTextColor={themeTokens.textTertiary}
          value={newFolderName}
          onChangeText={setNewFolderName}
        />
        <Pressable
          style={[styles.primaryButton, { backgroundColor: themeTokens.accent, opacity: newFolderName.trim() ? 1 : 0.5 }]}
          disabled={!newFolderName.trim()}
          onPress={async () => {
            if (!db || !newFolderName.trim()) return;
            await createCollection(db, { name: newFolderName.trim(), parentId: currentFolderId, type: 'module' });
            setNewFolderName('');
            await refreshAmbientState(db);
            load().catch((error) => console.error('Failed to refresh folders', error));
          }}
        >
          <AppText variant="caption1" onAccent style={{ fontWeight: '700' }}>
            Add folder
          </AppText>
        </Pressable>
      </View>

      {filteredFolders.map((folder) => (
        <Pressable
          key={folder.id}
          style={[styles.folderCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}
          onPress={() => setFolderStack((current) => [...current, { id: folder.id, name: folder.name }])}
        >
          <View style={[styles.folderGlyph, { backgroundColor: themeTokens.accentTint }]}>
            <Feather name="folder" size={16} color={themeTokens.accent} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="headline" style={{ fontWeight: '700' }}>
              {folder.emoji ? `${folder.emoji} ` : ''}
              {folder.name}
            </AppText>
            <AppText variant="footnote" color={themeTokens.textSecondary}>
              {trackers.filter((tracker) => tracker.collectionId === folder.id && !tracker.archivedAt).length} trackers
            </AppText>
          </View>
          <Feather name="chevron-right" size={16} color={themeTokens.textSecondary} />
        </Pressable>
      ))}

      {visibleTrackers.length === 0 && filteredFolders.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
          <Feather name="layers" size={20} color={themeTokens.textTertiary} />
          <AppText variant="body" color={themeTokens.textSecondary}>
            Nothing matches this view yet.
          </AppText>
        </View>
      ) : null}

      <View style={styles.list}>
        {visibleTrackers.map((tracker) => (
          <Pressable
            key={tracker.id}
            style={[styles.trackerCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}
            onPress={() => router.push(`/trackers/${tracker.id}` as any)}
          >
            <View style={styles.trackerTop}>
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="caption1" color={themeTokens.textSecondary} style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  {tracker.kind}
                </AppText>
                <AppText variant="headline" style={{ fontWeight: '700' }}>
                  {tracker.emoji ? `${tracker.emoji} ` : ''}
                  {tracker.label}
                </AppText>
              </View>
              <Feather name="chevron-right" size={16} color={themeTokens.textSecondary} />
            </View>
            <View style={styles.chipRow}>
              <View style={[styles.statChip, { backgroundColor: themeTokens.accentTint }]}>
                <AppText variant="caption2" color={themeTokens.accent}>{tracker.summary?.currentDisplay ?? 'No state'}</AppText>
              </View>
              {tracker.summary?.currentStreak ? (
                <View style={[styles.statChip, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border, borderWidth: 1 }]}>
                  <AppText variant="caption2" color={themeTokens.textSecondary}>{tracker.summary.currentStreak} day streak</AppText>
                </View>
              ) : null}
            </View>
          </Pressable>
        ))}
      </View>

      {archivedTrackers.length > 0 ? (
        <View style={styles.archivedSection}>
          <AppText variant="headline" style={{ fontWeight: '700' }}>Archived</AppText>
          {archivedTrackers.map((tracker) => (
            <Pressable
              key={tracker.id}
              style={[styles.archivedCard, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}
              onPress={async () => {
                if (!db) return;
                await updateTracker(db, tracker.id, { archivedAt: null });
                await refreshAmbientState(db);
                load().catch((error) => console.error('Failed to refresh tracker archive', error));
              }}
            >
              <AppText variant="subheadline" color={themeTokens.textSecondary}>
                {tracker.label}
              </AppText>
              <AppText variant="caption1" color={themeTokens.accent}>
                Restore
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Pressable style={[styles.fab, { backgroundColor: themeTokens.accent }]} onPress={() => router.push('/trackers/edit' as any)}>
        <Feather name="plus" size={18} color="#fff" />
        <AppText variant="headline" onAccent style={{ fontWeight: '700' }}>
          New tracker
        </AppText>
      </Pressable>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[12],
    marginBottom: space[16],
  },
  backButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: space[12],
    paddingVertical: space[12],
    marginBottom: space[12],
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  folderComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: space[12],
    paddingVertical: space[12],
    marginBottom: space[12],
  },
  primaryButton: {
    borderRadius: radius.full,
    paddingHorizontal: space[12],
    paddingVertical: space[8],
  },
  folderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space[16],
    marginBottom: space[8],
  },
  folderGlyph: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space[16],
    gap: space[8],
    alignItems: 'center',
    marginBottom: space[12],
  },
  list: {
    gap: space[8],
  },
  trackerCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space[16],
    gap: space[12],
  },
  trackerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[12],
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[8],
  },
  statChip: {
    borderRadius: radius.full,
    paddingHorizontal: space[8],
    paddingVertical: space[4],
  },
  archivedSection: {
    marginTop: space[24],
    gap: space[8],
  },
  archivedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space[12],
  },
  fab: {
    marginTop: space[24],
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[8],
    minHeight: 48,
  },
});
