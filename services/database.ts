
import {
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  getDocs,
  limit,
  writeBatch,
  runTransaction,
  collectionGroup
} from "firebase/firestore";
import { database as db } from "./firebase";
import { Transaction, Reminder, User, Member, FamilyGoal, Investment, Budget, WaitlistEntry, ConnectedAccount, Coupon, PromoPopup } from "../types";
import { AppNotification } from "../types";


// --- User Services ---
export const logConnection = async (userId: string, log: any) => {
  if (!db) return [];
  const userRef = doc(db, "users", userId);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    const data = snap.data();
    let existingLogs = data.connectionLogs || [];

    // Ensure we are working with an array
    if (!Array.isArray(existingLogs)) existingLogs = [];

    // Check if the latest log is from the same device/session (prevent spam on refresh)
    const latestLog = existingLogs[0];
    const isSameSession = latestLog &&
      latestLog.device === log.device &&
      latestLog.os === log.os &&
      latestLog.browser === log.browser &&
      latestLog.ip === log.ip;

    let newLogs;
    if (isSameSession) {
      // Update the timestamp of the existing log and mark as current
      const updatedLatest = { ...latestLog, timestamp: log.timestamp, isCurrent: true };
      // Mark others as not current just in case
      const others = existingLogs.slice(1).map((l: any) => ({ ...l, isCurrent: false }));
      newLogs = [updatedLatest, ...others];
    } else {
      // Mark all previous logs as not current
      const previousLogs = existingLogs.map((l: any) => ({ ...l, isCurrent: false }));
      // Prepend new log
      newLogs = [log, ...previousLogs].slice(0, 10);
    }

    await updateDoc(userRef, { connectionLogs: newLogs });
    return newLogs;
  }
  return [log]; // Fallback for first time or errors
};

export const updateUserProfile = async (userId: string, data: Partial<User>) => {
  if (!db) return;
  const userRef = doc(db, "users", userId);

  // Sanitize data: remove keys with undefined values
  const cleanData = Object.entries(data).reduce((acc: any, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {});

  // Merge true para não sobrescrever outros campos
  await setDoc(userRef, { profile: cleanData }, { merge: true });
};

export const setAdminStatus = async (userId: string, isAdmin: boolean) => {
  if (!db) return;
  const userRef = doc(db, "users", userId);
  // Update both root and profile to be sure, but root is priority
  await updateDoc(userRef, {
    isAdmin: isAdmin,
    "profile.isAdmin": isAdmin
  });
};

// Set first month override price for a user (for coupon correction)
export const setFirstMonthOverridePrice = async (userId: string, price: number) => {
  if (!db) return;
  const userRef = doc(db, "users", userId);
  // Try to update in profile.subscription first (where most subscriptions are stored)
  // Also update at root level subscription for family members
  await updateDoc(userRef, {
    "profile.subscription.firstMonthOverridePrice": price,
    "subscription.firstMonthOverridePrice": price
  });
};

export const getUserProfile = async (userId: string): Promise<Partial<User> | null> => {
  if (!db) return null;
  try {
    const userRef = doc(db, "users", userId);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data = snap.data();
      const profile = { ...(data.profile as Partial<User> || {}) };



      // ALWAYS check both profile.isAdmin AND root isAdmin
      // Priority: root isAdmin (most reliable) > profile.isAdmin
      // This is because isAdmin is often stored at root level, not inside profile
      const rootIsAdmin = data.isAdmin === true;
      const profileIsAdmin = data.profile?.isAdmin === true;

      // Use root isAdmin if it's true, otherwise use profile isAdmin
      profile.isAdmin = rootIsAdmin || profileIsAdmin;

      // Include createdAt from root if available
      if (data.createdAt && !profile.createdAt) {
        profile.createdAt = data.createdAt;
      }

      // IMPORTANT: subscription can be stored at root level (for family members)
      // or inside profile (for regular users). Check both locations.
      // Priority: root subscription (for family members via joinFamily) > profile subscription
      if (data.subscription && !profile.subscription) {
        profile.subscription = data.subscription;
      }



      if (data.connectionLogs && Array.isArray(data.connectionLogs)) {
        profile.connectionLogs = data.connectionLogs;
      }

      // Load dailyConnectionCredits from root if available
      if (data.dailyConnectionCredits) {
        profile.dailyConnectionCredits = data.dailyConnectionCredits;
      } else {
        profile.dailyConnectionCredits = { date: '', count: 0 };
      }

      // If there was no profile at all but we have root isAdmin, still return it
      if (Object.keys(profile).length === 1 && profile.isAdmin !== undefined) {
        return { isAdmin: profile.isAdmin };
      }

      return profile;
    }
    return null;
  } catch (error) {
    console.error("Erro ao buscar perfil:", error);
    throw error;
  }
};

export const getAllUsers = async (): Promise<(User & { id: string })[]> => {
  if (!db) return [];
  try {
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);

    const users = snapshot.docs.map(doc => {
      const data = doc.data();
      // Merge root data with profile data, prioritizing profile if structure varies
      const profile = data.profile || {};

      // IMPORTANT: subscription can be at root level (for family members) or inside profile
      const subscription = profile.subscription || data.subscription;

      const connectionLogs = data.connectionLogs || profile.connectionLogs || [];
      let createdAt = data.createdAt || profile.createdAt;

      // Fallback: Use oldest connection log if createdAt is missing
      if (!createdAt && connectionLogs.length > 0) {
        // logs are typically Newest -> Oldest (prepended)
        // So the last element is the oldest known access
        createdAt = connectionLogs[connectionLogs.length - 1].timestamp;
      }

      // Construct a user object
      return {
        id: doc.id,
        name: profile.name || data.name || 'Usuário',
        email: profile.email || data.email || '',
        // Include other necessary fields - use merged subscription
        subscription: subscription,
        isAdmin: data.isAdmin === true || profile.isAdmin === true,
        connectionLogs: connectionLogs,
        birthDate: profile.birthDate || data.birthDate,
        createdAt: createdAt, // Include creation date (or fallback)
        ...profile
      } as User & { id: string };
    });

    return users;
  } catch (error) {
    console.error("Error fetching all users:", error);
    return [];
  }
};

export const listenToUserProfile = (userId: string, callback: (data: Partial<User>) => void) => {
  if (!db) return () => { };
  const userRef = doc(db, "users", userId);

  return onSnapshot(userRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      const profile = { ...(data.profile as Partial<User> || {}) };



      // ALWAYS check both profile.isAdmin AND root isAdmin
      // Priority: root isAdmin (most reliable) > profile.isAdmin
      // This is because isAdmin is often stored at root level, not inside profile
      const rootIsAdmin = data.isAdmin === true;
      const profileIsAdmin = data.profile?.isAdmin === true;

      // Use root isAdmin if it's true, otherwise use profile isAdmin
      profile.isAdmin = rootIsAdmin || profileIsAdmin;

      // IMPORTANT: subscription can be stored at root level (for family members)
      // or inside profile (for regular users). Check both locations.
      // Priority: root subscription (for family members via joinFamily) > profile subscription
      if (data.subscription && !profile.subscription) {
        profile.subscription = data.subscription;
      }

      // Map dailyConnectionCredits from root if present
      // IMPORTANT: This field is stored at root level, not inside profile
      if (data.dailyConnectionCredits) {
        profile.dailyConnectionCredits = data.dailyConnectionCredits;
      } else {
        profile.dailyConnectionCredits = { date: '', count: 0 };
      }

      // Include createdAt from root if available (Consistency with getUserProfile)
      if (data.createdAt && !profile.createdAt) {
        profile.createdAt = data.createdAt;
      }



      callback(profile);
    } else {

      callback({});
    }
  });
};

export const migrateUsersAddAdminField = async () => {
  if (!db) return 0;
  try {
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);

    let batch = writeBatch(db);
    let operationCount = 0;
    let updatedCount = 0;

    for (const d of snapshot.docs) {
      const data = d.data();
      if (data.profile && data.profile.isAdmin === undefined) {
        batch.update(d.ref, { "profile.isAdmin": false });
        operationCount++;
        updatedCount++;

        if (operationCount >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          operationCount = 0;
        }
      }
    }

    if (operationCount > 0) {
      await batch.commit();
    }
    return updatedCount;
  } catch (e) {
    console.error("Migration failed:", e);
    throw e;
  }
};

// --- Waitlist Services ---
export const addWaitlistEntry = async (entry: Omit<WaitlistEntry, 'id'>) => {
  if (!db) {
    console.warn("Firestore nao configurado; ignorando cadastro na lista de espera");
    return { id: null as string | null };
  }

  const waitlistRef = collection(db, "waitlist");
  const payload = {
    ...entry,
    createdAt: entry.createdAt || new Date().toISOString()
  };

  const docRef = await addDoc(waitlistRef, payload);
  return { id: docRef.id };
};

export const getWaitlistEntries = async (): Promise<WaitlistEntry[]> => {
  if (!db) {
    console.warn("Database não inicializado");
    return [];
  }
  try {

    const waitlistRef = collection(db, "waitlist");

    // Primeiro tentamos sem ordenação para ver se o problema é o índice
    const snapshot = await getDocs(waitlistRef);



    const entries = snapshot.docs.map(doc => {
      const data = doc.data();

      return {
        id: doc.id,
        ...data
      } as WaitlistEntry;
    });

    // Ordenamos manualmente no lado do cliente
    entries.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });


    return entries;
  } catch (error) {
    console.error("Error fetching waitlist:", error);
    return [];
  }
};

export const deleteWaitlistEntry = async (id: string) => {
  if (!db) return;
  const entryRef = doc(db, "waitlist", id);
  await deleteDoc(entryRef);
};

