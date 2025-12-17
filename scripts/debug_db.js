// Script to debug Firestore data for connected accounts
import { firebaseAdmin } from '../api/firebaseAdmin.js';

const USER_ID = 'QhSwFzrJ9kSiR2h2GYeLm8xeCky1';

async function debugDB() {
  try {
    if (!firebaseAdmin) {
      console.error('Firebase Admin not initialized. Check .env');
      return;
    }

    const db = firebaseAdmin.firestore();
    const accountsRef = db.collection('users').doc(USER_ID).collection('accounts');
    const snapshot = await accountsRef.get();

    if (snapshot.empty) {
      console.log('No documents found in accounts.');
      return;
    }

    console.log(`Found ${snapshot.size} documents in accounts:`);
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`- Doc ID: ${doc.id}`);
      console.log(`  itemId: ${data.itemId} (${typeof data.itemId})`);
      console.log(`  name: ${data.name}`);
    });

  } catch (error) {
    console.error('Error querying DB:', error);
  }
}

debugDB();