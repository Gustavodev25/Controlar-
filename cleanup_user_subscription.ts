// Debug log immediately
console.log("🚀 Script starting...");

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, updateDoc, getDoc, deleteField } from "firebase/firestore";
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

const TARGET_USER_ID = "nnCWcZn34BSaqeGoEtCfpkV8Bot2";

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

async function cleanupUserSubscription(userId: string) {
  try {
    console.log(`\n🔍 Fetching user data for: ${userId}`);
    
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      console.error("❌ User not found!");
      return;
    }
    
    const userData = userSnap.data();
    console.log("\n📋 Current subscription data:");
    console.log(JSON.stringify(userData.subscription, null, 2));
    
    const confirmation = await askQuestion("\n⚠️  This will REMOVE the canceled status, pro plan, and all Asaas IDs. Continue? (yes/no): ");
    
    if (confirmation.toLowerCase() !== 'yes') {
      console.log("❌ Operation cancelled.");
      rl.close();
      return;
    }
    
    console.log("\n🔄 Cleaning up subscription...");
    
    // Update subscription to remove canceled status and pro plan
    await updateDoc(userRef, {
      // Set plan to starter (base plan)
      "subscription.plan": "starter",
      
      // Remove canceled status - set to active or clear it
      "subscription.status": "active",
      
      // Remove all Asaas related IDs
      "subscription.asaasCustomerId": deleteField(),
      "subscription.asaasSubscriptionId": deleteField(),
      "subscription.asaasPaymentId": deleteField(),
      
      // Remove cancellation related dates
      "subscription.canceledAt": deleteField(),
      "subscription.accessUntil": deleteField(),
      "subscription.paymentFailedAt": deleteField(),
      "subscription.graceUntil": deleteField(),
      
      // Also update in profile if it exists
      "profile.subscription.plan": "starter",
      "profile.subscription.status": "active",
      "profile.subscription.asaasCustomerId": deleteField(),
      "profile.subscription.asaasSubscriptionId": deleteField(),
      "profile.subscription.asaasPaymentId": deleteField(),
      "profile.subscription.canceledAt": deleteField(),
      "profile.subscription.accessUntil": deleteField(),
      "profile.subscription.paymentFailedAt": deleteField(),
      "profile.subscription.graceUntil": deleteField(),
    });
    
    console.log("✅ Subscription cleaned up successfully!");
    
    console.log("\n📋 Verifying changes...");
    const updatedSnap = await getDoc(userRef);
    const updatedData = updatedSnap.data();
    console.log("Updated subscription data:");
    console.log(JSON.stringify(updatedData.subscription, null, 2));
    
    console.log("\n✨ All done! User can now sign up for Pro again.");
    
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  } finally {
    rl.close();
  }
}

async function main() {
  console.log("\n============================================");
  console.log("🔥 Controlar+ Admin Tool: Clean User Subscription");
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
      console.log("👉 You are the target user. Proceeding with cleanup...");
      await cleanupUserSubscription(user.uid);
    } else {
      console.log("👉 You are modifying ANOTHER user. Checking admin permissions...");
      
      const currentUserRef = doc(db, "users", user.uid);
      const currentUserSnap = await getDoc(currentUserRef);
      const currentUserData = currentUserSnap.data();
      
      const isRootAdmin = currentUserData?.isAdmin === true;
      const isProfileAdmin = currentUserData?.profile?.isAdmin === true;
      
      if (isRootAdmin || isProfileAdmin) {
        console.log("✅ You are an Admin. Proceeding with cleanup...");
        await cleanupUserSubscription(TARGET_USER_ID);
      } else {
        console.warn("⚠️  You are NOT an admin.");
        const makeAdmin = await askQuestion("Do you want to make YOURSELF an admin first? (y/n): ");
        
        if (makeAdmin.toLowerCase() === 'y') {
          console.log("Promoting logged-in user to Admin...");
          await updateDoc(currentUserRef, {
            "isAdmin": true,
            "profile.isAdmin": true
          });
          console.log("✅ You are now an Admin.");
          console.log("Proceeding with target user cleanup...");
          await cleanupUserSubscription(TARGET_USER_ID);
        } else {
          console.error("❌ Cannot update another user without Admin privileges.");
          rl.close();
        }
      }
    }
  } catch (error: any) {
    console.error("❌ Error during login:", error.message);
    rl.close();
  }
}

main();
