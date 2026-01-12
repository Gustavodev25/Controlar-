
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Service Account
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : (process.env.GOOGLE_APPLICATION_CREDENTIALS ? require(process.env.GOOGLE_APPLICATION_CREDENTIALS) : null);

if (!serviceAccount) {
    console.error("FIREBASE_SERVICE_ACCOUNT_KEY not found in env.");
    process.exit(1);
}

if (getApps().length === 0) {
    initializeApp({
        credential: cert(serviceAccount)
    });
}

const db = getFirestore();

const migrateAwaitingRatingToClosed = async () => {
    try {
        const ticketsRef = db.collection("support_tickets");
        console.log("Searching for tickets awaiting rating...");

        const snapshot = await ticketsRef.where("awaitingRating", "==", true).get();

        console.log(`Found ${snapshot.size} tickets awaiting rating.`);

        if (snapshot.empty) {
            console.log("No tickets awaiting rating found.");
            return;
        }

        const batch = db.batch();
        let count = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.status !== 'closed') {
                batch.update(doc.ref, { status: 'closed' });
                count++;
            }
        });

        if (count > 0) {
            await batch.commit();
            console.log(`Migrated ${count} tickets to 'closed' status.`);
        } else {
            console.log("All awaiting rating tickets are already closed.");
        }

    } catch (error) {
        console.error("Migration failed:", error);
    }
};

migrateAwaitingRatingToClosed();
