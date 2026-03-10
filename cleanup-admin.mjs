#!/usr/bin/env node

import { loadEnv } from './api/_lib/env.js';

loadEnv();

import admin from 'firebase-admin';

const initFirebaseAdmin = async () => {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.VITE_FIREBASE_PROJECT_ID || "financeiro-609e1"
      });
      console.log('✅ Firebase Admin Initialized\n');
      return true;
    } else {
      console.error('❌ FIREBASE_SERVICE_ACCOUNT not found in .env');
      return false;
    }
  } catch (error) {
    console.error('❌ Firebase Admin Init Error:', error.message);
    return false;
  }
};

async function cleanupUserSubscription(userId) {
  try {
    console.log(`🔍 Fetching user data for: ${userId}`);
    
    const db = admin.firestore();
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    
    if (!userSnap.exists) {
      console.error("❌ User not found!");
      return false;
    }
    
    const userData = userSnap.data();
    console.log("\n📋 Current subscription data:");
    console.log(JSON.stringify(userData.subscription, null, 2));
    
    console.log("\n⚠️  Removing canceled status, pro plan, and all Asaas IDs...\n");
    
    // Update subscription to remove canceled status and pro plan
    await userRef.update({
      // Set plan to starter (base plan)
      "subscription.plan": "starter",
      
      // Remove canceled status - set to active or clear it
      "subscription.status": "active",
      
      // Remove all Asaas related IDs
      "subscription.asaasCustomerId": admin.firestore.FieldValue.delete(),
      "subscription.asaasSubscriptionId": admin.firestore.FieldValue.delete(),
      "subscription.asaasPaymentId": admin.firestore.FieldValue.delete(),
      
      // Remove cancellation related dates
      "subscription.canceledAt": admin.firestore.FieldValue.delete(),
      "subscription.accessUntil": admin.firestore.FieldValue.delete(),
      "subscription.paymentFailedAt": admin.firestore.FieldValue.delete(),
      "subscription.graceUntil": admin.firestore.FieldValue.delete(),
      
      // Also update in profile if it exists
      "profile.subscription.plan": "starter",
      "profile.subscription.status": "active",
      "profile.subscription.asaasCustomerId": admin.firestore.FieldValue.delete(),
      "profile.subscription.asaasSubscriptionId": admin.firestore.FieldValue.delete(),
      "profile.subscription.asaasPaymentId": admin.firestore.FieldValue.delete(),
      "profile.subscription.canceledAt": admin.firestore.FieldValue.delete(),
      "profile.subscription.accessUntil": admin.firestore.FieldValue.delete(),
      "profile.subscription.paymentFailedAt": admin.firestore.FieldValue.delete(),
      "profile.subscription.graceUntil": admin.firestore.FieldValue.delete(),
    });
    
    console.log("✅ Subscription cleaned up successfully!");
    
    console.log("\n📋 Verifying changes...\n");
    const updatedSnap = await userRef.get();
    const updatedData = updatedSnap.data();
    console.log("Updated subscription data:");
    console.log(JSON.stringify(updatedData.subscription, null, 2));
    
    console.log("\n✨ All done! User can now sign up for Pro again.");
    console.log(`✔️  User ID: ${userId}`);
    console.log(`✔️  Plan: starter`);
    console.log(`✔️  Status: active`);
    console.log(`✔️  Asaas IDs: removed`);
    console.log(`✔️  Canceled status: removed\n`);
    
    return true;
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    return false;
  }
}

async function main() {
  console.log("\n============================================");
  console.log("🔥 Controlar+ Admin Tool: Clean User Subscription");
  console.log("============================================\n");
  
  const initialized = await initFirebaseAdmin();
  
  if (!initialized) {
    process.exit(1);
  }
  
  const TARGET_USER_ID = "nnCWcZn34BSaqeGoEtCfpkV8Bot2";
  console.log(`Target User ID: ${TARGET_USER_ID}\n`);
  
  try {
    await cleanupUserSubscription(TARGET_USER_ID);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main();
