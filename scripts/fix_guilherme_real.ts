
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

const TARGET_EMAIL = "gui.costa200897@gmail.com";

async function main() {
    console.log(`Fixing user with email ${TARGET_EMAIL}...`);

    const snapshot = await db.collection('users').get();
    let found = false;

    for (const doc of snapshot.docs) {
        const d = doc.data();
        if (d.email === TARGET_EMAIL) {
            console.log(`FOUND User: ${d.name} (ID: ${doc.id})`);
            found = true;

            await db.collection('users').doc(doc.id).update({
                'subscription.plan': 'pro',
                'subscription.billingCycle': 'monthly',
                'subscription.status': 'canceled', // Ensure it stays canceled
                'profile.subscription.plan': 'pro',
                'profile.subscription.billingCycle': 'monthly'
            });
            console.log("✅ Updated to PRO / MONTHLY / CANCELED");
            break;
        }
    }

    if (!found) {
        console.log("❌ User not found by email scan.");
    }
}

main();
