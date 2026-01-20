
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function main() {
    const couponsSnap = await db.collection('coupons').where('code', '==', 'feli2026').get();
    if (couponsSnap.empty) {
        console.log("Coupon 'feli2026' not found!");
    } else {
        couponsSnap.forEach(doc => {
            console.log("Coupon Data:", JSON.stringify(doc.data(), null, 2));
        });
    }
}

main();
