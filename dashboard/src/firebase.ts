import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const env = import.meta.env;
const projectId = env.VITE_FIREBASE_PROJECT_ID || "demo-verified-sms";

export const USING_EMULATORS = env.VITE_USE_EMULATORS === "true";

/** Guest mode: visitors enter the dashboard without a login (Firebase anonymous sign-in). */
export const GUEST_MODE = env.VITE_GUEST_MODE !== "false";
export const GUEST_INSTITUTION_ID: string = env.VITE_GUEST_INSTITUTION_ID || "demo-bank";

/** Google Drive share link for the Android app APK. Empty = no download offered. */
export const APK_URL: string = (env.VITE_APK_URL || "").trim();

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY || "demo-api-key",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
  projectId,
});

export const auth = getAuth(app);
export const db = getFirestore(app);

if (USING_EMULATORS) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

export const API_BASE: string =
  env.VITE_API_BASE || `http://127.0.0.1:5001/${projectId}/asia-south1/api`;
