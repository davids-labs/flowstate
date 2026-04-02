import React from 'react';
import { Redirect } from 'expo-router';

export default function LegacyModulesCreateRedirect() {
  return <Redirect href="/trackers/edit" />;
}