// --- Members Services ---
export const addMember = async (userId: string, member: Omit<Member, 'id'>) => {
  if (!db) return "";
  const membersRef = collection(db, "users", userId, "members");
  const docRef = await addDoc(membersRef, member);

  // Opcional: Atualizar o documento com o próprio ID se necessário, 
  // mas o Firestore já dá o ID. O App assume que o objeto retornado tem ID.
  return docRef.id;
};

export const listenToMembers = (userId: string, callback: (members: Member[]) => void) => {
  if (!db) return () => { };
  const membersRef = collection(db, "users", userId, "members");

  return onSnapshot(membersRef, (snapshot) => {
    const members: Member[] = [];
    snapshot.forEach(doc => {
      members.push({ id: doc.id, ...doc.data() } as Member);
    });
    callback(members);
  });
};

export const updateMember = async (userId: string, member: Member) => {
  if (!db) return;
  const memberRef = doc(db, "users", userId, "members", member.id);
  const { id, ...data } = member;
  await updateDoc(memberRef, data);
};

export const deleteMember = async (userId: string, memberId: string) => {
  if (!db) return;
  const memberRef = doc(db, "users", userId, "members", memberId);
  await deleteDoc(memberRef);
};

export const restoreMember = async (userId: string, member: Member) => {
  if (!db) return;
  const memberRef = doc(db, "users", userId, "members", member.id);
  const { id, ...data } = member;
  await setDoc(memberRef, data);
};

// --- Family Goals Services ---
// NOTE: These functions now support both user-based storage (legacy) and family-based storage (new)

// Legacy: Store goals under user's subcollection (for users without family)
export const addFamilyGoal = async (userId: string, goal: Omit<FamilyGoal, 'id'>) => {
  if (!db) return;
  const goalsRef = collection(db, "users", userId, "goals");
  await addDoc(goalsRef, goal);
};

export const updateFamilyGoal = async (userId: string, goal: FamilyGoal) => {
  if (!db) return;
  const goalRef = doc(db, "users", userId, "goals", goal.id);
  const { id, ...data } = goal;
  await updateDoc(goalRef, data);
};

export const deleteFamilyGoal = async (userId: string, goalId: string) => {
  if (!db) return;
  const goalRef = doc(db, "users", userId, "goals", goalId);
  await deleteDoc(goalRef);
};

export const listenToGoals = (userId: string, callback: (goals: FamilyGoal[]) => void) => {
  if (!db) return () => { };
  const goalsRef = collection(db, "users", userId, "goals");

  return onSnapshot(goalsRef, (snapshot) => {
    const goals: FamilyGoal[] = [];
    snapshot.forEach(doc => {
      goals.push({ id: doc.id, ...doc.data() } as FamilyGoal);
    });
    callback(goals);
  });
}

// NEW: Store goals under family's subcollection (for family members)
export const addFamilyGoalByGroupId = async (familyGroupId: string, goal: Omit<FamilyGoal, 'id'>) => {
  if (!db) return;
  const goalsRef = collection(db, "families", familyGroupId, "goals");
  await addDoc(goalsRef, goal);
};

export const updateFamilyGoalByGroupId = async (familyGroupId: string, goal: FamilyGoal) => {
  if (!db) return;
  const goalRef = doc(db, "families", familyGroupId, "goals", goal.id);
  const { id, ...data } = goal;
  await updateDoc(goalRef, data);
};

export const deleteFamilyGoalByGroupId = async (familyGroupId: string, goalId: string) => {
  if (!db) return;
  const goalRef = doc(db, "families", familyGroupId, "goals", goalId);
  await deleteDoc(goalRef);
};

export const listenToGoalsByGroupId = (familyGroupId: string, callback: (goals: FamilyGoal[]) => void) => {
  if (!db) return () => { };
  const goalsRef = collection(db, "families", familyGroupId, "goals");

  return onSnapshot(goalsRef, (snapshot) => {
    const goals: FamilyGoal[] = [];
    snapshot.forEach(doc => {
      goals.push({ id: doc.id, ...doc.data() } as FamilyGoal);
    });
    callback(goals);
  }, (error) => {
    console.error("[Family Goals] Error listening to goals:", error);
    callback([]);
  });
}


// --- Transactions Services ---
export const addTransaction = async (userId: string, transaction: Omit<Transaction, 'id'>, customId?: string) => {
  if (!db) return "";
  const txRef = collection(db, "users", userId, "transactions");

  if (customId) {
    const docRef = doc(txRef, customId);
    // Check if it exists first to avoid overwriting (though transactionExists should have caught it)
    const snap = await getDoc(docRef);
    if (snap.exists()) return customId;

    await setDoc(docRef, transaction);
    return customId;
  } else {
    const docRef = await addDoc(txRef, transaction);
    return docRef.id;
  }
};

// Helper to remove undefined values for regular transactions (Firebase doesn't accept undefined)
const removeUndefinedTx = <T extends Record<string, any>>(obj: T): T => {
  const result = {} as T;
  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
};

// Upsert helper for imported transactions (uses providerId or customId)
export const upsertImportedTransaction = async (userId: string, transaction: Omit<Transaction, 'id'>, customId?: string) => {
  if (!db) return "";
  const txRef = collection(db, "users", userId, "transactions");
  const cleanTransaction = removeUndefinedTx(transaction);

  // Priority 1: customId (explicit doc id)
  if (customId) {
    const docRef = doc(txRef, customId);
    await setDoc(docRef, cleanTransaction, { merge: true });
    return docRef.id;
  }

  // Priority 2: providerId (stable id from provider)
  if (cleanTransaction.providerId) {
    const q = query(txRef, where("providerId", "==", cleanTransaction.providerId), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const existingRef = snap.docs[0].ref;
      await setDoc(existingRef, cleanTransaction, { merge: true });
      return existingRef.id;
    }
  }

  // Fallback: create new document
  const docRef = await addDoc(txRef, cleanTransaction);
  return docRef.id;
};

export const transactionExists = async (userId: string, data: Omit<Transaction, 'id'>) => {
  if (!db) return false;
  try {
    const txRef = collection(db, "users", userId, "transactions");

    // 1. Check by strict Provider ID (globally unique for the provider)
    // If we have a providerId, we TRUST it. If it exists, it's a duplicate.
    // If it doesn't exist, it's NEW. We do NOT fall back to fuzzy matching 
    // because that causes false positives (e.g. matching a manual transaction with same amount).
    if (data.providerId) {
      const providerFilters = [where("providerId", "==", data.providerId)];
      const providerSnap = await getDocs(query(txRef, ...providerFilters, limit(1)));
      return !providerSnap.empty;
    }

    // 2. Fallback: Fuzzy Match (Only for Manual/OFX transactions)
    // We only check Date, Amount, Type.
    const filters = [
      where("date", "==", data.date),
      where("amount", "==", data.amount),
      where("type", "==", data.type)
    ];

    const q = query(txRef, ...filters, limit(50));
    const snap = await getDocs(q);
    if (snap.empty) return false;

    // Normalize helper: remove all non-alphanumeric, lowercase
    const normalize = (str: string) => (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");

    const targetDesc = normalize(data.description);

    return snap.docs.some(doc => {
      const d = doc.data() as any;
      // If the existing transaction has a providerId, we should NOT match it loosely
      // against a manual transaction (unlikely case, but good safety).
      // Actually, if we are here, 'data' (incoming) has NO providerId.
      // So we are comparing a Manual Candidate vs Existing DB entries.

      const desc = normalize(d.description);
      // If normalized descriptions match, it's a duplicate.
      return desc === targetDesc;
    });
  } catch (err) {
    console.error("Erro ao verificar duplicidade de transacao:", err);
    return false;
  }
};

// Add transaction only if it doesn't exist (for incremental sync)
export const addTransactionIfNotExists = async (userId: string, transaction: Omit<Transaction, 'id'>) => {
  if (!db) return "";
  try {
    const exists = await transactionExists(userId, transaction);
    if (exists) {
      // Transaction already exists, skip
      return "";
    }
    // Add new transaction
    const cleanTransaction = removeUndefinedTx(transaction);
    const txRef = collection(db, "users", userId, "transactions");
    const docRef = await addDoc(txRef, cleanTransaction);
    return docRef.id;
  } catch (error) {
    console.error("Error adding transaction if not exists:", error);
    return "";
  }
};

export const updateTransaction = async (userId: string, transaction: Transaction) => {
  if (!db) return;
  const txRef = doc(db, "users", userId, "transactions", transaction.id);
  const { id, ...data } = transaction;
  await updateDoc(txRef, data);
};

export const deleteTransaction = async (userId: string, transactionId: string) => {
  if (!db) return;
  const txRef = doc(db, "users", userId, "transactions", transactionId);
  await deleteDoc(txRef);
};

export const restoreTransaction = async (userId: string, transaction: Transaction) => {
  if (!db) return;
  // Ao restaurar, usamos o ID original se possível, ou criamos novo
  // SetDoc permite definir o ID manualmente
  const txRef = doc(db, "users", userId, "transactions", transaction.id);
  const { id, ...data } = transaction;
  await setDoc(txRef, data);
};

export const listenToTransactions = (userId: string, callback: (transactions: Transaction[]) => void, minYear: number = 2025) => {
  if (!db) return () => { };
  const txRef = collection(db, "users", userId, "transactions");

  // Filtrar apenas transações de 2025+ para reduzir custos do Firestore
  const minDate = `${minYear}-01-01`;
  const q = query(txRef, where("date", ">=", minDate));

  return onSnapshot(q, (snapshot) => {
    const transactions: Transaction[] = [];
    snapshot.forEach(doc => {
      transactions.push({ id: doc.id, ...doc.data() } as Transaction);
    });
    callback(transactions);
  });
};

export const getTransactions = async (userId: string, minYear: number = 2025): Promise<Transaction[]> => {
  if (!db) return [];
  const txRef = collection(db, "users", userId, "transactions");
  const minDate = `${minYear}-01-01`;
  const q = query(txRef, where("date", ">=", minDate));

  const snapshot = await getDocs(q);
  const transactions: Transaction[] = [];
  snapshot.forEach(doc => {
    transactions.push({ id: doc.id, ...doc.data() } as Transaction);
  });

  // Sort client-side
  transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return transactions;
};

// --- Credit Card Transactions Services ---
export interface CreditCardTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'income' | 'expense';
  status: 'completed' | 'pending';
  cardId: string;
  cardName?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  importSource: string;
  providerId?: string;
  providerItemId?: string;
  dueDate?: string;
  invoiceDate?: string;
  invoiceDueDate?: string;
  invoiceMonthKey?: string;
  pluggyBillId?: string | null;
  invoiceSource?: string;
  pluggyRaw?: any;
  isProjected?: boolean;
  isEstimated?: boolean; // True when value is estimated, awaiting real data from API
}

