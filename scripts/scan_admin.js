import { firebaseAdmin } from '../api/firebaseAdmin.js';

const scanAdmin = async () => {
    if (!firebaseAdmin) {
        console.error('Firebase Admin not initialized.');
        process.exit(1);
    }

    const db = firebaseAdmin.firestore();
    // Using numeric part to be safe
    const searchString = '156329151';

    console.log(`Scanning 'admin' collection for string part: ${searchString}...`);

    try {
        const colRef = db.collection('admin');
        const snapshot = await colRef.get();

        let found = false;
        snapshot.forEach(doc => {
            const data = doc.data();
            const json = JSON.stringify(data);
            if (json.includes(searchString)) {
                found = true;
                console.log(`FOUND in admin:`);
                console.log(`ID: ${doc.id}`);
                console.log('Data:', JSON.stringify(data, null, 2));
            }
        });

        if (!found) {
            console.log(`No match found in admin collection.`);
        }

    } catch (error) {
        console.error('Error scanning admin:', error);
    }
    process.exit(0);
};

scanAdmin();
