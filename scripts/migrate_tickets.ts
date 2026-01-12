
// Mock import.meta.env for Node environment
(global as any).import = { meta: { env: {} } };

import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, writeBatch } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBGhm5J90b4fVlhmyP7bhVPliQZmQUSmmo",
    authDomain: "financeiro-609e1.firebaseapp.com",
    databaseURL: "https://financeiro-609e1-default-rtdb.firebaseio.com",
    projectId: "financeiro-609e1",
    storageBucket: "financeiro-609e1.firebasestorage.app",
    messagingSenderId: "412536649666",
    appId: "1:412536649666:web:f630c5be490c5539f1485b",
    measurementId: "G-QSH7W2GYXD"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const migrateAwaitingRatingToClosed = async () => {
    if (!db) {
        console.error("Database not initialized");
        return;
    }

    try {
        const ticketsRef = collection(db, "support_tickets");
        console.log("Searching for tickets awaiting rating...");
        // Find tickets that are awaiting rating
        const q = query(ticketsRef, where("awaitingRating", "==", true));
        const snap = await getDocs(q);

        console.log(`Found ${snap.size} tickets awaiting rating.`);

        if (snap.empty) {
            console.log("No tickets awaiting rating found.");
            return;
        }

        const batch = writeBatch(db);
        let count = 0;

        snap.docs.forEach(doc => {
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
