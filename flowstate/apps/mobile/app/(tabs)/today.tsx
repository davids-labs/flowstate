import React from 'react';
import { Redirect } from 'expo-router';

export default function LegacyTodayRedirect() {
  return <Redirect href="/(tabs)" />;
}
