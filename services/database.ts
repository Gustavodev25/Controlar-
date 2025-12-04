
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
import { Transaction, Reminder, User, Member, FamilyGoal, Investment, Budget, WaitlistEntry } from "../types";
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
        userId
      });

      // Priority: profile.isAdmin > root isAdmin (always check root as fallback)
      // IMPORTANT: We need to ALWAYS set isAdmin, even if it's false
      if (profile.isAdmin === undefined || profile.isAdmin === null) {
        profile.isAdmin = data.isAdmin === true; // Force boolean check
      }

      console.log('[DB getUserProfile] Final profile.isAdmin:', profile.isAdmin);

      // If there was no profile at all but we have root isAdmin, still return it
      if (Object.keys(profile).length === 0 && data.isAdmin !== undefined) {
        return { isAdmin: data.isAdmin };
      }

      return profile;
    }
    return null;
  } catch (error) {
    console.error("Erro ao buscar perfil:", error);
    throw error;
  }
};

export const listenToUserProfile = (userId: string, callback: (data: Partial<User>) => void) => {
  if (!db) return () => { };
  const userRef = doc(db, "users", userId);

  return onSnapshot(userRef, (doc) => {
    if (doc.exists()) {
      const data = doc.data();
      const profile = { ...(data.profile as Partial<User> || {}) };

      console.log('[DB listenToUserProfile] Raw data:', {
        hasProfile: !!data.profile,
        profileIsAdmin: data.profile?.isAdmin,
        rootIsAdmin: data.isAdmin,
        userId
      });

      // Priority: profile.isAdmin > root isAdmin (always check root as fallback)
      // IMPORTANT: We need to ALWAYS set isAdmin, even if it's false
      if (profile.isAdmin === undefined || profile.isAdmin === null) {
        profile.isAdmin = data.isAdmin === true; // Force boolean check
      }

      console.log('[DB listenToUserProfile] Returning profile with isAdmin:', profile.isAdmin);

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

    // 1. Check by strict Pluggy ID (globally unique for the provider)
    // If we have a pluggyId, we TRUST it. If it exists, it's a duplicate.
    // If it doesn't exist, it's NEW. We do NOT fall back to fuzzy matching 
    // because that causes false positives (e.g. matching a manual transaction with same amount).
    if (data.pluggyId) {
      const pluggyFilters = [where("pluggyId", "==", data.pluggyId)];
      const pluggySnap = await getDocs(query(txRef, ...pluggyFilters, limit(1)));
      return !pluggySnap.empty;
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
      // If the existing transaction has a pluggyId, we should NOT match it loosely
      // against a manual transaction (unlikely case, but good safety).
      // Actually, if we are here, 'data' (incoming) has NO pluggyId.
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
