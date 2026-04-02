import React from 'react';
import { Redirect } from 'expo-router';

export default function LegacyMoreRedirect() {
  return <Redirect href="/settings" />;
}
