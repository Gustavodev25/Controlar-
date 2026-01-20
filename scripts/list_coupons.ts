
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function main() {
    const couponsSnap = await db.collection('coupons').get();
    couponsSnap.forEach(doc => {
        const d = doc.data();
        console.log(`Code: ${d.code} | ID: ${doc.id} | Discount: ${d.value} / ${JSON.stringify(d.progressiveDiscounts)}`);
    });
}

main();