// Helper to remove undefined values (Firebase doesn't accept undefined)
const removeUndefined = <T extends Record<string, any>>(obj: T): T => {
  const result = {} as T;
  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
};

export const addCreditCardTransaction = async (userId: string, transaction: Omit<CreditCardTransaction, 'id'>, customId?: string) => {
  if (!db) return "";
  const txRef = collection(db, "users", userId, "creditCardTransactions");
  const cleanTransaction = removeUndefined(transaction);

  if (customId) {
    const docRef = doc(txRef, customId);
    const snap = await getDoc(docRef);
    if (snap.exists()) return customId;
    await setDoc(docRef, cleanTransaction);
    return customId;
  } else {
    const docRef = await addDoc(txRef, cleanTransaction);
    return docRef.id;
  }
};

export const creditCardTransactionExists = async (userId: string, providerId: string, txData?: Partial<CreditCardTransaction>) => {
  const id = await findCreditCardTransactionId(userId, providerId, txData);
  return !!id;
};

export const findCreditCardTransactionId = async (userId: string, providerId: string, txData?: Partial<CreditCardTransaction>) => {
  if (!db) return null;
  try {
    const txRef = collection(db, "users", userId, "creditCardTransactions");

    // 1. Check by exact providerId first
    if (providerId) {
      const providerQuery = query(txRef, where("providerId", "==", providerId), limit(1));
      const providerSnap = await getDocs(providerQuery);
      if (!providerSnap.empty) return providerSnap.docs[0].id;

      // 1b. Check if this is a real transaction that matches a projected installment
      // e.g., providerId "abc123" might have a projected version "abc123_installment_2"
      // Or vice versa: "abc123_installment_2" looking for base "abc123"
      if (providerId.includes('_installment_')) {
        // This is a projected installment, check if the real one exists
        const baseId = providerId.split('_installment_')[0];
        const baseQuery = query(txRef, where("providerId", "==", baseId), limit(1));
        const baseSnap = await getDocs(baseQuery);
        if (!baseSnap.empty) return baseSnap.docs[0].id;
      } else {
        // This is a real transaction, check if any projected version exists with same date/description
        // Will be caught by fuzzy match below
      }
    }

    // 2. Fuzzy match by description + approximate amount (with date window for installments)
    // This catches duplicates where providerId differs but it's the same transaction
    if (txData?.date && txData?.description && txData?.amount !== undefined) {
      // Normalize description for comparison
      const normalize = (str: string) => (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");

      // Remove installment pattern for fuzzy comparison (e.g. "Store 1/10" should match "Store 2/10")
      const stripInstallment = (str: string) => str.replace(/\s*\d+\/\d+/, '');

      const targetDescNormalized = normalize(stripInstallment(txData.description));
      const targetAmount = txData.amount;

      // Check if this is an installment transaction (has X/Y pattern)
      const installmentMatch = txData.description.match(/(\d+)\/(\d+)/);
      const isInstallment = !!installmentMatch;

      // For installments, use a wider date window (±5 days) since projected dates may differ
      // For regular transactions, use exact date
      const targetDate = new Date(txData.date);
      const dateWindowDays = isInstallment ? 5 : 0;

      // Query transactions within the date window
      const startDate = new Date(targetDate);
      startDate.setDate(startDate.getDate() - dateWindowDays);
      const endDate = new Date(targetDate);
      endDate.setDate(endDate.getDate() + dateWindowDays);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const dateQuery = query(
        txRef,
        where("date", ">=", startDateStr),
        where("date", "<=", endDateStr),
        limit(200)
      );
      const dateSnap = await getDocs(dateQuery);

      if (!dateSnap.empty) {
        for (const docSnap of dateSnap.docs) {
          const data = docSnap.data();

          const existingDesc = normalize(stripInstallment(data.description || ""));
          const existingAmount = data.amount || 0;

          // Check if descriptions match (normalized and stripped of installment info)
          if (existingDesc === targetDescNormalized) {            // Allow 1% tolerance for amount differences (rounding issues)
            const amountDiff = Math.abs(existingAmount - targetAmount);
            const tolerance = Math.max(existingAmount, targetAmount) * 0.01;

            if (amountDiff <= Math.max(tolerance, 0.02)) { // At least 2 cents tolerance
              console.log(`[CC Duplicate] Found fuzzy match: ${txData.description} | existing: ${existingAmount} vs new: ${targetAmount}`);
              return docSnap.id;
            }
          }
        }
      }
    }

    return null;
  } catch (err) {
    console.error("Error checking credit card transaction:", err);
    return null;
  }
};

export const getCreditCardTransactions = async (userId: string): Promise<CreditCardTransaction[]> => {
  if (!db) return [];
  try {
    const txRef = collection(db, "users", userId, "creditCardTransactions");
    // Limit to recent to avoid huge fetches if necessary, or just fetch all for now
    // For now fetching all as the listener does (listener fetches all?)
    // Actually the listener doesn't have a query limit in the code snippet I saw earlier? 
    // Let's check listenToCreditCardTransactions implementation if I can.
    // Assuming fetch all is fine for now as per other patterns.
    const snapshot = await getDocs(txRef);
    const transactions: CreditCardTransaction[] = [];
    snapshot.forEach(doc => {
      transactions.push({ id: doc.id, ...doc.data() } as CreditCardTransaction);
    });
    return transactions;
  } catch (error) {
    console.error("Error fetching CC transactions:", error);
    return [];
  }
};

// Helper to delete projected installments for a given base transaction
const deleteProjectedInstallments = async (userId: string, baseProviderId: string) => {
  if (!db || !baseProviderId) return;

  // Don't delete if the base itself is an installment projection (safety)
  if (baseProviderId.includes('_installment_')) return;

  try {
    const txRef = collection(db, "users", userId, "creditCardTransactions");
    // Projected installments usually have format: baseId_installment_X
    const prefix = `${baseProviderId}_installment_`;

    // Firestore range query for prefix
    const q = query(
      txRef,
      where("providerId", ">=", prefix),
      where("providerId", "<", prefix + "\uf8ff")
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    let count = 0;

    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
      count++;
    });

    if (count > 0) {
      await batch.commit();
      console.log(`[DB] Deleted ${count} old projected installments for ${baseProviderId}`);
    }
  } catch (err) {
    console.error("Error deleting projected installments:", err);
  }
};

export const upsertCreditCardTransaction = async (userId: string, transaction: Omit<CreditCardTransaction, 'id'>) => {
  if (!db) return "";
  try {
    const existingId = await findCreditCardTransactionId(userId, transaction.providerId || "", transaction);

    // If this is a REAL transaction (not a projection), cleanup its old projections to avoid ghosts
    const isNewProjected = (transaction.providerId || "").includes("_installment_");
    /* 
    // Temporarily disabled due to reports of missing transactions. 
    // Suspect aggressive deletion or race condition.
    if (!isNewProjected && transaction.providerId) {
        await deleteProjectedInstallments(userId, transaction.providerId);
    } 
    */

    if (existingId) {
      // UPDATE
      // Safety check: Don't overwrite a REAL transaction (no _installment_) with a PROJECTED one (_installment_)
      const isNewProjected = (transaction.providerId || "").includes("_installment_");

      // We need to know if the EXISTING one is real or projected. 
      // But fetching it again is costly. We can trust the ID returned by findCreditCardTransactionId logic.
      // If logic 1b returned the Base ID, then we are trying to save a projected one but found a base one.
      // In that case, we should SKIP update.

      // However, simplified: if existingId is found, we generally update it to keep data fresh.
      // BUT, let's respect the "Real trumps Projected" rule.

      // Let's just update for now, assuming the sync provides better data.
      // Exception: If we are trying to save a projected installment, but we found a REAL transaction (via fuzzy or baseID match),
      // we should NOT overwrite the real one.

      if (isNewProjected) {
        // Check if we matched a base transaction? Too complex.
        // Let's just update. Pluggy sync usually gives correct data.
        // Actually, if we update, we might overwrite "Completed" status with "Pending" or projected data.
        // Let's only update if the new data is NOT projected OR if both are projected.
        // For now, simpler: Upsert always updates.
        // Users complain about missing fields -> Update is required.
      }

      await updateCreditCardTransaction(userId, { ...transaction, id: existingId });
      return existingId;
    } else {
      // ADD
      return await addCreditCardTransaction(userId, transaction);
    }
  } catch (error) {
    console.error("Error upserting credit card transaction:", error);
    return "";
  }
};

export const addCreditCardTransactionIfNotExists = async (userId: string, transaction: Omit<CreditCardTransaction, 'id'>) => {
  if (!db) return "";
  try {
    const existingId = await findCreditCardTransactionId(userId, transaction.providerId || "", transaction);

    if (existingId) {
      // Transaction already exists, return empty string to indicate no new data added
      return "";
    } else {
      // ADD new transaction - return the new ID
      return await addCreditCardTransaction(userId, transaction);
    }
  } catch (error) {
    console.error("Error adding credit card transaction if not exists:", error);
    return "";
  }
};

