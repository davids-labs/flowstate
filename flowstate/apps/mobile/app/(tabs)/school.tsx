import React from 'react';
import { Redirect } from 'expo-router';

export default function LegacySchoolRedirect() {
  return <Redirect href="/track" />;
}
