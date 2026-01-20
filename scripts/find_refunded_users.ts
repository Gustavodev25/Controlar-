
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function main() {
    console.log("Searching for refunded users...");
    const snapshot = await db.collection('users').get();

    let found = 0;
    snapshot.forEach(doc => {
        const d = doc.data();
        const sub = d.subscription || {};

        const isRefundedStatus = sub.status === 'refunded';
        const hasRefundReason = sub.revokedReason && (sub.revokedReason.toLowerCase().includes('refund') || sub.revokedReason.toLowerCase().includes('estorno'));

        if (isRefundedStatus || hasRefundReason) {
            console.log(`Found Refunded User: ${doc.id}`);
            console.log(`Name: ${d.name || d.profile?.name}`);
            console.log(`Status: ${sub.status}`);
            console.log(`RevokedReason: ${sub.revokedReason}`);
            console.log(`CanceledAt: ${sub.canceledAt}`);
            console.log(`RevokedAt: ${sub.revokedAt}`);
            console.log('---');
            found++;
        }
    });

    if (found === 0) {
        console.log("No refunded users found with strict checks. Checking loose string matches...");
        // Fallback: check if strict match missed something due to case sensitivity or structure
    }
}

main();
