import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import { firebaseAdmin, initFirebaseAdmin } from './firebaseAdmin.js';
import {
  processSyncWithRefund,
  pollAndSyncWithRefund,
  getPluggyApiKey,
  pluggyRequest
} from './pluggy.js';

const SYNC_QUEUE_COLLECTION = 'pluggy_sync_queue';
const SYNC_QUEUE_TTL_MS = 24 * 60 * 60 * 1000;

const updateQueueJob = async (jobRef, updates) => {
  const now = Date.now();
  await jobRef.set({
    ...updates,
    updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
    expiresAt: firebaseAdmin.firestore.Timestamp.fromMillis(now + SYNC_QUEUE_TTL_MS)
  }, { merge: true });
};

const claimQueueJob = async (jobRef) => {
  const db = firebaseAdmin.firestore();
  const nowMs = Date.now();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef);
    if (!snap.exists) return null;

    const job = snap.data() || {};
    const status = job.status || 'queued';
    const availableAtMs = job.availableAt?.toMillis?.();

    if (status !== 'queued') return null;
    if (availableAtMs && availableAtMs > nowMs) return null;

    const attempts = Number(job.attempts || 0) + 1;
    tx.update(jobRef, {
      status: 'processing',
      attempts,
      startedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
    });

    return { ...job, attempts };
  });
};

export const pluggySyncQueueWorker = onDocumentCreated(
  {
    document: `${SYNC_QUEUE_COLLECTION}/{jobId}`,
    timeoutSeconds: 540
  },
  async (event) => {
    await initFirebaseAdmin();
    if (!firebaseAdmin) {
      logger.error('Firebase Admin not initialized.');
      return;
    }

    if (!event.data) {
      logger.warn('Missing queue job data.');
      return;
    }

    const jobRef = event.data.ref;
    const jobId = jobRef.id;

    const job = await claimQueueJob(jobRef);
    if (!job) {
      logger.info(`Queue job skipped (already claimed or not ready): ${jobId}`);
      return;
    }

    const {
      type = 'sync',
      userId,
      itemId,
      syncJobId,
      creditTransactionId
    } = job;

    if (!userId || !itemId || !syncJobId) {
      await updateQueueJob(jobRef, {
        status: 'failed',
        lastError: 'Missing required fields',
        failedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
      });
      logger.error('Queue job missing required fields.', { jobId, type, userId, itemId, syncJobId });
      return;
    }

    try {
      logger.info(`Processing queue job ${jobId}`, { type, userId, itemId, syncJobId });

      if (type === 'trigger') {
        const apiKey = await getPluggyApiKey();
        await pluggyRequest('PATCH', `/items/${itemId}`, apiKey, {});
        await pollAndSyncWithRefund(apiKey, itemId, userId, syncJobId, creditTransactionId);
      } else {
        await processSyncWithRefund(userId, itemId, syncJobId, creditTransactionId, { fullSync: true });
      }

      await updateQueueJob(jobRef, {
        status: 'done',
        completedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      const message = error?.message || String(error);
      logger.error(`Queue job failed: ${jobId}`, { message, type, userId, itemId, syncJobId });
      await updateQueueJob(jobRef, {
        status: 'failed',
        lastError: message,
        failedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
      });
    }
  }
);
