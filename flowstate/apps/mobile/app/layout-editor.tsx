import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView, Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { ScreenWrapper } from "../components/layout/ScreenWrapper";
import { useDatabaseSafe } from "../components/DatabaseProvider";
import {
  getModuleSpecs, getHomescreenLayout, setHomescreenLayout,
} from "@flowstate/core";
import { fontSize, spacing, borderRadius } from "../constants/theme";
import { useTheme } from "../constants/ThemeContext";

type LayoutItem = {
  moduleId: string;
  label: string;
  emoji?: string;
  type: string;
  zone: number;       // 1 = Live, 2 = Today, 3 = Logged
  order: number;
  width: number;       // 1 = half, 2 = full
  isLive: boolean;
};

const ZONE_NAMES: Record<number, string> = { 1: "Live", 2: "Today Snapshot", 3: "Daily Log" };
const ZONE_ICONS: Record<number, string> = { 1: "zap", 2: "sun", 3: "edit-3" };

export default function LayoutEditor() {
  const router = useRouter();
  const { themeColors } = useTheme();
  const { db, isReady } = useDatabaseSafe();
  const [items, setItems] = useState<LayoutItem[]>([]);
  const [unassigned, setUnassigned] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!db || !isReady) return;
      loadLayout();
    }, [db, isReady])
  );

  const loadLayout = async () => {
    if (!db) return;
    try {
      const specs = await getModuleSpecs(db);
      const activeSpecs = specs.filter((s: any) => !s.archivedAt);
      const layout = await getHomescreenLayout(db);

      if (layout.length > 0) {
        // Build from saved layout
        const layoutItems: LayoutItem[] = [];
        for (const entry of layout) {
          const spec = activeSpecs.find((s: any) => s.id === entry.moduleId);
          if (spec) {
            layoutItems.push({
              moduleId: spec.id,
              label: spec.label,
              emoji: spec.emoji,
              type: spec.type,
              zone: entry.zone,
              order: entry.order,
              width: (entry as any).width ?? 1,
              isLive: spec.isLive ?? false,
            });
          }
        }
        setItems(layoutItems);

        // Modules not in layout
        const layoutModuleIds = new Set(layout.map((l: any) => l.moduleId));
        setUnassigned(activeSpecs.filter((s: any) => {
          const placements = Array.isArray(s.placements) ? s.placements : [];
          return placements.includes("homescreen") && !layoutModuleIds.has(s.id);
        }));
      } else {
        // Build initial layout from module placements
        const homeSpecs = activeSpecs.filter((s: any) => {
          const placements = Array.isArray(s.placements) ? s.placements : [];
          return placements.includes("homescreen");
        });
        const layoutItems: LayoutItem[] = homeSpecs.map((s: any, i: number) => ({
          moduleId: s.id,
          label: s.label,
          emoji: s.emoji,
          type: s.type,
          zone: s.isLive ? 1 : 3,
          order: i,
          width: s.isLive ? 1 : 2,
          isLive: s.isLive ?? false,
        }));
        setItems(layoutItems);
        setUnassigned([]);
      }
    } catch (e) {
      console.error("Failed to load layout:", e);
    }
  };

  // Get items for a specific zone, sorted by order
  const zoneItems = (zone: number) =>
    items.filter((i) => i.zone === zone).sort((a, b) => a.order - b.order);

  // Move item up within its zone
  const moveUp = (moduleId: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.moduleId === moduleId);
      if (!item) return prev;
      const zone = zoneItems(item.zone);
      const idx = zone.findIndex((i) => i.moduleId === moduleId);
      if (idx <= 0) return prev;
      const swapWith = zone[idx - 1];
      return prev.map((i) => {
        if (i.moduleId === moduleId) return { ...i, order: swapWith.order };
        if (i.moduleId === swapWith.moduleId) return { ...i, order: item.order };
        return i;
      });
    });
    setHasChanges(true);
  };

  // Move item down within its zone
  const moveDown = (moduleId: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.moduleId === moduleId);
      if (!item) return prev;
      const zone = zoneItems(item.zone);
      const idx = zone.findIndex((i) => i.moduleId === moduleId);
      if (idx >= zone.length - 1) return prev;
      const swapWith = zone[idx + 1];
      return prev.map((i) => {
        if (i.moduleId === moduleId) return { ...i, order: swapWith.order };
        if (i.moduleId === swapWith.moduleId) return { ...i, order: item.order };
        return i;
      });
    });
    setHasChanges(true);
  };

  // Toggle width between 1 (half) and 2 (full)
  const toggleWidth = (moduleId: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.moduleId === moduleId
          ? { ...i, width: i.width === 1 ? 2 : 1 }
          : i
      )
    );
    setHasChanges(true);
  };

  // Move item to a different zone
  const moveToZone = (moduleId: string, newZone: number) => {
    setItems((prev) => {
      const zoneCount = prev.filter((i) => i.zone === newZone).length;
      return prev.map((i) =>
        i.moduleId === moduleId
          ? { ...i, zone: newZone, order: zoneCount }
          : i
      );
    });
    setHasChanges(true);
  };

  // Add unassigned module to a zone
  const addModule = (spec: any, zone: number) => {
    const zoneCount = items.filter((i) => i.zone === zone).length;
    setItems((prev) => [
      ...prev,
      {
        moduleId: spec.id,
        label: spec.label,
        emoji: spec.emoji,
        type: spec.type,
        zone,
        order: zoneCount,
        width: zone === 1 ? 1 : 2,
        isLive: spec.isLive ?? false,
      },
    ]);
    setUnassigned((prev) => prev.filter((s) => s.id !== spec.id));
    setHasChanges(true);
  };

  // Remove from layout
  const removeItem = (moduleId: string) => {
    const item = items.find((i) => i.moduleId === moduleId);
    if (!item) return;
    setItems((prev) => prev.filter((i) => i.moduleId !== moduleId));
    // Find the spec from current items to add to unassigned
    setUnassigned((prev) => [
      ...prev,
      { id: item.moduleId, label: item.label, emoji: item.emoji, type: item.type, isLive: item.isLive },
    ]);
    setHasChanges(true);
  };

  // Save layout to DB
  const handleSave = async () => {
    if (!db) return;
    setSaving(true);
    try {
      // Normalize order values
      const normalized: Array<{ moduleId: string; zone: number; order: number; width: number }> = [];
      for (const zone of [1, 2, 3]) {
        const zItems = items.filter((i) => i.zone === zone).sort((a, b) => a.order - b.order);
        zItems.forEach((item, idx) => {
          normalized.push({ moduleId: item.moduleId, zone, order: idx, width: item.width });
        });
      }
      await setHomescreenLayout(db, normalized);
      setHasChanges(false);
      router.back();
    } catch (e) {
      Alert.alert("Error", "Could not save layout.");
    } finally {
      setSaving(false);
    }
  };

  const renderZone = (zone: number) => {
    const zItems = zoneItems(zone);
    return (
      <View key={zone} style={styles.zoneSection}>
        <View style={styles.zoneHeader}>
          <Feather name={ZONE_ICONS[zone] as any} size={18} color={themeColors.accent} />
          <Text style={[styles.zoneTitle, { color: themeColors.text }]}>{ZONE_NAMES[zone]}</Text>
          <Text style={[styles.zoneCount, { color: themeColors.accent, backgroundColor: themeColors.accentLight }]}>{zItems.length}</Text>
        </View>

        {zItems.length > 0 ? (
          <View style={styles.gridPreview}>
            {zItems.map((item, index) => (
              <View
                key={item.moduleId}
                style={[
                  styles.gridItem,
                  { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                  item.width === 2 ? styles.gridItemFull : styles.gridItemHalf,
                ]}
              >
                <View style={styles.gridItemContent}>
                  <View style={styles.gridItemInfo}>
                    {item.emoji ? (
                      <Text style={styles.gridItemEmoji}>{item.emoji}</Text>
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.gridItemLabel, { color: themeColors.text }]} numberOfLines={1}>{item.label}</Text>
                      <Text style={[styles.gridItemType, { color: themeColors.muted }]}>{item.type}</Text>
                    </View>
                  </View>

                  <View style={styles.gridItemActions}>
                    {/* Width toggle */}
                    <Pressable
                      style={[styles.actionBtn, { backgroundColor: themeColors.background }]}
                      onPress={() => toggleWidth(item.moduleId)}
                    >
                      <Feather
                        name={item.width === 2 ? "minimize-2" : "maximize-2"}
                        size={14}
                        color={themeColors.muted}
                      />
                    </Pressable>

                    {/* Move up */}
                    <Pressable
                      style={[styles.actionBtn, { backgroundColor: themeColors.background }, index === 0 && styles.actionBtnDisabled]}
                      onPress={() => moveUp(item.moduleId)}
                      disabled={index === 0}
                    >
                      <Feather name="chevron-up" size={14} color={index === 0 ? themeColors.border : themeColors.muted} />
                    </Pressable>

                    {/* Move down */}
                    <Pressable
                      style={[styles.actionBtn, { backgroundColor: themeColors.background }, index === zItems.length - 1 && styles.actionBtnDisabled]}
                      onPress={() => moveDown(item.moduleId)}
                      disabled={index === zItems.length - 1}
                    >
                      <Feather name="chevron-down" size={14} color={index === zItems.length - 1 ? themeColors.border : themeColors.muted} />
                    </Pressable>

                    {/* Zone switcher */}
                    <Pressable
                      style={[styles.actionBtn, { backgroundColor: themeColors.background }]}
                      onPress={() => {
                        const otherZones = [1, 2, 3].filter((z) => z !== zone);
                        Alert.alert(
                          "Move to zone",
                          "Which zone?",
                          [
                            ...otherZones.map((z) => ({
                              text: ZONE_NAMES[z],
                              onPress: () => moveToZone(item.moduleId, z),
                            })),
                            { text: "Cancel", style: "cancel" as const },
                          ]
                        );
                      }}
                    >
                      <Feather name="move" size={14} color={themeColors.muted} />
                    </Pressable>

                    {/* Remove */}
                    <Pressable
                      style={[styles.actionBtn, { backgroundColor: themeColors.background }]}
                      onPress={() => removeItem(item.moduleId)}
                    >
                      <Feather name="x" size={14} color={themeColors.danger} />
                    </Pressable>
                  </View>
                </View>

                {/* Width indicator */}
                <View style={[styles.widthBar, { backgroundColor: themeColors.border }, item.width === 2 && { backgroundColor: themeColors.accent }]} />
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.emptyZone, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            <Text style={[styles.emptyZoneText, { color: themeColors.muted }]}>No modules in this zone</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: themeColors.text }]}>Edit Layout</Text>
          <Text style={[styles.subtitle, { color: themeColors.muted }]}>Reorder, resize, and move modules between zones</Text>
        </View>
        {hasChanges && (
          <Pressable style={[styles.saveBtn, { backgroundColor: themeColors.accent }]} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={themeColors.white} />
            ) : (
              <Text style={[styles.saveBtnText, { color: themeColors.white }]}>Save</Text>
            )}
          </Pressable>
        )}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <Feather name="maximize-2" size={12} color={themeColors.muted} />
          <Text style={[styles.legendText, { color: themeColors.muted }]}>Resize</Text>
        </View>
        <View style={styles.legendItem}>
          <Feather name="chevron-up" size={12} color={themeColors.muted} />
          <Feather name="chevron-down" size={12} color={themeColors.muted} style={{ marginLeft: -4 }} />
          <Text style={[styles.legendText, { color: themeColors.muted }]}>Reorder</Text>
        </View>
        <View style={styles.legendItem}>
          <Feather name="move" size={12} color={themeColors.muted} />
          <Text style={[styles.legendText, { color: themeColors.muted }]}>Move zone</Text>
        </View>
        <View style={styles.legendItem}>
          <Feather name="x" size={12} color={themeColors.danger} />
          <Text style={[styles.legendText, { color: themeColors.muted }]}>Remove</Text>
        </View>
      </View>

      {/* Zones */}
      {[1, 2, 3].map(renderZone)}

      {/* Unassigned modules */}
      {unassigned.length > 0 && (
        <View style={styles.zoneSection}>
          <View style={styles.zoneHeader}>
            <Feather name="inbox" size={18} color={themeColors.muted} />
            <Text style={[styles.zoneTitle, { color: themeColors.text }]}>Available Modules</Text>
            <Text style={[styles.zoneCount, { color: themeColors.accent, backgroundColor: themeColors.accentLight }]}>{unassigned.length}</Text>
          </View>

          {unassigned.map((spec: any) => (
            <View key={spec.id} style={[styles.unassignedItem, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <View style={styles.gridItemInfo}>
                {spec.emoji ? <Text style={styles.gridItemEmoji}>{spec.emoji}</Text> : null}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.gridItemLabel, { color: themeColors.text }]}>{spec.label}</Text>
                  <Text style={[styles.gridItemType, { color: themeColors.muted }]}>{spec.type}</Text>
                </View>
              </View>
              <View style={styles.addZoneBtns}>
                {[1, 2, 3].map((z) => (
                  <Pressable
                    key={z}
                    style={[styles.addZoneBtn, { backgroundColor: themeColors.accentLight }]}
                    onPress={() => addModule(spec, z)}
                  >
                    <Feather name={ZONE_ICONS[z] as any} size={12} color={themeColors.accent} />
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  title: { fontSize: fontSize.xxl, fontWeight: "800" },
  subtitle: { fontSize: fontSize.sm, marginTop: 2 },
  saveBtn: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    minWidth: 70,
    alignItems: "center",
  },
  saveBtnText: { fontWeight: "600", fontSize: fontSize.md },
  legend: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
    flexWrap: "wrap",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  legendText: { fontSize: fontSize.xs },

  zoneSection: { marginBottom: spacing.lg },
  zoneHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  zoneTitle: { fontSize: fontSize.lg, fontWeight: "700", flex: 1 },
  zoneCount: {
    fontSize: fontSize.xs, fontWeight: "600",
    borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden",
  },

  gridPreview: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  gridItem: {
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
  },
  gridItemHalf: {
    width: "48%",
  },
  gridItemFull: {
    width: "100%",
  },
  gridItemContent: { gap: spacing.xs },
  gridItemInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  gridItemEmoji: { fontSize: 20 },
  gridItemLabel: {
    fontSize: fontSize.sm, fontWeight: "600",
  },
  gridItemType: {
    fontSize: fontSize.xs, textTransform: "capitalize",
  },
  gridItemActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 2,
  },
  actionBtn: {
    width: 28, height: 28, borderRadius: borderRadius.sm,
    alignItems: "center", justifyContent: "center",
  },
  actionBtnDisabled: { opacity: 0.3 },
  widthBar: {
    height: 3,
    borderRadius: 2,
    marginTop: spacing.xs,
  },

  emptyZone: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
  },
  emptyZoneText: { fontSize: fontSize.sm },

  unassignedItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  addZoneBtns: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  addZoneBtn: {
    width: 30, height: 30, borderRadius: borderRadius.sm,
    alignItems: "center", justifyContent: "center",
  },
});
