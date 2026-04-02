import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function LegacyModulesEditRedirect() {
  const params = useLocalSearchParams<{ id?: string }>();
  return <Redirect href={params.id ? { pathname: '/trackers/edit', params: { id: String(params.id) } } : '/trackers/edit'} />;
}
