import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function LegacyModuleRemindersRedirect() {
  const params = useLocalSearchParams<{ moduleId?: string }>();
  if (!params.moduleId) return <Redirect href="/library" />;
  return <Redirect href={{ pathname: '/trackers/[id]', params: { id: String(params.moduleId) } }} />;
}
