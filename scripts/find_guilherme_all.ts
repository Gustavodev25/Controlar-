
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function main() {
    console.log("Searching for any 'Guilherme'...");
    const snapshot = await db.collection('users').get();

    snapshot.forEach(doc => {
        const d = doc.data();
        const name = d.name || d.profile?.name || '';
        if (name.toLowerCase().includes('guilherme')) {
            console.log(`FOUND User: ${name} (ID: ${doc.id})`);
            console.log(`Email: ${d.email}`);
            console.log("Subscription:", JSON.stringify(d.subscription, null, 2));
            console.log('---');
        }
    });
}

main();