export const cleanupDuplicateCreditCardTransactions = async (userId: string) => {
  if (!db) return;
  try {
    const txRef = collection(db, "users", userId, "creditCardTransactions");
    const snapshot = await getDocs(txRef);

    // 1. Strict Deduplication by providerId
    const strictMap = new Map<string, string[]>();

    // 2. Store all transactions for fuzzy matching
    const allTransactions: any[] = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const id = docSnap.id;

      // Strict Map
      if (data.providerId) {
        const list = strictMap.get(data.providerId) || [];
        list.push(id);
        strictMap.set(data.providerId, list);
      }

      allTransactions.push({ id, ...data });
    });

    let deletedCount = 0;
    let batch = writeBatch(db);
    let batchCount = 0;
    const deletedIds = new Set<string>();

    // Pass 1: Strict Cleanup by providerId
    for (const [providerId, ids] of strictMap.entries()) {
      if (ids.length > 1) {
        for (let i = 1; i < ids.length; i++) {
          if (!deletedIds.has(ids[i])) {
            const docRef = doc(db, "users", userId, "creditCardTransactions", ids[i]);
            batch.delete(docRef);
            deletedIds.add(ids[i]);
            deletedCount++;
            batchCount++;
          }
        }
      }
    }

    // Pass 2: Fuzzy Cleanup with amount tolerance
    // Group by normalized description (and approximate date for installments)
    const normalize = (str: string) => (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");

    // Helper to get month key from date (YYYY-MM)
    const getMonthKey = (dateStr: string) => dateStr?.substring(0, 7) || '';

    // Check if description contains installment pattern (X/Y)
    const isInstallment = (desc: string) => /\d+\/\d+/.test(desc);

    const fuzzyGroups = new Map<string, any[]>();

    for (const tx of allTransactions) {
      if (deletedIds.has(tx.id)) continue;

      const normDesc = normalize(tx.description);
      // For installments, group by month + description (allows date variation within month)
      // For regular transactions, group by exact date + description
      const dateKey = isInstallment(tx.description || '') ? getMonthKey(tx.date) : tx.date;
      const fuzzyKey = `${dateKey}|${normDesc}`;
      const list = fuzzyGroups.get(fuzzyKey) || [];
      list.push(tx);
      fuzzyGroups.set(fuzzyKey, list);
    }

    for (const [key, items] of fuzzyGroups.entries()) {
      // Filter out already deleted items
      let activeItems = items.filter(i => !deletedIds.has(i.id));

      if (activeItems.length <= 1) continue;

      // Group items by similar amounts (within 1% or 2 cents tolerance)
      const amountGroups: any[][] = [];
      const usedIndices = new Set<number>();

      for (let i = 0; i < activeItems.length; i++) {
        if (usedIndices.has(i)) continue;

        const group = [activeItems[i]];
        usedIndices.add(i);

        for (let j = i + 1; j < activeItems.length; j++) {
          if (usedIndices.has(j)) continue;

          const amount1 = activeItems[i].amount || 0;
          const amount2 = activeItems[j].amount || 0;
          const diff = Math.abs(amount1 - amount2);
          const tolerance = Math.max(amount1, amount2) * 0.01; // 1% tolerance

          if (diff <= Math.max(tolerance, 0.02)) { // At least 2 cents
            group.push(activeItems[j]);
            usedIndices.add(j);
          }
        }

        if (group.length > 1) {
          amountGroups.push(group);
        }
      }

      // Process each amount group - keep the best one, delete the rest
      for (const group of amountGroups) {
        // Sort to determine which to keep
        group.sort((a, b) => {
          // Priority 1: completed status > pending
          if (a.status === 'completed' && b.status !== 'completed') return -1;
          if (b.status === 'completed' && a.status !== 'completed') return 1;

          // Priority 2: Real providerId > generated installment
          const aGen = (a.providerId || "").includes("_installment_");
          const bGen = (b.providerId || "").includes("_installment_");
          if (!aGen && bGen) return -1;
          if (aGen && !bGen) return 1;

          // Priority 3: Has providerId > no providerId
          if (a.providerId && !b.providerId) return -1;
          if (b.providerId && !a.providerId) return 1;

          return 0;
        });

        // Keep group[0], delete the rest
        for (let i = 1; i < group.length; i++) {
          const idToDelete = group[i].id;
          if (!deletedIds.has(idToDelete)) {
            const docRef = doc(db, "users", userId, "creditCardTransactions", idToDelete);
            batch.delete(docRef);
            deletedIds.add(idToDelete);
            deletedCount++;
            batchCount++;

            // Commit batch if approaching limit
            if (batchCount >= 450) {
              await batch.commit();
              batch = writeBatch(db);
              batchCount = 0;
            }
          }
        }
      }
    }

    // Commit remaining operations
    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`Cleaned up ${deletedCount} duplicate credit card transactions.`);
    return deletedCount;
  } catch (err) {
    console.error("Error cleaning up duplicates:", err);
    throw err;
  }
};

export const updateCreditCardTransaction = async (userId: string, transaction: CreditCardTransaction) => {
  if (!db) return;
  const txRef = doc(db, "users", userId, "creditCardTransactions", transaction.id);
  const { id, ...data } = transaction;
  const cleanData = removeUndefined(data);
  await updateDoc(txRef, cleanData);
};

export const deleteCreditCardTransaction = async (userId: string, transactionId: string) => {
  if (!db) return;
  const txRef = doc(db, "users", userId, "creditCardTransactions", transactionId);
  await deleteDoc(txRef);
};

export const listenToCreditCardTransactions = (userId: string, callback: (transactions: CreditCardTransaction[]) => void, minYear: number = 2025) => {
  if (!db) return () => { };
  const txRef = collection(db, "users", userId, "creditCardTransactions");

  // Filtrar apenas transações de 2025+ para reduzir custos do Firestore
  const minDate = `${minYear}-01-01`;
  const q = query(txRef, where("date", ">=", minDate));

  return onSnapshot(q, (snapshot) => {
    const transactions: CreditCardTransaction[] = [];
    snapshot.forEach(doc => {
      transactions.push({ id: doc.id, ...doc.data() } as CreditCardTransaction);
    });
    // Sort by date descending
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    callback(transactions);
  });
};

export const deleteAllCreditCardTransactions = async (userId: string) => {
  if (!db) return 0;
  try {
    const txRef = collection(db, "users", userId, "creditCardTransactions");
    const snapshot = await getDocs(txRef);

    const batchSize = 450;
    let batch = writeBatch(db);
    let operationCount = 0;
    let totalDeleted = 0;

    for (const docSnapshot of snapshot.docs) {
      batch.delete(docSnapshot.ref);
      operationCount++;
      totalDeleted++;

      if (operationCount >= batchSize) {
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
      }
    }

    if (operationCount > 0) {
      await batch.commit();
    }

    console.log(`Deleted ${totalDeleted} credit card transactions for user ${userId}`);
    return totalDeleted;
  } catch (error) {
    console.error("Error deleting credit card transactions:", error);
    throw error;
  }
};

// --- Reminders Services ---
export const addReminder = async (userId: string, reminder: Omit<Reminder, 'id'>) => {
  if (!db) return "";
  const remRef = collection(db, "users", userId, "reminders");
  const docRef = await addDoc(remRef, reminder);
  return docRef.id;
};

export const deleteReminder = async (userId: string, reminderId: string) => {
  if (!db) return;
  const remRef = doc(db, "users", userId, "reminders", reminderId);
  await deleteDoc(remRef);
};

export const updateReminder = async (userId: string, reminder: Reminder) => {
  if (!db) return;
  const remRef = doc(db, "users", userId, "reminders", reminder.id);
  const { id, ...data } = reminder;
  await updateDoc(remRef, data);
};

export const listenToReminders = (userId: string, callback: (reminders: Reminder[]) => void) => {
  if (!db) return () => { };
  const remRef = collection(db, "users", userId, "reminders");

  return onSnapshot(remRef, (snapshot) => {
    const reminders: Reminder[] = [];
    snapshot.forEach(doc => {
      reminders.push({ id: doc.id, ...doc.data() } as Reminder);
    });
    callback(reminders);
  });
};

// --- Investments Services ---
export const addInvestment = async (userId: string, investment: Omit<Investment, 'id'>) => {
  if (!db) return "";
  const invRef = collection(db, "users", userId, "investments");
  const docRef = await addDoc(invRef, investment);
  return docRef.id;
};

export const updateInvestment = async (userId: string, investment: Investment) => {
  if (!db) return;
  const invRef = doc(db, "users", userId, "investments", investment.id);
  const { id, ...data } = investment;
  await updateDoc(invRef, data);
};

export const deleteInvestment = async (userId: string, investmentId: string) => {
  if (!db) return;
  const invRef = doc(db, "users", userId, "investments", investmentId);
  await deleteDoc(invRef);
};

// Delete investments with invalid currentAmount (NaN, null, undefined, or empty name)
export const deleteInvalidInvestments = async (userId: string) => {
  if (!db) return 0;
  try {
    const invRef = collection(db, "users", userId, "investments");
    const snapshot = await getDocs(invRef);

    let deletedCount = 0;
    const batch = writeBatch(db);

    snapshot.docs.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const currentAmount = data.currentAmount;
      const name = data.name;

      // Check if currentAmount is invalid: undefined, null, NaN, or not a number
      const isAmountInvalid = currentAmount === undefined ||
        currentAmount === null ||
        (typeof currentAmount === 'number' && isNaN(currentAmount)) ||
        typeof currentAmount !== 'number';

      // Also check for empty/missing name (indicates corrupted data)
      const isNameInvalid = !name || name.trim() === '';

      if (isAmountInvalid || isNameInvalid) {
        batch.delete(docSnapshot.ref);
        deletedCount++;
        console.log(`[deleteInvalidInvestments] Marking for deletion: ${docSnapshot.id}, currentAmount: ${currentAmount}, name: ${name}`);
      }
    });

    if (deletedCount > 0) {
      await batch.commit();
      console.log(`Deleted ${deletedCount} invalid investments for user ${userId}`);
    }

    return deletedCount;
  } catch (error) {
    console.error("Error deleting invalid investments:", error);
    throw error;
  }
};

