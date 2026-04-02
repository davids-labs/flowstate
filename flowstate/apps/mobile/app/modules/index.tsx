import React from 'react';
import { Redirect } from 'expo-router';

export default function LegacyModulesIndexRedirect() {
  return <Redirect href="/track" />;
}
