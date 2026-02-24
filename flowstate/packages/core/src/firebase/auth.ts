import {
  signInAnonymously,
  GoogleAuthProvider,
  signInWithCredential,
  linkWithCredential,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { getAuthInstance } from './config';

let _currentUser: User | null = null;
let _uid: string | null = null;

/**
 * Get the current Firebase UID.
 * Returns null if not signed in yet.
 */
export function getUid(): string | null {
  return _uid;
}

/**
 * Get the current Firebase User object.
 */
export function getCurrentUser(): User | null {
  return _currentUser;
}

/**
 * Sign in anonymously on first launch.
 * Returns the UID. Safe to call multiple times — if already signed in,
 * returns the existing UID without creating a new anonymous account.
 */
export async function signInAnon(): Promise<string> {
  if (_uid) return _uid;

  try {
    const result = await signInAnonymously(getAuthInstance());
    _currentUser = result.user;
    _uid = result.user.uid;
    return _uid;
  } catch (err) {
    console.error('[FlowState] Anonymous sign-in failed:', err);
    throw err;
  }
}

/**
 * Link an anonymous account to a Google account.
 * The user keeps the same UID — all Firestore data stays attached.
 *
 * @param idToken - Google ID token from the sign-in flow
 */
export async function linkGoogleAccount(idToken: string): Promise<User> {
  const user = getAuthInstance().currentUser;
  if (!user) throw new Error('No signed-in user to link');

  const credential = GoogleAuthProvider.credential(idToken);

  try {
    const result = await linkWithCredential(user, credential);
    _currentUser = result.user;
    return result.user;
  } catch (err: any) {
    // If account already linked or credential already in use,
    // sign in with the Google credential directly
    if (err.code === 'auth/credential-already-in-use' || err.code === 'auth/provider-already-linked') {
      const result = await signInWithCredential(getAuthInstance(), credential);
      _currentUser = result.user;
      _uid = result.user.uid;
      return result.user;
    }
    throw err;
  }
}

/**
 * Listen for auth state changes.
 * Call this once at app startup to keep _currentUser and _uid in sync.
 */
export function listenAuthState(
  onUser: (user: User | null) => void,
): () => void {
  return onAuthStateChanged(getAuthInstance(), (user) => {
    _currentUser = user;
    _uid = user?.uid ?? null;
    onUser(user);
  });
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
  await getAuthInstance().signOut();
  _currentUser = null;
  _uid = null;
}