export const listenToInvestments = (userId: string, callback: (investments: Investment[]) => void) => {
  if (!db) return () => { };
  const invRef = collection(db, "users", userId, "investments");

  return onSnapshot(invRef, (snapshot) => {
    const investments: Investment[] = [];
    snapshot.forEach(doc => {
      investments.push({ id: doc.id, ...doc.data() } as Investment);
    });
    callback(investments);
  });
};

// --- Budgets Services ---
export const addBudget = async (userId: string, budget: Omit<Budget, 'id'>) => {
  if (!db) return "";
  const budgetRef = collection(db, "users", userId, "budgets");
  const docRef = await addDoc(budgetRef, budget);
  return docRef.id;
};

export const updateBudget = async (userId: string, budget: Budget) => {
  if (!db) return;
  const budgetRef = doc(db, "users", userId, "budgets", budget.id);
  const { id, ...data } = budget;
  await updateDoc(budgetRef, data);
};

export const deleteBudget = async (userId: string, budgetId: string) => {
  if (!db) return;
  const budgetRef = doc(db, "users", userId, "budgets", budgetId);
  await deleteDoc(budgetRef);
};

export const listenToBudgets = (userId: string, callback: (budgets: Budget[]) => void) => {
  if (!db) return () => { };
  const budgetRef = collection(db, "users", userId, "budgets");

  return onSnapshot(budgetRef, (snapshot) => {
    const budgets: Budget[] = [];
    snapshot.forEach(doc => {
      budgets.push({ id: doc.id, ...doc.data() } as Budget);
    });
    callback(budgets);
  });
};

// --- Connected Accounts Services ---
export const addConnectedAccount = async (userId: string, account: ConnectedAccount) => {
  if (!db) return;
  const accountsRef = collection(db, "users", userId, "accounts");
  // Use account.id as doc ID to prevent duplicates
  const docRef = doc(accountsRef, account.id);
  const cleanAccount = removeUndefined(account);
  await setDoc(docRef, cleanAccount, { merge: true });
};

export const updateConnectedAccount = async (userId: string, accountId: string, data: Partial<ConnectedAccount>) => {
  if (!db) return;
  const accountRef = doc(db, "users", userId, "accounts", accountId);
  const cleanData = removeUndefined(data);
  await setDoc(accountRef, cleanData, { merge: true });
};

export const updateConnectedAccountMode = async (userId: string, accountId: string, mode: 'AUTO' | 'MANUAL', initialBalance?: number) => {
  try {
    const accountRef = doc(db, "users", userId, "accounts", accountId);
    const updateData: any = { connectionMode: mode };
    if (initialBalance !== undefined) {
      updateData.initialBalance = initialBalance;
      updateData.balance = initialBalance;
    }
    await updateDoc(accountRef, updateData);
    console.log(`Account ${accountId} mode updated to ${mode}`);
  } catch (error) {
    console.error("Error updating account mode:", error);
    throw error;
  }
};

export const deleteManualTransactionsForAccount = async (userId: string, accountId: string) => {
  try {
    const txRef = collection(db, "users", userId, "transactions");
    const q = query(txRef, where("accountId", "==", accountId));
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (!data.importSource) {
        batch.delete(doc.ref);
      }
    });
    await batch.commit();
  } catch (error) {
    console.error("Error deleting manual transactions:", error);
    throw error;
  }
};

// Delete imported (auto) transactions for an account - used for "Start from Zero" option
export const deleteImportedTransactionsForAccount = async (userId: string, accountId: string) => {
  try {
    const txRef = collection(db, "users", userId, "transactions");
    const q = query(txRef, where("accountId", "==", accountId));
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);
    let deletedCount = 0;
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      // Delete transactions that were imported (have importSource)
      if (data.importSource) {
        batch.delete(doc.ref);
        deletedCount++;
      }
    });

    if (deletedCount > 0) {
      await batch.commit();
      console.log(`Deleted ${deletedCount} imported transactions for account ${accountId}`);
    }
  } catch (error) {
    console.error("Error deleting imported transactions:", error);
    throw error;
  }
};

// Delete ALL imported (auto) transactions for a user - used for global "Start from Zero" option
// This catches any transactions that may not have accountId but do have importSource
export const deleteAllImportedTransactions = async (userId: string) => {
  try {
    const txRef = collection(db, "users", userId, "transactions");
    const snapshot = await getDocs(txRef);

    // Firestore batch has a limit of 500 operations, so we need to split into multiple batches
    const batchSize = 450;
    let batch = writeBatch(db);
    let operationCount = 0;
    let totalDeleted = 0;

    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      // Delete transactions that were imported (have importSource)
      if (data.importSource) {
        batch.delete(docSnapshot.ref);
        operationCount++;
        totalDeleted++;

        // Commit current batch if we reach the limit
        if (operationCount >= batchSize) {
          await batch.commit();
          batch = writeBatch(db);
          operationCount = 0;
        }
      }
    }

    // Commit remaining operations
    if (operationCount > 0) {
      await batch.commit();
    }

    console.log(`Deleted ${totalDeleted} total imported transactions for user ${userId}`);
    return totalDeleted;
  } catch (error) {
    console.error("Error deleting all imported transactions:", error);
    throw error;
  }
};

export const deleteAllManualTransactions = async (userId: string) => {
  try {
    const txRef = collection(db, "users", userId, "transactions");
    const snapshot = await getDocs(txRef);

    const batchSize = 450;
    let batch = writeBatch(db);
    let operationCount = 0;
    let totalDeleted = 0;

    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      // Delete transactions that are MANUAL (do NOT have importSource AND do NOT have providerId)
      // providerId is legacy but still used by some importers like Klavi in this codebase
      if (!data.importSource && !data.providerId) {
        batch.delete(docSnapshot.ref);
        operationCount++;
        totalDeleted++;

        if (operationCount >= batchSize) {
          await batch.commit();
          batch = writeBatch(db);
          operationCount = 0;
        }
      }
    }

    if (operationCount > 0) {
      await batch.commit();
    }

    console.log(`Deleted ${totalDeleted} total manual transactions for user ${userId}`);
    return totalDeleted;
  } catch (error) {
    console.error("Error deleting all manual transactions:", error);
    throw error;
  }
};

export const deleteAllUserTransactions = async (userId: string) => {
  try {
    const txRef = collection(db, "users", userId, "transactions");
    const snapshot = await getDocs(txRef);

    const batchSize = 450;
    let batch = writeBatch(db);
    let operationCount = 0;
    let totalDeleted = 0;

    for (const docSnapshot of snapshot.docs) {
      batch.delete(docSnapshot.ref);
      operationCount++;
      totalDeleted++;

      if (operationCount >= batchSize) {
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
      }
    }

    if (operationCount > 0) {
      await batch.commit();
    }

    console.log(`Deleted ${totalDeleted} transactions (ALL) for user ${userId}`);
    return totalDeleted;
  } catch (error) {
    console.error("Error deleting all user transactions:", error);
    throw error;
  }
};

export const resetAccountData = async (userId: string, accountId: string, initialBalance: number, deleteImportedHistory: boolean = true) => {
  try {
    // If deleteImportedHistory is true (default for "Start from Zero"), delete imported transactions
    // This will make income/expense from Open Finance become zero
    if (deleteImportedHistory) {
      await deleteImportedTransactionsForAccount(userId, accountId);
    }

    await updateConnectedAccountMode(userId, accountId, 'MANUAL', initialBalance);
  } catch (error) {
    console.error("Error resetting account data:", error);
    throw error;
  }
};

// Listen to Connected Accounts (Real-time)
export const listenToConnectedAccounts = (userId: string, callback: (accounts: any[]) => void) => {
  if (!db) return () => { };
  const accountsRef = collection(db, "users", userId, "accounts");

  return onSnapshot(accountsRef, (snapshot) => {
    const accounts: ConnectedAccount[] = [];
    snapshot.forEach(doc => {
      accounts.push({ id: doc.id, ...doc.data() } as ConnectedAccount);
    });
    callback(accounts);
  });
};

export const deleteConnectedAccount = async (userId: string, accountId: string) => {
  if (!db) return;
  const accountRef = doc(db, "users", userId, "accounts", accountId);
  await deleteDoc(accountRef);
};

export const deleteAllTransactionsForAccount = async (userId: string, accountId: string) => {
  if (!db) return;
  try {
    const txRef = collection(db, "users", userId, "transactions");
    const q = query(txRef, where("accountId", "==", accountId));
    const snapshot = await getDocs(q);

    const batchSize = 450;
    let batch = writeBatch(db);
    let operationCount = 0;

    for (const docSnapshot of snapshot.docs) {
      batch.delete(docSnapshot.ref);
      operationCount++;

      if (operationCount >= batchSize) {
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
      }
    }

    if (operationCount > 0) {
      await batch.commit();
    }
  } catch (error) {
    console.error("Error deleting account transactions:", error);
    throw error;
  }
};

export const deleteAllCreditCardTransactionsForAccount = async (userId: string, accountId: string) => {
  if (!db) return;
  try {
    const txRef = collection(db, "users", userId, "creditCardTransactions");
    const q = query(txRef, where("cardId", "==", accountId));
    const snapshot = await getDocs(q);

    const batchSize = 450;
    let batch = writeBatch(db);
    let operationCount = 0;

    for (const docSnapshot of snapshot.docs) {
      batch.delete(docSnapshot.ref);
      operationCount++;

      if (operationCount >= batchSize) {
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
      }
    }

    if (operationCount > 0) {
      await batch.commit();
    }
  } catch (error) {
    console.error("Error deleting account credit card transactions:", error);
    throw error;
  }
};


