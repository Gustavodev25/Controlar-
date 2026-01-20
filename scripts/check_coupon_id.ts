
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

const COUPON_ID = "xty7cHmaEe89PqVxH8pZ";

async function main() {
    const doc = await db.collection('coupons').doc(COUPON_ID).get();
    if (!doc.exists) {
        console.log("Coupon ID not found!");
    } else {
        console.log("Coupon Data:", JSON.stringify(doc.data(), null, 2));
    }
}

main();
