
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// --- CONFIGURAÇÃO DO FIREBASE ---
// NOTA: Esta é uma configuração de exemplo. 
// Em um ambiente real, você deve substituir pelos dados do seu console Firebase.
const firebaseConfig = {
  apiKey: "api-key-placeholder",
  authDomain: "project-id.firebaseapp.com",
  projectId: "project-id",
  storageBucket: "project-id.appspot.com",
  messagingSenderId: "sender-id",
  appId: "app-id"
};

// Initialize Firebase
let app;
let auth;
let database;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    database = getFirestore(app);
    console.log("Firebase initialized successfully");
} catch (error) {
    console.error("Erro ao inicializar Firebase.", error);
    // Fallback object to prevent immediate crashes if config is invalid, 
    // allowing the UI to at least render (though auth won't work).
    auth = {
        onAuthStateChanged: () => {},
        signInWithEmailAndPassword: async () => { throw new Error("Firebase não configurado corretamente."); },
        createUserWithEmailAndPassword: async () => { throw new Error("Firebase não configurado corretamente."); },
        currentUser: null,
        signOut: async () => {}
    } as any;
    database = {} as any;
}

export { auth, database };
