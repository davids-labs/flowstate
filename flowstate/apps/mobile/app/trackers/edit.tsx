import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../constants/ThemeContext';
import { TrackerEditor } from '../../components/trackers/TrackerEditor';

export default function TrackerEditScreen() {
  const { themeTokens } = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeTokens.background }}>
      <TrackerEditor trackerId={params.id} />
    </SafeAreaView>
  );
}
