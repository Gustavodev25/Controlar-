
const admin = require('firebase-admin');
const serviceAccount = require('./functions/serviceAccountKey.json'); // Adjust path if needed

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function inspectTransactions() {
  console.log('Searching for "TOP SP TARFA TRANSPORT"...');
  
  // Search in creditCardTransactions (most likely place)
  const usersSnap = await db.collection('users').get();
  
  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const ccTxRef = db.collection('users').doc(userId).collection('creditCardTransactions');
    
    const snapshot = await ccTxRef.get();
    let found = false;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if ((data.description || '').toUpperCase().includes('TOP SP TARFA TRANSPORT')) {
        console.log(`\nUser: ${userId}`);
        console.log(`ID: ${doc.id}`);
        console.log(`Description: ${data.description}`);
        console.log(`Amount: ${data.amount}`);
        console.log(`Type: ${data.type}`);
        console.log(`Category: ${data.category}`);
        console.log(`Date: ${data.date}`);
        console.log(`IsRefund: ${data.isRefund}`);
        console.log(`PluggyRaw Amount: ${data.pluggyRaw?.amount}`);
        found = true;
      }
    });
    
    if (found) break; // Stop after finding the user (assuming single user context)
  }
}

inspectTransactions().catch(console.error);
