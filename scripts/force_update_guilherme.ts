
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

const TARGET_ID = "nnCWcZn34BSaqeGoEtCfpkV8Bot2";

async function main() {
    console.log(`Updating user ${TARGET_ID}...`);

    await db.collection('users').doc(TARGET_ID).update({
        'subscription.plan': 'pro',
        'subscription.billingCycle': 'monthly',
        'subscription.status': 'canceled',
        'profile.subscription.plan': 'pro',
        'profile.subscription.billingCycle': 'monthly',
        'profile.subscription.status': 'canceled',
        // Set canceledAt if missing to ensure logic works (assuming Jan 14th as seen in logs)
        'subscription.canceledAt': '2026-01-14T22:17:06.864Z'
    });

    console.log("✅ User updated.");
}

main();
