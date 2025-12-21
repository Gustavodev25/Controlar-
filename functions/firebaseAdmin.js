import { loadEnv } from './env.js';

loadEnv();

let firebaseAdmin = null;
let firebaseAuth = null;
let initPromise = null;

const initFirebaseAdmin = async () => {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const admin = await import('firebase-admin');
      const { getAuth } = await import('firebase-admin/auth');

      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
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
      } else if (process.env.FIREBASE_CONFIG || process.env.GCLOUD_PROJECT || process.env.FUNCTION_TARGET) {
        if (!admin.default.apps.length) {
          admin.default.initializeApp({
            credential: admin.default.credential.applicationDefault(),
            projectId: process.env.GCLOUD_PROJECT || process.env.VITE_FIREBASE_PROJECT_ID || "financeiro-609e1"
          });
        }
        firebaseAdmin = admin.default;
        firebaseAuth = getAuth();
        console.log('>>> Firebase Admin Initialized with Application Default Credentials');
      } else {
        console.log('>>> Firebase Admin: No service account provided');
      }
    } catch (error) {
      console.error('>>> Firebase Admin Init Error:', error.message);
    }

    return { firebaseAdmin, firebaseAuth };
  })();

  return initPromise;
};

const getFirebaseAdmin = async () => {
  await initFirebaseAdmin();
  return { firebaseAdmin, firebaseAuth };
};

export { firebaseAdmin, firebaseAuth, initFirebaseAdmin, getFirebaseAdmin };
