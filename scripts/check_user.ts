
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';

// Load env from parent directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

if (!serviceAccount.project_id) {
    console.error("❌ FIREBASE_SERVICE_ACCOUNT missing or invalid in .env");
    process.exit(1);
}

const app = initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore(app);

const TARGET_USER_ID = "zvtUEYhn61WlDvUtHpThnlq1f603";

async function main() {
    console.log(`Checking user: ${TARGET_USER_ID}`);
    const userRef = db.collection('users').doc(TARGET_USER_ID);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
        console.log("User not found");
        return;
    }

    const data = userSnap.data();
    console.log("Subscription:", JSON.stringify(data.subscription, null, 2));
    console.log("Profile Subscription:", JSON.stringify(data.profile?.subscription, null, 2));
}

main();
