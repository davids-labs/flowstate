import React, { useState } from 'react';
import { View, Pressable, StyleSheet, TextInput, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '../../components/primitives/Text';
import { useTheme } from '../../constants/ThemeContext';
import { space, radius } from '../../constants/theme';
import { useUserPrefsStore, type Pillar } from '../../stores/userPrefsStore';

const PRESET_COLORS = ['#E53E3E', '#3B82F6', '#10B981', '#4F46E5', '#F59E0B', '#EC4899'];

export default function PillarColoursScreen() {
  const router = useRouter();
  const { themeTokens } = useTheme();
  const { getPillarColour, setPillarColour, getPillarTint } = useUserPrefsStore();

  const pillars: Pillar[] = ['gym', 'academic', 'life'];
  const [editing, setEditing] = useState<Pillar | null>(null);
  const [hex, setHex] = useState('');

  const startEdit = (p: Pillar) => {
    setEditing(p);
    setHex(getPillarColour(p));
  };

  const applyHex = () => {
    if (!editing) return;
    const val = hex.trim();
    if (!/^#?[0-9A-Fa-f]{6}$/.test(val)) return;
    const normalized = val.startsWith('#') ? val : `#${val}`;
    setPillarColour(editing, normalized);
    setEditing(null);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: themeTokens.background }} contentContainerStyle={{ padding: space[16], gap: space[12] }}>
      <AppText variant="title2" style={{ fontWeight: '700' }}>Pillar Colours</AppText>
      <AppText variant="body" color={themeTokens.textSecondary}>Choose the primary colour for each pillar. Tap a pillar to edit.</AppText>

      {pillars.map(p => (
        <View key={p} style={[styles.row, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }] }>
          <View style={{ flex: 1 }}>
            <AppText variant="headline" style={{ fontWeight: '600' }}>{p.toUpperCase()}</AppText>
            <AppText variant="footnote" color={themeTokens.textSecondary} style={{ marginTop: 6 }}>{getPillarColour(p)}</AppText>
          </View>
          <View style={{ alignItems: 'center' }}>
            <View style={[styles.preview, { backgroundColor: getPillarColour(p) }]} />
            <Pressable onPress={() => startEdit(p)} style={styles.editBtn}>
              <AppText variant="subheadline" onAccent>Edit</AppText>
            </Pressable>
          </View>
        </View>
      ))}

      {editing && (
        <View style={[styles.editor, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }] }>
          <AppText variant="subheadline" style={{ fontWeight: '600' }}>Editing {editing.toUpperCase()}</AppText>
          <View style={{ flexDirection: 'row', gap: space[8], marginTop: space[12], flexWrap: 'wrap' }}>
            {PRESET_COLORS.map(c => (
              <Pressable key={c} onPress={() => setHex(c)} style={[styles.preset, { backgroundColor: c }]} />
            ))}
          </View>
          <TextInput
            value={hex}
            onChangeText={setHex}
            placeholder="#RRGGBB"
            style={[styles.input, { color: themeTokens.text, borderColor: themeTokens.border, backgroundColor: themeTokens.surfaceInput }]}
            placeholderTextColor={themeTokens.textPlaceholder}
            autoCapitalize="none"
          />
          <View style={{ flexDirection: 'row', gap: space[8] }}>
            <Pressable style={[styles.saveBtn, { backgroundColor: themeTokens.accent }]} onPress={applyHex}>
              <AppText variant="headline" onAccent>Save</AppText>
            </Pressable>
            <Pressable style={[styles.saveBtn, { backgroundColor: themeTokens.surface }]} onPress={() => setEditing(null)}>
              <AppText variant="headline">Cancel</AppText>
            </Pressable>
          </View>
        </View>
      )}

      <Pressable style={[styles.doneBtn, { backgroundColor: themeTokens.accent }]} onPress={() => router.back()}>
        <AppText variant="headline" onAccent>Done</AppText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  preview: { width: 40, height: 40, borderRadius: 8, marginBottom: 8 },
  editBtn: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, backgroundColor: '#111827', marginTop: 6 },
  editor: { padding: 12, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: 12 },
  preset: { width: 40, height: 40, borderRadius: 8, marginBottom: 8 },
  input: { height: 44, borderRadius: 8, paddingHorizontal: 12, marginTop: 8, borderWidth: 1 },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginTop: 12 },
  doneBtn: { marginTop: 20, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
});
