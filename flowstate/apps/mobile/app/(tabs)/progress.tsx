import React from 'react';
import { Redirect } from 'expo-router';

export default function LegacyProgressRedirect() {
  return <Redirect href="/insights" />;
}
