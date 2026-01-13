import { firebaseAdmin } from '../api/firebaseAdmin.js';

const listCollections = async () => {
    if (!firebaseAdmin) {
        console.error('Firebase Admin not initialized.');
        process.exit(1);
    }

    const db = firebaseAdmin.firestore();
    try {
        const collections = await db.listCollections();
        console.log('Root Collections:', collections.map(c => c.id));
    } catch (error) {
        console.error('Error listing collections:', error);
    }
    process.exit(0);
};

listCollections();
