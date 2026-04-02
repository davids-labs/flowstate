import React from 'react';
import { Redirect } from 'expo-router';

export default function LegacyStatisticsRedirect() {
  return <Redirect href="/insights" />;
}
