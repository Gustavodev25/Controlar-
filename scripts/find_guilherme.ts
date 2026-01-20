
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

const EMAIL = "gui.costa200897@gmail.com"; // Inferred from screenshot (partial)

async function main() {
    console.log(`Searching for user email: ${EMAIL}...`);
    // Try exact match first
    let snapshot = await db.collection('users').where('email', '==', EMAIL).get();

    if (snapshot.empty) {
        console.log("Not found by exact email. Scanning all...");
        // Fallback scan
        snapshot = await db.collection('users').get();
        let found = false;
        snapshot.forEach(doc => {
            const d = doc.data();
            if (d.email && d.email.includes("gui.costa200897")) {
                console.log(`FOUND User: ${d.name} (ID: ${doc.id})`);
                console.log("Subscription:", JSON.stringify(d.subscription, null, 2));
                found = true;
            }
        });
        if (!found) console.log("User not found.");
    } else {
        snapshot.forEach(doc => {
            console.log(`FOUND User: ${doc.data().name} (ID: ${doc.id})`);
            console.log("Subscription:", JSON.stringify(doc.data().subscription, null, 2));
        });
    }
}

main();
