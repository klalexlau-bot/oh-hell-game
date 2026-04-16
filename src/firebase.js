import { initializeApp } from 'firebase/app';

// ─────────────────────────────────────────────────────────────────────────────
// Replace lines 6–11 with your values from:
// Firebase Console → Project Settings → Your Apps → SDK setup and configuration
// ─────────────────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "REPLACE_THIS",   // line 6  ← replace
  authDomain:        "REPLACE_THIS",   // line 7  ← replace
  projectId:         "REPLACE_THIS",   // line 8  ← replace
  storageBucket:     "REPLACE_THIS",   // line 9  ← replace
  messagingSenderId: "REPLACE_THIS",   // line 10 ← replace
  appId:             "REPLACE_THIS",   // line 11 ← replace
};

export const app = initializeApp(firebaseConfig);
