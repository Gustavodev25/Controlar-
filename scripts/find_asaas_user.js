import { firebaseAdmin } from '../api/firebaseAdmin.js';

const scanUsers = async () => {
    if (!firebaseAdmin) {
        console.error('Firebase Admin not initialized.');
        process.exit(1);
    }

    const db = firebaseAdmin.firestore();
    // Search for the numeric part in case prefix is missing or different
    const searchString = '000156329151';

    console.log(`Scanning ALL users for string: ${searchString}...`);

    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.get(); // Get ALL users

        let found = false;
        let count = 0;
        snapshot.forEach(doc => {
            count++;
            const data = doc.data();
            const json = JSON.stringify(data);
            if (json.includes(searchString)) {
                found = true;
                console.log(`FOUND USER (Match in JSON):`);
                console.log(`ID: ${doc.id}`);
                console.log(`Name: ${data.name || data?.profile?.name}`);
                console.log(`Email: ${data.email || data?.profile?.email}`);

                // Show subscription details if available
                const sub = data.subscription || data?.profile?.subscription;
                if (sub) {
                    console.log('Subscription:', JSON.stringify(sub, null, 2));
                }
            }
        });

        if (!found) {
            console.log(`Scanned ${count} users. No match found.`);
        }

    } catch (error) {
        console.error('Error scanning users:', error);
    }
    process.exit(0);
};

scanUsers();
