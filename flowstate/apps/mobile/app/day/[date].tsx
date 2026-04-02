import React from 'react';
import { Redirect } from 'expo-router';

export default function LegacyDayRedirect() {
  return <Redirect href="/plan" />;
}
