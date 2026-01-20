
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
    console.log(`Updating user ${TARGET_ID} to Refunded state...`);

    await db.collection('users').doc(TARGET_ID).update({
        'subscription.status': 'canceled',
        'subscription.revokedReason': 'Solicitado estorno pelo cliente',
        'subscription.revokedAt': '2026-01-15T12:00:00.000Z',
        'subscription.canceledAt': '2026-01-15T12:00:00.000Z',

        // Update profile copy as well for consistency
        'profile.subscription.status': 'canceled',
        'profile.subscription.revokedReason': 'Solicitado estorno pelo cliente',
    });

    console.log("✅ User updated to Refunded state.");
}

main();
