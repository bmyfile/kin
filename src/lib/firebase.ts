import { initializeApp, getApps } from "firebase/app";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";
import { initializeFirestore, persistentLocalCache } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only if it hasn't been initialized already and we have a config
const app = getApps().length === 0 
  ? (firebaseConfig.apiKey ? initializeApp(firebaseConfig) : null) 
  : getApps()[0];

export const auth = app ? getAuth(app) : ({} as any);

// Persist auth state so re-auth is faster on page reload (browser only)
if (typeof window !== "undefined" && app) {
  setPersistence(auth, browserLocalPersistence);
}

// Firestore with persistent local cache for faster loading
export const db = app ? initializeFirestore(app, {
  localCache: persistentLocalCache(),
}) : ({} as any);

if (!firebaseConfig.apiKey) {
  console.warn("Firebase configuration is missing. This is expected during build time if environment variables are not set, but required for runtime.");
}

