import { loadEnv } from './env.js';

loadEnv();

let firebaseAdmin = null;
let firebaseAuth = null;
let initPromise = null;

const getProjectId = () => (
  process.env.GCLOUD_PROJECT || process.env.VITE_FIREBASE_PROJECT_ID || "financeiro-609e1"
);

const hasDefaultApp = (admin) => admin.default.apps.some((app) => app?.name === '[DEFAULT]');

const ensureDefaultApp = (admin, options) => {
  if (!hasDefaultApp(admin)) {
    admin.default.initializeApp(options);
  }
};

const initFirebaseAdmin = async () => {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const admin = await import('firebase-admin');
      const { getAuth } = await import('firebase-admin/auth');
      const projectId = getProjectId();
      const canUseDefaultCreds = Boolean(
        process.env.FIREBASE_CONFIG ||
        process.env.GCLOUD_PROJECT ||
        process.env.FUNCTION_TARGET ||
        process.env.K_SERVICE
      );

      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        ensureDefaultApp(admin, {
          credential: admin.default.credential.cert(serviceAccount),
          projectId
        });
        if (!hasDefaultApp(admin)) {
          throw new Error('Firebase Admin default app not initialized');
        }
        const adminApp = admin.default.app();
        firebaseAuth = getAuth(adminApp);
        firebaseAdmin = admin.default;
        console.log('>>> Firebase Admin Initialized with Service Account (Module)');
      } else if (canUseDefaultCreds) {
        ensureDefaultApp(admin, {
          credential: admin.default.credential.applicationDefault(),
          projectId
        });
        if (!hasDefaultApp(admin)) {
          throw new Error('Firebase Admin default app not initialized');
        }
        const adminApp = admin.default.app();
        firebaseAuth = getAuth(adminApp);
        firebaseAdmin = admin.default;
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
