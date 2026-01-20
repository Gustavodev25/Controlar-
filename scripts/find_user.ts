
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function main() {
    console.log("Searching for user 'Guilherme Matheus'...");
    const snapshot = await db.collection('users').get(); // Getting all users and filtering locally to be safe with casing/partial matches

    let found = false;
    snapshot.forEach(doc => {
        const data = doc.data();
        const name = data.name || data.profile?.name || '';
        if (name.toLowerCase().includes('guilherme matheus')) {
            console.log(`FOUND User: ${name} (ID: ${doc.id})`);
            console.log("Subscription:", JSON.stringify(data.subscription, null, 2));
            found = true;
        }
    });

    if (!found) {
        console.log("User not found.");
    }
}

main();
