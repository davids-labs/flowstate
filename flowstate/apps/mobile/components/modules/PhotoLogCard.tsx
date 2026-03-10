import React, { useState } from 'react';
import { View, Text, Pressable, Image, StyleSheet, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

interface PhotoLogCardProps {
  label: string;
  emoji?: string;
  /** Comma-separated filenames stored in documentDirectory */
  value: string;
  onValueChange: (value: string) => void;
  maxPhotosPerDay?: number;
  prompt?: string;
  compact?: boolean;
}

export function PhotoLogCard({
  label,
  emoji,
  value,
  onValueChange,
  maxPhotosPerDay = 1,
  prompt,
  compact,
}: PhotoLogCardProps) {
  const { themeColors } = useTheme();
  const [capturing, setCapturing] = useState(false);
  const photos = value ? value.split(',').filter(Boolean) : [];
  const canAdd = photos.length < maxPhotosPerDay;

  const handleCapture = async () => {
    if (!canAdd || capturing) return;
    setCapturing(true);

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera access is needed to take photos.');
        setCapturing(false);
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.[0]) {
        setCapturing(false);
        return;
      }

      const sourceUri = result.assets[0].uri;
      const filename = `photo_${Date.now()}.jpg`;
      const destUri = `${FileSystem.documentDirectory}photos/`;

      // Ensure directory exists
      const dirInfo = await FileSystem.getInfoAsync(destUri);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(destUri, { intermediates: true });
      }

      // Copy file to app storage
      await FileSystem.copyAsync({
        from: sourceUri,
        to: destUri + filename,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const newPhotos = [...photos, filename];
      onValueChange(newPhotos.join(','));
    } catch (e) {
      console.error('Photo capture failed:', e);
      Alert.alert('Error', 'Failed to capture photo.');
    } finally {
      setCapturing(false);
    }
  };

  const handlePickFromLibrary = async () => {
    if (!canAdd || capturing) return;
    setCapturing(true);

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Photo library access is needed.');
        setCapturing(false);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.[0]) {
        setCapturing(false);
        return;
      }

      const sourceUri = result.assets[0].uri;
      const filename = `photo_${Date.now()}.jpg`;
      const destUri = `${FileSystem.documentDirectory}photos/`;

      const dirInfo = await FileSystem.getInfoAsync(destUri);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(destUri, { intermediates: true });
      }

      await FileSystem.copyAsync({
        from: sourceUri,
        to: destUri + filename,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const newPhotos = [...photos, filename];
      onValueChange(newPhotos.join(','));
    } catch (e) {
      console.error('Photo pick failed:', e);
      Alert.alert('Error', 'Failed to pick photo.');
    } finally {
      setCapturing(false);
    }
  };

  const handleRemove = (index: number) => {
    Alert.alert('Remove Photo', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const filename = photos[index];
          try {
            await FileSystem.deleteAsync(
              `${FileSystem.documentDirectory}photos/${filename}`,
              { idempotent: true },
            );
          } catch {}
          const newPhotos = photos.filter((_, i) => i !== index);
          onValueChange(newPhotos.join(','));
        },
      },
    ]);
  };

  return (
    <View style={[styles.card, { backgroundColor: themeColors.surface }]}>
      <View style={styles.labelRow}>
        <Feather name="image" size={18} color={themeColors.accent} style={styles.icon} />
        <Text style={[styles.label, { color: themeColors.text }]}>{label}</Text>
        <Text style={[styles.count, { color: themeColors.muted }]}>{photos.length}/{maxPhotosPerDay}</Text>
      </View>

      {prompt && <Text style={[styles.prompt, { color: themeColors.textSecondary }]}>{prompt}</Text>}

      {/* Photo grid */}
      {photos.length > 0 && (
        <View style={styles.photoGrid}>
          {photos.map((filename, i) => (
            <Pressable key={filename} onLongPress={() => handleRemove(i)}>
              <Image
                source={{ uri: `${FileSystem.documentDirectory}photos/${filename}` }}
                style={[styles.photo, { backgroundColor: themeColors.surfaceBorder }]}
              />
            </Pressable>
          ))}
        </View>
      )}

      {/* Capture buttons */}
      {canAdd && (
        <View style={styles.btnRow}>
          <Pressable style={[styles.captureBtn, { backgroundColor: themeColors.accent }]} onPress={handleCapture} disabled={capturing}>
            <Feather name="camera" size={18} color={themeColors.white} />
            <Text style={[styles.captureBtnText, { color: themeColors.white }]}>
              {capturing ? 'Capturing...' : 'Take Photo'}
            </Text>
          </Pressable>
          <Pressable style={[styles.libraryBtn, { borderColor: themeColors.accent }]} onPress={handlePickFromLibrary} disabled={capturing}>
            <Feather name="image" size={18} color={themeColors.accent} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  emoji: {
    fontSize: fontSize.lg,
  },
  icon: { marginRight: spacing.xs },
  label: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  count: {
    fontSize: fontSize.sm,
  },
  prompt: {
    fontSize: fontSize.sm,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.sm,
  },
  btnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  captureBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
  },
  captureBtnText: {
    fontWeight: '600',
    fontSize: fontSize.md,
  },
  libraryBtn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