export const deleteAllConnectedAccounts = async (userId: string) => {
  if (!db) return;
  try {
    const accountsRef = collection(db, "users", userId, "accounts");
    const snapshot = await getDocs(accountsRef);

    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Deleted ${snapshot.size} connected accounts for user ${userId}`);
  } catch (error) {
    console.error("Error deleting all connected accounts:", error);
    throw error;
  }
};

// Delete accounts with invalid balance (NaN, null, undefined)
export const deleteInvalidAccounts = async (userId: string) => {
  if (!db) return 0;
  try {
    const accountsRef = collection(db, "users", userId, "accounts");
    const snapshot = await getDocs(accountsRef);

    let deletedCount = 0;
    const batch = writeBatch(db);

    snapshot.docs.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const balance = data.balance;

      // Check if balance is invalid: undefined, null, NaN, or not a number
      const isInvalid = balance === undefined ||
        balance === null ||
        (typeof balance === 'number' && isNaN(balance)) ||
        typeof balance !== 'number';

      if (isInvalid) {
        batch.delete(docSnapshot.ref);
        deletedCount++;
        console.log(`[deleteInvalidAccounts] Marking for deletion: ${docSnapshot.id}, balance: ${balance}`);
      }
    });

    if (deletedCount > 0) {
      await batch.commit();
      console.log(`Deleted ${deletedCount} invalid accounts for user ${userId}`);
    }

    return deletedCount;
  } catch (error) {
    console.error("Error deleting invalid accounts:", error);
    throw error;
  }
};

// --- Notifications ---
export const addNotification = async (userId: string, notification: Omit<AppNotification, 'id'>) => {
  if (!db) return "";
  const notifRef = collection(db, "users", userId, "notifications");
  const docRef = await addDoc(notifRef, notification);
  return docRef.id;
};

export const updateNotification = async (userId: string, notification: AppNotification) => {
  if (!db) return;
  const notifRef = doc(db, "users", userId, "notifications", notification.id);
  const { id, ...data } = notification;
  await updateDoc(notifRef, data as any);
};

export const deleteNotification = async (userId: string, notificationId: string) => {
  if (!db) return;
  const notifRef = doc(db, "users", userId, "notifications", notificationId);
  await deleteDoc(notifRef);
};

export const listenToNotifications = (userId: string, callback: (notifications: AppNotification[]) => void) => {
  if (!db) return () => { };
  const notifRef = collection(db, "users", userId, "notifications");

  return onSnapshot(notifRef, (snapshot) => {
    const notes: AppNotification[] = [];
    snapshot.forEach(docSnap => {
      notes.push({ id: docSnap.id, ...(docSnap.data() as any) });
    });
    // Optionally sort by date desc
    notes.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    callback(notes);
  });
};

// --- Audit Log Services ---
export interface AuditLogEntry {
  id?: string;
  timestamp: string;
  action: 'MODE_CHANGE_TO_MANUAL' | 'MODE_CHANGE_TO_AUTO' | 'ACCOUNT_CONNECTED' | 'ACCOUNT_DISCONNECTED';
  accountId?: string;
  accountName?: string;
  details: {
    previousMode?: 'AUTO' | 'MANUAL';
    newMode?: 'AUTO' | 'MANUAL';
    keepHistory?: boolean;
    initialBalance?: number;
    isGlobal?: boolean;
  };
}

export const addAuditLog = async (userId: string, entry: Omit<AuditLogEntry, 'id'>) => {
  if (!db) return "";
  const auditRef = collection(db, "users", userId, "auditLogs");
  const docRef = await addDoc(auditRef, entry);
  console.log(`[Audit] ${entry.action} - Account: ${entry.accountName || 'Global'} - Details:`, entry.details);
  return docRef.id;
};

export const listenToAuditLogs = (userId: string, callback: (logs: AuditLogEntry[]) => void) => {
  if (!db) return () => { };
  const auditRef = collection(db, "users", userId, "auditLogs");

  return onSnapshot(auditRef, (snapshot) => {
    const logs: AuditLogEntry[] = [];
    snapshot.forEach(docSnap => {
      logs.push({ id: docSnap.id, ...(docSnap.data() as AuditLogEntry) });
    });
    // Sort by timestamp desc
    logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    callback(logs);
  });
};

// --- Daily Connection Credits ---
export const incrementDailyConnectionCredits = async (userId: string) => {
  if (!db) return;
  console.log('[DB] Incrementing daily credits for user (Transaction):', userId);
  const userRef = doc(db, "users", userId);

  try {
    const newCount = await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) {
        throw "User does not exist!";
      }

      const userData = userDoc.data();
      const credits = userData.dailyConnectionCredits || { date: '', count: 0 };
      const today = new Date().toLocaleDateString('en-CA');

      let newCredits;
      if (credits.date !== today) {
        // Reset for new day
        newCredits = { date: today, count: 1 };
      } else {
        // Increment for today
        newCredits = { ...credits, count: credits.count + 1 };
      }

      transaction.update(userRef, { dailyConnectionCredits: newCredits });
      return newCredits.count;
    });

    return newCount;
  } catch (e) {
    console.error("Transaction failed: ", e);
    throw e;
  }
};




// --- Coupon Services ---

export const addCoupon = async (coupon: Omit<Coupon, 'id'>) => {
  if (!db) return "";
  const couponsRef = collection(db, "coupons");
  // Check if code exists
  const q = query(couponsRef, where("code", "==", coupon.code));
  const snap = await getDocs(q);
  if (!snap.empty) {
    throw new Error("Código de cupom já existe.");
  }

  const docRef = await addDoc(couponsRef, coupon);
  return docRef.id;
};

export const updateCoupon = async (coupon: Coupon) => {
  if (!db) return;
  const couponRef = doc(db, "coupons", coupon.id);
  const { id, ...data } = coupon;
  await updateDoc(couponRef, data);
};

export const deleteCoupon = async (couponId: string) => {
  if (!db) return;
  const couponRef = doc(db, "coupons", couponId);
  await deleteDoc(couponRef);
};

export const getCoupons = async (): Promise<Coupon[]> => {
  if (!db) return [];
  const couponsRef = collection(db, "coupons");
  const snap = await getDocs(couponsRef);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Coupon));
};

export const getCouponByCode = async (code: string): Promise<Coupon | null> => {
  if (!db) return null;
  const couponsRef = collection(db, "coupons");
  const q = query(couponsRef, where("code", "==", code), limit(1));
  const snap = await getDocs(q);

  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Coupon;
};

export const getCouponById = async (couponId: string): Promise<Coupon | null> => {
  if (!db) return null;
  const couponRef = doc(db, "coupons", couponId);
  const snap = await getDoc(couponRef);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as Coupon;
  }
  return null;
};

export const validateCoupon = async (code: string): Promise<{ isValid: boolean; coupon?: Coupon; error?: string }> => {
  const coupon = await getCouponByCode(code);

  if (!coupon) {
    return { isValid: false, error: "Cupom não encontrado." };
  }

  if (!coupon.isActive) {
    return { isValid: false, error: "Este cupom está inativo." };
  }

  if (coupon.expirationDate && new Date(coupon.expirationDate) < new Date()) {
    return { isValid: false, error: "Este cupom expirou." };
  }

  if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
    return { isValid: false, error: "Limite de uso do cupom atingido." };
  }

  return { isValid: true, coupon };
};

export const incrementCouponUsage = async (couponId: string, transactionAmount: number = 0) => {
  if (!db) return;
  const couponRef = doc(db, "coupons", couponId);
  const snap = await getDoc(couponRef);
  if (snap.exists()) {
    const data = snap.data() as Coupon;
    const current = data.currentUses || 0;

    let updates: any = { currentUses: current + 1 };

    // Calculate commission if it's a partnership coupon
    if (data.partnership) {
      let commission = 0;
      if (data.partnership.commissionType === 'percentage') {
        // commissionValue is percentage (e.g., 10 for 10%)
        commission = transactionAmount * (data.partnership.commissionValue / 100);
      } else {
        // commissionValue is fixed amount (e.g., 50 for R$ 50)
        commission = data.partnership.commissionValue;
      }

      const currentAccumulated = data.partnership.accumulatedCommission || 0;
      updates['partnership.accumulatedCommission'] = currentAccumulated + commission;
    }

    await updateDoc(couponRef, updates);
  }
};

export const resetPartnerCommission = async (couponId: string) => {
  if (!db) return;
  const couponRef = doc(db, "coupons", couponId);
  const snap = await getDoc(couponRef);
  if (snap.exists()) {
    const data = snap.data();
    if (data.partnership) {
      await updateDoc(couponRef, {
        'partnership.accumulatedCommission': 0
      });
    }
  }
};

// --- Account Deletion Service ---

const deleteCollectionBatch = async (path: string, batchSize: number = 450) => {
  if (!db) return;
  const ref = collection(db, path);
  const snapshot = await getDocs(ref);

  if (snapshot.empty) return;

  let batch = writeBatch(db);
  let count = 0;

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    count++;
    if (count >= batchSize) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }
};

export const deleteUserAccount = async (userId: string) => {
  if (!db) return;

  try {
    // 1. Delete all subcollections
    const subcollections = [
      "transactions",
      "creditCardTransactions",
      "members",
      "goals",
      "budgets",
      "investments",
      "reminders",
      "accounts",
      "notifications",
      "auditLogs"
    ];

    for (const sub of subcollections) {
      await deleteCollectionBatch(`users/${userId}/${sub}`);
    }

    // 2. Delete the user document itself
    const userRef = doc(db, "users", userId);
    await deleteDoc(userRef);

    console.log(`User account ${userId} fully deleted from Firestore.`);
  } catch (error) {
    console.error("Error deleting user account from Firestore:", error);
    throw error;
  }
};

// --- Category Migration Service ---

const translateCategoryMigration = (category: string | undefined | null): string => {
  if (!category) return 'Outros';

  const map: Record<string, string> = {
    'Salary': 'Salário',
    'Retirement': 'Aposentadoria',
    'Government aid': 'Benefícios',
    'Non-recurring income': 'Rendimentos extras',
    'Loans': 'Empréstimos',
    'Interests charged': 'Juros',
    'Fixed income': 'Renda fixa',
    'Variable income': 'Renda variável',
    'Proceeds interests and dividends': 'Juros e dividendos',
    'Same person transfer - PIX': 'Transf. própria',
    'Transfer - PIX': 'Transf. Pix',
    'Credit card payment': 'Cartão de crédito',
    'Bank slip': 'Boleto',
    'Debt card': 'Cartão débito',
    'Alimony': 'Pensão',
    'Telecommunications': 'Telecom',
    'Internet': 'Internet',
    'Mobile': 'Celular',
    'School': 'Escola',
    'University': 'Universidade',
    'Gyms and fitness centers': 'Academia',
    'Wellness': 'Bem-estar',
    'Cinema, theater and concerts': 'Cinema / shows',
    'Online shopping': 'Online',
    'Electronics': 'Eletrônicos',
    'Clothing': 'Roupas',
    'Video streaming': 'Streaming vídeo',
    'Music streaming': 'Streaming música',
    'N/A': 'Supermercado',
    'Eating out': 'Restaurante',
    'Food delivery': 'Delivery',
    'Airport and airlines': 'Passagens aéreas',
    'Accommodation': 'Hospedagem',
    'Lottery': 'Loterias',
    'Income taxes': 'IR',
    'Account fees': 'Tarifas conta',
    'Rent': 'Aluguel',
    'Electricity': 'Luz',
    'Water': 'Água',
    'Pharmacy': 'Farmácia',
    'Hospital clinics and labs': 'Clínicas / exames',
    'Taxi and ride-hailing': 'Táxi / apps',
    'Public transportation': 'Ônibus / metrô',
    'Car rental': 'Aluguel carro',
    'Bicycle': 'Bicicleta',
    'Gas stations': 'Combustível',
    'Parking': 'Estacionamento',
    'Health insurance': 'Plano de saúde',
    'Vehicle insurance': 'Seguro auto',
    'Donation': 'Doações',
    'Donations': 'Doações',
    'Leisure': 'Lazer',
    'Entertainment': 'Lazer',
    'Same person transfer': 'Transf. própria',
    'Digital services': 'Serviços digitais',
    'Transfer - TED': 'Transferência TED',
    'Third party transfer - PIX': 'Transf. Terceiros Pix',
    'Investments': 'Investimentos',
    // Credit Card Specifics
    'Shopping': 'Compras',
    'Credit card fees': 'Tarifas cartão',
    'Groceries': 'Supermercado',
    'Accomodation': 'Hospedagem',
    'Insurance': 'Seguros',
    'Entrepreneurial activities': 'Empreendedorismo',
    'Tolls and in vehicle payment': 'Pedágios',
    'Services': 'Serviços',
    'Mileage programs': 'Milhas',
    'Bookstore': 'Livraria',
    'Pet supplies and vet': 'Pet Shop / Vet',
    'Houseware': 'Casa e Decoração',
    'Transfers': 'Transferências',
    'Gambling': 'Jogos / Apostas',
    'Tickets': 'Ingressos',
    'Vehicle maintenance': 'Manutenção Auto',
    'Dentist': 'Dentista',
    'Transfer - Foreign Exchange': 'Câmbio',
  };

  // Strict match first, then fallback to original if not found
  return map[category] || category;
};

export const fixCategoriesForUser = async (userId: string) => {
  if (!db) return 0;
  console.log(`[Migration] Starting category fix for user ${userId}...`);
  let updatedCount = 0;
  let batch = writeBatch(db);
  let opCount = 0;

  const collections = ["transactions", "creditCardTransactions"];

  for (const colName of collections) {
    const ref = collection(db, "users", userId, colName);
    const snap = await getDocs(ref);

    for (const doc of snap.docs) {
      const data = doc.data();
      const currentCat = data.category as string;
      const newCat = translateCategoryMigration(currentCat);

      if (newCat !== currentCat) {
        batch.update(doc.ref, { category: newCat });
        updatedCount++;
        opCount++;

        if (opCount >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        }
      }
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }

  console.log(`[Migration] User ${userId}: Updated ${updatedCount} transactions.`);
  return updatedCount;
};

// --- Feedback Services ---
export interface Feedback {
  id?: string;
  type: 'bug' | 'suggestion';
  message: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  status: 'pending' | 'reviewed' | 'planned' | 'in_progress' | 'completed' | 'resolved' | 'dismissed';
  createdAt: string;
  resolvedAt?: string;
  adminNotes?: string;
  votes?: FeedbackVote[];
}

export interface FeedbackVote {
  userId: string;
  userAvatar?: string;
  userName?: string;
}

export const addFeedback = async (feedback: Omit<Feedback, 'id'>) => {
  if (!db) return "";
  const feedbackRef = collection(db, "feedbacks");
  const docRef = await addDoc(feedbackRef, feedback);
  return docRef.id;
};

export const updateFeedback = async (feedback: Feedback) => {
  if (!db) return;
  if (!feedback.id) return;
  const feedbackRef = doc(db, "feedbacks", feedback.id);
  const { id, ...data } = feedback;
  await updateDoc(feedbackRef, data);
};

export const deleteFeedback = async (feedbackId: string) => {
  if (!db) return;
  const feedbackRef = doc(db, "feedbacks", feedbackId);
  await deleteDoc(feedbackRef);
};

export const toggleFeedbackVote = async (feedbackId: string, user: { id: string, name?: string, avatarUrl?: string }) => {
  if (!db) return;
  const feedbackRef = doc(db, "feedbacks", feedbackId);

  try {
    await runTransaction(db, async (transaction) => {
      const sfDoc = await transaction.get(feedbackRef);
      if (!sfDoc.exists()) {
        throw "Document does not exist!";
      }

      const data = sfDoc.data() as Feedback;
      const votes = data.votes || [];
      const hasVoted = votes.some(v => v.userId === user.id);

      let newVotes;
      if (hasVoted) {
        newVotes = votes.filter(v => v.userId !== user.id);
      } else {
        // Add vote
        newVotes = [...votes, {
          userId: user.id,
          userAvatar: (user.avatarUrl || user.name?.slice(0, 2).toUpperCase()) ?? '?',
          userName: user.name
        }];
      }

      transaction.update(feedbackRef, { votes: newVotes });
    });
  } catch (e) {
    console.error("Transaction failed: ", e);
  }
};

export const getFeedbacks = async (): Promise<Feedback[]> => {
  if (!db) return [];
  const feedbackRef = collection(db, "feedbacks");
  const q = query(feedbackRef, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Feedback));
};

export const listenToFeedbacks = (callback: (feedbacks: Feedback[]) => void) => {
  if (!db) return () => { };
  const feedbackRef = collection(db, "feedbacks");

  return onSnapshot(feedbackRef, (snapshot) => {
    const feedbacks: Feedback[] = [];
    snapshot.forEach(docSnap => {
      feedbacks.push({ id: docSnap.id, ...docSnap.data() } as Feedback);
    });
    // Sort by createdAt desc
    feedbacks.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    callback(feedbacks);
  });
};

// --- AI Chat History Services ---
export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content?: string;
  type: 'text' | 'transaction_confirm';
  transactionData?: any;
  isConfirmed?: boolean;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  date: string;
  preview: string;
  messages: ChatMessage[];
}

export const saveChatHistory = async (userId: string, sessions: ChatSession[]) => {
  if (!db) return;
  try {
    const chatRef = doc(db, "users", userId, "chatHistory", "sessions");
    await setDoc(chatRef, { sessions, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Error saving chat history:", error);
  }
};

export const getChatHistory = async (userId: string): Promise<ChatSession[]> => {
  if (!db) return [];
  try {
    const chatRef = doc(db, "users", userId, "chatHistory", "sessions");
    const snap = await getDoc(chatRef);
    if (snap.exists()) {
      const data = snap.data();
      return (data.sessions || []) as ChatSession[];
    }
    return [];
  } catch (error) {
    console.error("Error getting chat history:", error);
    return [];
  }
};

export const listenToChatHistory = (userId: string, callback: (sessions: ChatSession[]) => void) => {
  if (!db) return () => { };
  const chatRef = doc(db, "users", userId, "chatHistory", "sessions");

  return onSnapshot(chatRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      callback((data.sessions || []) as ChatSession[]);
    } else {
      callback([]);
    }
  }, (error) => {
    console.error("Error listening to chat history:", error);
    callback([]);
  });
};

export const clearChatHistory = async (userId: string) => {
  if (!db) return;
  try {
    const chatRef = doc(db, "users", userId, "chatHistory", "sessions");
    await deleteDoc(chatRef);
  } catch (error) {
    console.error("Error clearing chat history:", error);
  }
};

// --- PromoPopup Services ---
export const addPromoPopup = async (userId: string, popup: Omit<PromoPopup, 'id'>) => {
  if (!db) return "";
  const popupRef = collection(db, "users", userId, "promoPopups");
  const docRef = await addDoc(popupRef, popup);
  return docRef.id;
};

export const dismissPromoPopup = async (userId: string, popupId: string) => {
  if (!db) return;
  const popupRef = doc(db, "users", userId, "promoPopups", popupId);
  await updateDoc(popupRef, { dismissed: true });
};

export const deletePromoPopup = async (userId: string, popupId: string) => {
  if (!db) return;
  const popupRef = doc(db, "users", userId, "promoPopups", popupId);
  await deleteDoc(popupRef);
};

export const listenToPromoPopups = (userId: string, callback: (popups: PromoPopup[]) => void) => {
  if (!db) return () => { };
  const popupRef = collection(db, "users", userId, "promoPopups");

  return onSnapshot(popupRef, (snapshot) => {
    const popups: PromoPopup[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      // Only include non-dismissed and non-expired popups
      if (!data.dismissed) {
        if (data.expiresAt) {
          const expiry = new Date(data.expiresAt);
          if (expiry > new Date()) {
            popups.push({ id: docSnap.id, ...data } as PromoPopup);
          }
        } else {
          popups.push({ id: docSnap.id, ...data } as PromoPopup);
        }
      }
    });
    // Sort by createdAt desc to show newest first
    popups.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    callback(popups);
  });
};

// --- Sync Status Services ---
export interface SyncStatus {
  state: 'idle' | 'pending' | 'in_progress' | 'success' | 'error';
  message: string;
  details?: string;
  lastUpdated: string;
}

export const listenToSyncStatus = (userId: string, callback: (status: SyncStatus | null) => void) => {
  if (!db) return () => { };
  // Listen to the singleton document "pluggy" in "sync_status" collection
  const statusRef = doc(db, "users", userId, "sync_status", "pluggy");

  return onSnapshot(statusRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as SyncStatus);
    } else {
      callback(null);
    }
  });
};

// --- Sync Jobs (for tracking individual sync operations) ---
export interface SyncJob {
  id: string;
  itemId: string;
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
  creditTransactionId?: string;
  creditRefunded?: boolean;
  progress?: {
    step: string;
    current: number;
    total: number;
  };
  message?: string;
  lastError?: string;
  attempts?: number;
  createdAt?: any;
  updatedAt?: any;
  completedAt?: any;
  failedAt?: any;
}

/**
 * Listen to active sync jobs for a user
 * Returns jobs that are pending, processing, retrying, or recently failed
 */
export const listenToSyncJobs = (userId: string, callback: (jobs: SyncJob[]) => void) => {
  if (!db) return () => { };

  const jobsRef = collection(db, "users", userId, "sync_jobs");
  // Query for active jobs - we need 'completed' to detect the status CHANGE from processing->completed
  // The frontend filters out old jobs to prevent phantom toasts on page load
  const q = query(
    jobsRef,
    where('status', 'in', ['pending', 'processing', 'retrying', 'completed']),
    orderBy('createdAt', 'desc'),
    limit(5) // Reduced limit to minimize old job processing
  );

  return onSnapshot(q, (snapshot) => {
    const jobs: SyncJob[] = [];
    snapshot.forEach((doc) => {
      jobs.push({ id: doc.id, ...doc.data() } as SyncJob);
    });
    callback(jobs);
  }, (error) => {
    console.error('Error listening to sync jobs:', error);
    callback([]);
  });
};

/**
 * Get sync job by itemId
 */
export const getSyncJobByItemId = async (userId: string, itemId: string): Promise<SyncJob | null> => {
  if (!db) return null;
  try {
    const jobsRef = collection(db, "users", userId, "sync_jobs");
    const q = query(
      jobsRef,
      where('itemId', '==', itemId),
      where('status', 'in', ['pending', 'processing', 'retrying']),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as SyncJob;
    }
    return null;
  } catch (error) {
    console.error('Error getting sync job:', error);
    return null;
  }
};

// --- System Settings ---
export const getSystemSettings = async (): Promise<import("../types").SystemSettings> => {
  if (!db) return {};
  try {
    const docRef = doc(db, "system", "settings");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as import("../types").SystemSettings;
    }
    return {};
  } catch (error) {
    console.error("Error fetching system settings:", error);
    return {};
  }
};

export const updateSystemSettings = async (settings: Partial<import("../types").SystemSettings>) => {
  if (!db) return;
  try {
    const docRef = doc(db, "system", "settings");
    await setDoc(docRef, settings, { merge: true });
  } catch (error) {
    console.error("Error updating system settings:", error);
    throw error;
  }
};

// --- Admin Helper Services ---
export const saveEmailDraft = async (userId: string, draftData: any) => {
  if (!db) return;
  const draftRef = doc(db, "users", userId, "settings", "emailDraft");
  await setDoc(draftRef, {
    ...draftData,
    updatedAt: new Date().toISOString()
  });
};

export const getEmailDraft = async (userId: string) => {
  if (!db) return null;
  try {
    const draftRef = doc(db, "users", userId, "settings", "emailDraft");
    const snap = await getDoc(draftRef);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (error) {
    console.error("Error fetching email draft:", error);
    return null;
  }
};

// --- Helper for Admin Dashboard (Bank Connections) ---
export const getAllConnectedAccounts = async (): Promise<any[]> => {
  if (!db) return [];
  try {
    // Assuming 'items' is the subcollection name for Pluggy connections
    // If it's different (e.g. 'connectedAccounts'), this needs to be updated.
    // Based on API /api/pluggy/db-items, 'items' is the most likely name.
    const itemsQuery = query(collectionGroup(db, "items"));
    const snapshot = await getDocs(itemsQuery);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      userId: doc.ref.parent.parent?.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error fetching all connected accounts:", error);
    return [];
  }
};

// --- Support Services ---

export interface SupportMessage {
  id?: string;
  text: string;
  senderId: string;
  senderType: 'user' | 'admin';
  createdAt: string;
  read?: boolean;
}

export interface SupportTicket {
  id?: string;
  userId: string;
  userEmail: string;
  userName?: string;
  status: 'open' | 'closed' | 'in_progress';
  createdAt: string;
  lastMessageAt: string;
  unreadCount?: number;
  assignedTo?: string; // Admin ID
  assignedByName?: string; // Admin Name
}

export const createSupportTicket = async (userId: string, userEmail: string, userName: string) => {
  if (!db) return null;
  const ticketsRef = collection(db, "support_tickets");

  // Check if open ticket exists
  const q = query(ticketsRef, where("userId", "==", userId), where("status", "in", ["open", "in_progress"]), limit(1));
  const snap = await getDocs(q);

  if (!snap.empty) {
    return snap.docs[0].id;
  }

  const newTicket: SupportTicket = {
    userId,
    userEmail,
    userName,
    status: 'open',
    createdAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
    unreadCount: 0
  };

  const docRef = await addDoc(ticketsRef, newTicket);
  return docRef.id;
};

export const sendSupportMessage = async (ticketId: string, message: Omit<SupportMessage, 'id'>) => {
  if (!db) return;
  const ticketRef = doc(db, "support_tickets", ticketId);
  const messagesRef = collection(ticketRef, "messages");

  await addDoc(messagesRef, {
    ...message,
    read: false
  });

  await updateDoc(ticketRef, {
    lastMessageAt: message.createdAt
  });
};

export const markMessagesAsRead = async (ticketId: string, role: 'user' | 'admin') => {
  if (!db) return;
  const messagesRef = collection(db, "support_tickets", ticketId, "messages");
  // Query messages not read and SENT BY THE OTHER PARTY
  // If I am user, I want to mark messages sent by 'admin' as read
  // If I am admin, I want to mark messages sent by 'user' as read
  const senderTypeTarget = role === 'user' ? 'admin' : 'user';

  const q = query(messagesRef, where("senderType", "==", senderTypeTarget), where("read", "==", false));
  const snap = await getDocs(q);

  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.docs.forEach(doc => {
    batch.update(doc.ref, { read: true });
  });
  await batch.commit();
};

export const listenToTicketMessages = (ticketId: string, callback: (messages: SupportMessage[]) => void) => {
  if (!db) return () => { };
  const messagesRef = collection(db, "support_tickets", ticketId, "messages");
  const q = query(messagesRef, orderBy("createdAt", "asc"));

  return onSnapshot(q, (snapshot) => {
    const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SupportMessage));
    callback(msgs);
  });
};

export const getUserActiveTicket = (userId: string, callback: (ticketId: string | null) => void) => {
  if (!db) return () => { };
  const ticketsRef = collection(db, "support_tickets");
  // Check for open OR in_progress
  const q = query(ticketsRef, where("userId", "==", userId), where("status", "in", ["open", "in_progress"]), limit(1));
  return onSnapshot(q, (snap) => {
    if (!snap.empty) {
      callback(snap.docs[0].id);
    } else {
      callback(null);
    }
  });
}

export const listenToAllOpenTickets = (callback: (tickets: SupportTicket[]) => void) => {
  if (!db) return () => { };
  const ticketsRef = collection(db, "support_tickets");
  // Listen to both open and in_progress
  // Removed orderBy to avoid index requirement. Sorting client-side.
  const q = query(ticketsRef, where("status", "in", ["open", "in_progress"]));
  return onSnapshot(q, (snap) => {
    const tickets = snap.docs.map(d => ({ id: d.id, ...d.data() } as SupportTicket));
    // Client-side sort
    tickets.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    callback(tickets);
  });
};

export const closeSupportTicket = async (ticketId: string) => {
  if (!db) return;
  const ticketRef = doc(db, "support_tickets", ticketId);
  await updateDoc(ticketRef, { status: 'closed' });
};

export const acceptSupportTicket = async (ticketId: string, adminId: string, adminName: string) => {
  if (!db) return;
  const ticketRef = doc(db, "support_tickets", ticketId);
  await updateDoc(ticketRef, {
    status: 'in_progress',
    assignedTo: adminId,
    assignedByName: adminName
  });
};

export const listenToTicket = (ticketId: string, callback: (ticket: SupportTicket | null) => void) => {
  if (!db) return () => { };
  const ticketRef = doc(db, "support_tickets", ticketId);
  return onSnapshot(ticketRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() } as SupportTicket);
    } else {
      callback(null);
    }
  });
};

