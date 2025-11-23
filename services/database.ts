
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
    orderBy
} from "firebase/firestore";
import { database as db } from "./firebase";
import { Transaction, Reminder, User, Member, FamilyGoal, Investment } from "../types";

// --- User Services ---
export const updateUserProfile = async (userId: string, data: Partial<User>) => {
  if(!db) return;
  const userRef = doc(db, "users", userId);
  // Merge true para não sobrescrever outros campos
  await setDoc(userRef, { profile: data }, { merge: true });
};

export const getUserProfile = async (userId: string): Promise<Partial<User> | null> => {
  if(!db) return null;
  try {
    const userRef = doc(db, "users", userId);
    const snap = await getDoc(userRef);
    
    if (snap.exists()) {
        return snap.data().profile as Partial<User>;
    }
    return null;
  } catch (error) {
    console.error("Erro ao buscar perfil:", error);
    throw error;
  }
};

export const listenToUserProfile = (userId: string, callback: (data: Partial<User>) => void) => {
    if(!db) return () => {};
    const userRef = doc(db, "users", userId);
    
    return onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
            callback(doc.data().profile || {});
        } else {
            callback({});
        }
    });
};

// --- Members Services ---
export const addMember = async (userId: string, member: Omit<Member, 'id'>) => {
  if(!db) return "";
  const membersRef = collection(db, "users", userId, "members");
  const docRef = await addDoc(membersRef, member);
  
  // Opcional: Atualizar o documento com o próprio ID se necessário, 
  // mas o Firestore já dá o ID. O App assume que o objeto retornado tem ID.
  return docRef.id;
};

export const listenToMembers = (userId: string, callback: (members: Member[]) => void) => {
  if(!db) return () => {};
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
  if(!db) return;
  const memberRef = doc(db, "users", userId, "members", memberId);
  await deleteDoc(memberRef);
};

export const restoreMember = async (userId: string, member: Member) => {
  if(!db) return;
  const memberRef = doc(db, "users", userId, "members", member.id);
  const { id, ...data } = member;
  await setDoc(memberRef, data);
};

// --- Family Goals Services ---
export const addFamilyGoal = async (userId: string, goal: Omit<FamilyGoal, 'id'>) => {
    if(!db) return;
    const goalsRef = collection(db, "users", userId, "goals");
    await addDoc(goalsRef, goal);
};

export const updateFamilyGoal = async (userId: string, goal: FamilyGoal) => {
    if(!db) return;
    const goalRef = doc(db, "users", userId, "goals", goal.id);
    const { id, ...data } = goal; 
    await updateDoc(goalRef, data);
};

export const deleteFamilyGoal = async (userId: string, goalId: string) => {
    if(!db) return;
    const goalRef = doc(db, "users", userId, "goals", goalId);
    await deleteDoc(goalRef);
};

export const listenToGoals = (userId: string, callback: (goals: FamilyGoal[]) => void) => {
    if(!db) return () => {};
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
export const addTransaction = async (userId: string, transaction: Omit<Transaction, 'id'>) => {
  if(!db) return "";
  const txRef = collection(db, "users", userId, "transactions");
  const docRef = await addDoc(txRef, transaction);
  return docRef.id;
};

export const updateTransaction = async (userId: string, transaction: Transaction) => {
  if(!db) return;
  const txRef = doc(db, "users", userId, "transactions", transaction.id);
  const { id, ...data } = transaction;
  await updateDoc(txRef, data);
};

export const deleteTransaction = async (userId: string, transactionId: string) => {
  if(!db) return;
  const txRef = doc(db, "users", userId, "transactions", transactionId);
  await deleteDoc(txRef);
};

export const restoreTransaction = async (userId: string, transaction: Transaction) => {
   if(!db) return;
   // Ao restaurar, usamos o ID original se possível, ou criamos novo
   // SetDoc permite definir o ID manualmente
   const txRef = doc(db, "users", userId, "transactions", transaction.id);
   const { id, ...data } = transaction;
   await setDoc(txRef, data);
};

export const listenToTransactions = (userId: string, callback: (transactions: Transaction[]) => void) => {
  if(!db) return () => {};
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
  if(!db) return "";
  const remRef = collection(db, "users", userId, "reminders");
  const docRef = await addDoc(remRef, reminder);
  return docRef.id;
};

export const deleteReminder = async (userId: string, reminderId: string) => {
  if(!db) return;
  const remRef = doc(db, "users", userId, "reminders", reminderId);
  await deleteDoc(remRef);
};

export const updateReminder = async (userId: string, reminder: Reminder) => {
    if(!db) return;
    const remRef = doc(db, "users", userId, "reminders", reminder.id);
    const { id, ...data } = reminder;
    await updateDoc(remRef, data);
};

export const listenToReminders = (userId: string, callback: (reminders: Reminder[]) => void) => {
  if(!db) return () => {};
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
  if(!db) return "";
  const invRef = collection(db, "users", userId, "investments");
  const docRef = await addDoc(invRef, investment);
  return docRef.id;
};

export const updateInvestment = async (userId: string, investment: Investment) => {
  if(!db) return;
  const invRef = doc(db, "users", userId, "investments", investment.id);
  const { id, ...data } = investment;
  await updateDoc(invRef, data);
};

export const deleteInvestment = async (userId: string, investmentId: string) => {
  if(!db) return;
  const invRef = doc(db, "users", userId, "investments", investmentId);
  await deleteDoc(invRef);
};

export const listenToInvestments = (userId: string, callback: (investments: Investment[]) => void) => {
  if(!db) return () => {};
  const invRef = collection(db, "users", userId, "investments");

  return onSnapshot(invRef, (snapshot) => {
      const investments: Investment[] = [];
      snapshot.forEach(doc => {
          investments.push({ id: doc.id, ...doc.data() } as Investment);
      });
      callback(investments);
  });
};
