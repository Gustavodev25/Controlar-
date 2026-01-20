
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function main() {
    console.log("Searching users...");
    const snapshot = await db.collection('users').get();

    snapshot.forEach(doc => {
        const d = doc.data();
        const name = (d.name || d.profile?.name || '').toLowerCase();
        const email = (d.email || '').toLowerCase();

        if (name.includes('guilherme') || email.includes('gui.costa')) {
            console.log(`FOUND: ${d.name} (${d.email}) | ID: ${doc.id}`);
            console.log(`Plan: ${d.subscription?.plan} | Status: ${d.subscription?.status}`);
        }
    });
}

main();
