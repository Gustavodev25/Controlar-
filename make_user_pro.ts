// Debug log immediately
console.log("🚀 Script starting...");

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, updateDoc, getDoc } from "firebase/firestore";
import dotenv from 'dotenv';
import readline from 'readline';

console.log("📦 Imports loaded.");

dotenv.config();

console.log("🔧 Environment loaded.");

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyBGhm5J90b4fVlhmyP7bhVPliQZmQUSmmo",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "financeiro-609e1.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "financeiro-609e1",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "financeiro-609e1.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "412536649666",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:412536649666:web:f630c5be490c5539f1485b",
};

console.log("🔥 Initializing Firebase...");
let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  console.log("✅ Firebase initialized.");
} catch (e: any) {
  console.error("❌ Failed to initialize Firebase:", e.message);
  process.exit(1);
}

const TARGET_USER_ID = "DWYXTPR2DCZoxmR6qlnYXxQrrHo2";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query: string) => {
  return new Promise<string>(resolve => {
    rl.question(query, (answer) => {
      resolve(answer);
    });
  });
};

async function main() {
  console.log("\n============================================");
  console.log("🔥 Controlar+ Admin Tool: Upgrade User to PRO");
  console.log("============================================");
  console.log(`Target User ID: ${TARGET_USER_ID}`);
  console.log("\n⚠️  You need to sign in to perform this action.");
  
  try {
    const email = await askQuestion("✉️  Email: ");
    const password = await askQuestion("🔑 Password: ");

    console.log("\n⏳ Logging in...");
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log(`✅ Logged in as: ${user.email} (${user.uid})`);

    // Check if we are modifying ourselves
    if (user.uid === TARGET_USER_ID) {
      console.log("👉 You are the target user. Proceeding with upgrade...");
      await updateUserSubscription(user.uid);
    } else {
      console.log("👉 You are modifying ANOTHER user. Checking admin permissions...");
      
      const currentUserRef = doc(db, "users", user.uid);
      const currentUserSnap = await getDoc(currentUserRef);
      const currentUserData = currentUserSnap.data();
      
      const isRootAdmin = currentUserData?.isAdmin === true;
      const isProfileAdmin = currentUserData?.profile?.isAdmin === true;
      
      if (isRootAdmin || isProfileAdmin) {
        console.log("✅ You are an Admin. Proceeding with upgrade...");
        await updateUserSubscription(TARGET_USER_ID);
      } else {
        console.warn("⚠️  You are NOT an admin.");
        console.log("💡 Firestore rules allow users to edit their own profile.");
        const makeAdmin = await askQuestion("Do you want to make YOURSELF an admin first? (y/n): ");
        
        if (makeAdmin.toLowerCase() === 'y') {
          console.log("Promoting logged-in user to Admin...");
          await updateDoc(currentUserRef, {
            "isAdmin": true,
            "profile.isAdmin": true
          });
          console.log("✅ You are now an Admin.");
          console.log("Proceeding with target user upgrade...");
          await updateUserSubscription(TARGET_USER_ID);
        } else {
          console.error("❌ Cannot update another user without Admin privileges.");
          process.exit(1);
        }
      }
    }

  } catch (error: any) {
    if (error.code === 'auth/invalid-credential') {
      console.error("\n❌ Login failed: Invalid email or password.");
      console.error("   Please double-check your credentials.");
      console.error("   Tip: Check for typos in the domain (e.g., 'controlarrmais' vs 'controlarmais').");
    } else {
      console.error("\n❌ Error:", error.message);
      if (error.code === 'permission-denied') {
          console.log("💡 Tip: Try logging in as the target user directly, OR accept the option to make yourself an admin.");
      }
    }
  } finally {
    rl.close();
    // Allow stdout to flush and handles to close gracefully
    setTimeout(() => process.exit(0), 1000);
  }
}

async function updateUserSubscription(userId: string) {
    const targetRef = doc(db, "users", userId);
    const snap = await getDoc(targetRef);
    
    if (!snap.exists()) {
        // If user doesn't exist, we might need to create it or fail
        console.error(`❌ Target user doc ${userId} not found.`);
        return;
    }

    console.log(`Updating subscription for ${userId}...`);
    await updateDoc(targetRef, {
      "subscription": {
        plan: 'pro',
        status: 'active',
        billingCycle: 'annual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      // Duplicate to profile to be safe
      "profile.subscription": {
        plan: 'pro',
        status: 'active',
        billingCycle: 'annual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });
    console.log(`\n🎉 Success! User ${userId} is now PRO.`);
}

main();

