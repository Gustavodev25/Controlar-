
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function main() {
    console.log("Dumping users...");
    const snapshot = await db.collection('users').get();

    snapshot.forEach(doc => {
        const d = doc.data();
        const json = JSON.stringify(d).toLowerCase();

        if (json.includes('guilherme') || json.includes('gui.costa')) {
            console.log(`ID: ${doc.id}`);
            console.log('Data:', JSON.stringify(d, null, 2));
            console.log('---');
        }
    });
}

main();
