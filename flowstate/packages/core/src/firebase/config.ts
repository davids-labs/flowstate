import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
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

// ─── Lazy initialization ────────────────────────────────────────
// All Firebase services are created on first use so the module
// can load successfully even when Firebase SDK is misconfigured.

let _app: FirebaseApp | null = null;

export function getAppInstance(): FirebaseApp {
  if (!_app) _app = initializeApp(firebaseConfig);
  return _app;
}

/** @deprecated Use getAppInstance() — kept for backwards compat */
export const app: FirebaseApp = null as unknown as FirebaseApp;

let _db: Firestore | null = null;

export function getDbInstance(): Firestore {
  if (!_db) _db = getFirestore(getAppInstance());
  return _db;
}

let _auth: Auth | null = null;

export function getAuthInstance(): Auth {
  if (_auth) return _auth;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rnAuth = require('firebase/auth');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    if (rnAuth.initializeAuth && rnAuth.getReactNativePersistence) {
      _auth = rnAuth.initializeAuth(getAppInstance(), {
        persistence: rnAuth.getReactNativePersistence(AsyncStorage),
      });
    } else {
      _auth = getAuth(getAppInstance());
    }
  } catch {
    _auth = getAuth(getAppInstance());
  }

  return _auth;
}