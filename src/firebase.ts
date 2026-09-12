import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocFromServer,
  collection,
  query,
  orderBy,
  limit,
  getDocs
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// CRITICAL: Must supply firestoreDatabaseId
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Error handling conforming strictly to FirestoreErrorInfo
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection validation on boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase Firestore connection verified');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export interface UserProfileData {
  userId: string;
  displayName: string;
  email?: string;
  photoURL?: string;
  totalWins: number;
  totalKills: number;
  totalDeaths?: number;
  totalMatches: number;
  favoriteClass?: string;
  rating?: number;
  rankPoints?: number;
  createdAt: string;
  updatedAt: string;
}

export interface LeaderboardEntryData {
  userId: string;
  displayName: string;
  totalWins: number;
  totalKills: number;
  rating?: number;
  updatedAt: string;
}

export interface MatchHistoryData {
  id: string;
  userId: string;
  mode: string;
  placement: number;
  kills: number;
  ratingChange: number;
  newRating: number;
  createdAt: string;
}

// User Profile Operations
export async function loadOrCreateUserProfile(user: User): Promise<UserProfileData> {
  const userPath = `users/${user.uid}`;
  try {
    const docRef = doc(db, 'users', user.uid);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      return snap.data() as UserProfileData;
    }

    const newProfile: UserProfileData = {
      userId: user.uid,
      displayName: user.displayName || 'Player',
      email: user.email || '',
      photoURL: user.photoURL || '',
      totalWins: 0,
      totalKills: 0,
      totalDeaths: 0,
      totalMatches: 0,
      rating: 2000,
      rankPoints: 0,
      favoriteClass: 'assault',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(docRef, newProfile);
    return newProfile;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, userPath);
  }
}

export async function updateUserStats(
  userId: string,
  won: boolean,
  kills: number,
  deaths: number,
  favClass: string,
  ratingChange: number = 0,
  newRating: number = 2000,
  mode: string = 'casual'
): Promise<void> {
  const userPath = `users/${userId}`;
  try {
    const docRef = doc(db, 'users', userId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;

    const current = snap.data() as UserProfileData;
    const updated: UserProfileData = {
      ...current,
      totalWins: current.totalWins + (won ? 1 : 0),
      totalKills: current.totalKills + kills,
      totalDeaths: (current.totalDeaths || 0) + deaths,
      totalMatches: current.totalMatches + 1,
      rating: newRating,
      rankPoints: newRating,
      favoriteClass: favClass,
      updatedAt: new Date().toISOString(),
    };

    await setDoc(docRef, updated);

    // Also update public leaderboard
    const lbRef = doc(db, 'leaderboard', userId);
    const lbData: LeaderboardEntryData = {
      userId,
      displayName: updated.displayName,
      totalWins: updated.totalWins,
      totalKills: updated.totalKills,
      rating: newRating,
      updatedAt: updated.updatedAt,
    };
    await setDoc(lbRef, lbData);
    
    // Add match history
    const historyId = Math.random().toString(36).substring(2, 15);
    const historyRef = doc(db, 'users', userId, 'history', historyId);
    const historyData: MatchHistoryData = {
      id: historyId,
      userId,
      mode,
      placement: won ? 1 : 2,
      kills,
      ratingChange,
      newRating,
      createdAt: updated.updatedAt,
    };
    await setDoc(historyRef, historyData);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, userPath);
  }
}

export async function fetchTopLeaderboard(): Promise<LeaderboardEntryData[]> {
  const lbPath = 'leaderboard';
  try {
    const q = query(collection(db, 'leaderboard'), orderBy('totalWins', 'desc'), limit(10));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as LeaderboardEntryData);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, lbPath);
  }
}

// Authentication Helpers
export async function loginWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Google Auth Error:', error);
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign Out Error:', error);
  }
}

export async function fetchUserHistory(userId: string): Promise<MatchHistoryData[]> {
  const historyPath = `users/${userId}/history`;
  try {
    const q = query(collection(db, 'users', userId, 'history'), orderBy('createdAt', 'desc'), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as MatchHistoryData);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, historyPath);
  }
}
