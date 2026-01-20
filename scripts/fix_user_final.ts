
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

const TARGET_USER_ID = "zvtUEYhn61WlDvUtHpThnlq1f603";

async function main() {
    console.log(`Updating user ${TARGET_USER_ID} to MONTHLY...`);

    const userRef = db.collection('users').doc(TARGET_USER_ID);

    await userRef.update({
        'subscription.billingCycle': 'monthly',
        'profile.subscription.billingCycle': 'monthly',
        'subscription.plan': 'pro',
        'profile.subscription.plan': 'pro',
        'subscription.updatedAt': new Date().toISOString()
    });

    console.log("✅ User updated to Monthly Pro.");
}

main();
