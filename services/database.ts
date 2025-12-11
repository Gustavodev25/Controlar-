
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
  writeBatch
} from "firebase/firestore";
import { database as db } from "./firebase";
import { Transaction, Reminder, User, Member, FamilyGoal, Investment, Budget, WaitlistEntry, ConnectedAccount, Coupon } from "../types";
import { AppNotification } from "../types";


// --- User Services ---
export const updateUserProfile = async (userId: string, data: Partial<User>) => {
  if (!db) return;
  const userRef = doc(db, "users", userId);

  // Sanitize data: remove keys with undefined values
  const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key as keyof User] = value;
    }
    return acc;
  }, {} as Partial<User>);

  // Merge true para não sobrescrever outros campos
  await setDoc(userRef, { profile: cleanData }, { merge: true });
};

export const getUserProfile = async (userId: string): Promise<Partial<User> | null> => {
  if (!db) return null;
  try {
    const userRef = doc(db, "users", userId);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data = snap.data();
      const profile = { ...(data.profile as Partial<User> || {}) };

      console.log('[DB getUserProfile] Raw Firebase data:', {
        hasProfile: !!data.profile,
        profileIsAdmin: data.profile?.isAdmin,
        rootIsAdmin: data.isAdmin,
        hasRootSubscription: !!data.subscription,
        userId
      });

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

      console.log('[DB getUserProfile] Final profile.isAdmin:', profile.isAdmin);
      console.log('[DB getUserProfile] Final profile.subscription:', profile.subscription);

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

      // Construct a user object
      return {
        id: doc.id,
        name: profile.name || data.name || 'Usuário',
        email: profile.email || data.email || '',
        // Include other necessary fields - use merged subscription
        subscription: subscription,
        isAdmin: data.isAdmin === true || profile.isAdmin === true,
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

      console.log('[DB listenToUserProfile] Raw data:', {
        hasProfile: !!data.profile,
        profileIsAdmin: data.profile?.isAdmin,
        rootIsAdmin: data.isAdmin,
        hasRootSubscription: !!data.subscription,
        userId
      });

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

      console.log('[DB listenToUserProfile] Returning profile with isAdmin:', profile.isAdmin);
      console.log('[DB listenToUserProfile] Returning profile with subscription:', profile.subscription);

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
    console.log("Buscando waitlist no Firebase...");
    const waitlistRef = collection(db, "waitlist");

    // Primeiro tentamos sem ordenação para ver se o problema é o índice
    const snapshot = await getDocs(waitlistRef);

    console.log("Snapshot recebido, total de docs:", snapshot.size);

    const entries = snapshot.docs.map(doc => {
      const data = doc.data();
      console.log("Documento:", doc.id, data);
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

    console.log("Entries processados e ordenados:", entries);
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

export const listenToTransactions = (userId: string, callback: (transactions: Transaction[]) => void) => {
  if (!db) return () => { };
  const txRef = collection(db, "users", userId, "transactions");
  // Ordenação por data descendente idealmente deve ser feita na query, 
  // mas requer índices compostos no Firestore às vezes. Faremos no cliente por simplicidade.

  return onSnapshot(txRef, (snapshot) => {
    const transactions: Transaction[] = [];
    snapshot.forEach(doc => {
      transactions.push({ id: doc.id, ...doc.data() } as Transaction);
    });
    // Sort client-side
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    callback(transactions);
  });
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
}

export const addCreditCardTransaction = async (userId: string, transaction: Omit<CreditCardTransaction, 'id'>, customId?: string) => {
  if (!db) return "";
  const txRef = collection(db, "users", userId, "creditCardTransactions");

  if (customId) {
    const docRef = doc(txRef, customId);
    const snap = await getDoc(docRef);
    if (snap.exists()) return customId;
    await setDoc(docRef, transaction);
    return customId;
  } else {
    const docRef = await addDoc(txRef, transaction);
    return docRef.id;
  }
};

export const creditCardTransactionExists = async (userId: string, providerId: string) => {
  if (!db) return false;
  try {
    const txRef = collection(db, "users", userId, "creditCardTransactions");
    const q = query(txRef, where("providerId", "==", providerId), limit(1));
    const snap = await getDocs(q);
    return !snap.empty;
  } catch (err) {
    console.error("Error checking credit card transaction:", err);
    return false;
  }
};

export const updateCreditCardTransaction = async (userId: string, transaction: CreditCardTransaction) => {
  if (!db) return;
  const txRef = doc(db, "users", userId, "creditCardTransactions", transaction.id);
  const { id, ...data } = transaction;
  await updateDoc(txRef, data);
};

export const deleteCreditCardTransaction = async (userId: string, transactionId: string) => {
  if (!db) return;
  const txRef = doc(db, "users", userId, "creditCardTransactions", transactionId);
  await deleteDoc(txRef);
};

export const listenToCreditCardTransactions = (userId: string, callback: (transactions: CreditCardTransaction[]) => void) => {
  if (!db) return () => { };
  const txRef = collection(db, "users", userId, "creditCardTransactions");

  return onSnapshot(txRef, (snapshot) => {
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
  await setDoc(docRef, account, { merge: true });
};

export const updateConnectedAccount = async (userId: string, account: ConnectedAccount) => {
  if (!db) return;
  const accountRef = doc(db, "users", userId, "accounts", account.id);
  // We filter out undefined values to avoid errors and only update changed fields
  // However, typically we pass the whole object. Let's just use updateDoc or setDoc with merge.
  // For safety, let's use updateDoc or setDoc with merge.
  const { id, ...data } = account;
  await setDoc(accountRef, data, { merge: true });
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
    logs.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
    callback(logs);
  });
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

export const incrementCouponUsage = async (couponId: string) => {
  if (!db) return;
  const couponRef = doc(db, "coupons", couponId);
  const snap = await getDoc(couponRef);
  if (snap.exists()) {
    const current = snap.data().currentUses || 0;
    await updateDoc(couponRef, { currentUses: current + 1 });
  }
};
