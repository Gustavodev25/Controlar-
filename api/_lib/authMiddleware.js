import { firebaseAdmin, firebaseAuth } from './firebaseAdmin.js';

const getBearerToken = (req) => {
  const raw = req.headers?.authorization || req.headers?.Authorization;
  if (!raw || typeof raw !== 'string') return null;
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
};

export const requireFirebaseAuth = async (req, res, next) => {
  if (!firebaseAuth) {
    return res.status(500).json({ error: 'Firebase Auth não configurado no servidor.' });
  }

  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authorization Bearer token é obrigatório.' });
  }

  try {
    const decoded = await firebaseAuth.verifyIdToken(token);
    req.auth = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
};

export const getRequesterIsAdmin = async (req) => {
  const fromClaims = !!(req.auth?.admin || req.auth?.isAdmin);
  if (fromClaims) return true;
  if (!firebaseAdmin || !req.auth?.uid) return false;
  const snap = await firebaseAdmin.firestore().collection('users').doc(req.auth.uid).get();
  const data = snap.exists ? snap.data() : null;
  return !!(data?.isAdmin || data?.profile?.isAdmin);
};

export const requireAdminOrSelf = async (req, res, next) => {
  const targetUserId = req.body?.userId || req.params?.userId;
  if (!targetUserId) return res.status(400).json({ error: 'userId é obrigatório.' });

  if (req.auth?.uid === targetUserId) return next();

  try {
    const isAdmin = await getRequesterIsAdmin(req);
    if (!isAdmin) return res.status(403).json({ error: 'Acesso negado.' });
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Falha ao validar permissões.' });
  }
};
