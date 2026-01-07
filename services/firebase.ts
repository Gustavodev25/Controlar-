import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

// Configuracao do Firebase usando variáveis de ambiente
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBGhm5J90b4fVlhmyP7bhVPliQZmQUSmmo",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "financeiro-609e1.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://financeiro-609e1-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "financeiro-609e1",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "financeiro-609e1.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "412536649666",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:412536649666:web:f630c5be490c5539f1485b",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-QSH7W2GYXD"
};

// Log para debug (remover em produção)
// console.log("Firebase Config:", {
//   ...firebaseConfig,
//   apiKey: firebaseConfig.apiKey.substring(0, 10) + "..." // Ocultar parte da chave
// });

let app;
let auth;
let database;
let realtimeDb;
let storage;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  // Force long polling and disable fetch streams to avoid QUIC/HTTP3 issues in some networks
  database = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    useFetchStreams: false,
    ignoreUndefinedProperties: true
  });
  realtimeDb = getDatabase(app);
  storage = getStorage(app);
} catch (error) {
  console.error("Erro ao inicializar Firebase:", error);
  auth = null as any;
  database = null as any;
  realtimeDb = null as any;
  storage = null as any;
}

export { app, auth, database, realtimeDb, storage };
