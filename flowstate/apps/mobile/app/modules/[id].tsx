import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function LegacyModuleDetailRedirect() {
  const params = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/trackers/[id]', params: { id: String(params.id) } }} />;
}
