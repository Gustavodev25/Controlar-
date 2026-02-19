import { loadEnv } from './env.js';

loadEnv();

let firebaseAdmin = null;
let firebaseAuth = null;

const initFirebaseAdmin = async () => {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const admin = await import('firebase-admin');
      const { getAuth } = await import('firebase-admin/auth');

      if (!admin.default.apps.length) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.default.initializeApp({
          credential: admin.default.credential.cert(serviceAccount),
          projectId: process.env.VITE_FIREBASE_PROJECT_ID || "financeiro-609e1"
        });
        firebaseAdmin = admin.default;
        firebaseAuth = getAuth();
        console.log('>>> Firebase Admin Initialized with Service Account (Module)');
      } else {
        // Already initialized elsewhere or previously
        firebaseAdmin = admin.default;
        firebaseAuth = getAuth();
      }
    } else {
      console.log('>>> Firebase Admin: No service account provided');
    }
  } catch (error) {
    console.error('>>> Firebase Admin Init Error:', error.message);
  }
};

// Initialize immediately
await initFirebaseAdmin();

export { firebaseAdmin, firebaseAuth };
