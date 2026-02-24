import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

// Firebase config from environment variables with fallback
// In production, set these via app.config.ts extra / EAS secrets
const firebaseConfig = {
  apiKey: (typeof process !== 'undefined' && process.env?.FIREBASE_API_KEY)
    || "AIzaSyBmgE2gI0FFE0UB6Uf9dneNzSOFUV-9fzo",
  authDomain: (typeof process !== 'undefined' && process.env?.FIREBASE_AUTH_DOMAIN)
    || "flowstate-afde4.firebaseapp.com",
  projectId: (typeof process !== 'undefined' && process.env?.FIREBASE_PROJECT_ID)
    || "flowstate-afde4",
  storageBucket: (typeof process !== 'undefined' && process.env?.FIREBASE_STORAGE_BUCKET)
    || "flowstate-afde4.firebasestorage.app",
  messagingSenderId: (typeof process !== 'undefined' && process.env?.FIREBASE_MESSAGING_SENDER_ID)
    || "693723347422",
  appId: (typeof process !== 'undefined' && process.env?.FIREBASE_APP_ID)
    || "1:693723347422:web:f19b6ba153c20ef1c7454f",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Use AsyncStorage for auth persistence in React Native, fallback to default web auth
let auth: Auth;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const rnAuth = require('firebase/auth');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  if (rnAuth.initializeAuth && rnAuth.getReactNativePersistence) {
    auth = rnAuth.initializeAuth(app, {
      persistence: rnAuth.getReactNativePersistence(AsyncStorage),
    });
  } else {
    auth = getAuth(app);
  }
} catch {
  // Fallback for web or environments without AsyncStorage
  auth = getAuth(app);
}

export { auth };