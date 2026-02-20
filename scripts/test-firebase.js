import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function check() {
    const q = await db.collection('users').where('subscription.status', '==', 'past_due').limit(1).get();
    q.docs.forEach(d => {
        const data = d.data();
        console.log("Root Subscription:", data.subscription);
        console.log("Profile Subscription:", data.profile?.subscription);
    });
}
check().then(() => process.exit(0)).catch(e => console.error(e));
