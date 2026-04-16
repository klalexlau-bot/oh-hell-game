import { initializeApp } from 'firebase/app';

// ─────────────────────────────────────────────────────────────────────────────
// Replace lines 6–11 with your values from:
// Firebase Console → Project Settings → Your Apps → SDK setup and configuration
// ─────────────────────────────────────────────────────────────────────────────
const firebaseConfig = {
   apiKey: "AIzaSyCxDd2gy6aJpHugS_TC7roEs8CLA5pFk_Y",

  authDomain: "oh-hell-game.firebaseapp.com",

  projectId: "oh-hell-game",

  storageBucket: "oh-hell-game.firebasestorage.app",

  messagingSenderId: "834045930688",

  appId: "1:834045930688:web:03de560dcc75605b639125

};

export const app = initializeApp(firebaseConfig);
