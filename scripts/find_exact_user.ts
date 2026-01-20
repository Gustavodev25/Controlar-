
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

const EMAIL_PART = "gui.costa200897";

async function main() {
    console.log(`Searching for email containing '${EMAIL_PART}'...`);
    const snapshot = await db.collection('users').get();

    snapshot.forEach(doc => {
        const d = doc.data();
        const email = (d.email || d.profile?.email || '').toLowerCase();

        if (email.includes(EMAIL_PART)) {
            console.log(`FOUND MATCH!`);
            console.log(`ID: ${doc.id}`);
            console.log(`Name: ${d.name} / ${d.profile?.name}`);
            console.log(`Email: ${d.email}`);
            console.log(`Plan: ${d.subscription?.plan}`);
            console.log(`Status: ${d.subscription?.status}`);
            console.log(`Coupon: ${d.subscription?.couponUsed}`);
        }
    });
}

main();
