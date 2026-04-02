declare module 'expo-updates' {
  export const isEnabled: boolean;
  export function checkForUpdateAsync(): Promise<{ isAvailable: boolean }>;
  export function fetchUpdateAsync(): Promise<unknown>;
  export function reloadAsync(): Promise<void>;
}
