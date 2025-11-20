import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

// Configuracao do Firebase (fornecida)
const firebaseConfig = {
  apiKey: "AIzaSyBGhm5J90b4fVlhmyP7bhVPliQZmQUSmmo",
  authDomain: "financeiro-609e1.firebaseapp.com",
  databaseURL: "https://financeiro-609e1-default-rtdb.firebaseio.com",
  projectId: "financeiro-609e1",
  storageBucket: "financeiro-609e1.firebasestorage.app",
  messagingSenderId: "412536649666",
  appId: "1:412536649666:web:f630c5be490c5539f1485b",
  measurementId: "G-QSH7W2GYXD"
};

let app;
let auth;
let database;
let realtimeDb;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  // Long polling helps in restricted networks that block WebSockets
  database = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  realtimeDb = getDatabase(app);
} catch (error) {
  console.error("Erro ao inicializar Firebase:", error);
  auth = null as any;
  database = null as any;
  realtimeDb = null as any;
}

export { app, auth, database, realtimeDb };
