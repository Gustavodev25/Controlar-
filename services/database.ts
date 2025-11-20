
import { Transaction, Reminder, User, Member, FamilyGoal } from "../types";

const DB_KEY = 'financas_ai_db';

// --- Helpers for LocalStorage ---
const getDB = () => {
  try {
    const str = localStorage.getItem(DB_KEY);
    return str ? JSON.parse(str) : { users: {} };
  } catch (e) {
    console.error("Error reading DB", e);
    return { users: {} };
  }
};

const saveDB = (db: any) => {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    // Dispatch event to simulate realtime updates across components
    window.dispatchEvent(new Event('db-change'));
  } catch (e) {
    console.error("Error saving DB", e);
  }
};

// --- Realtime Subscription System ---
const listeners: Function[] = [];

if (typeof window !== 'undefined') {
    window.addEventListener('db-change', () => {
       listeners.forEach(cb => cb());
    });
}

const subscribe = (callback: () => void) => {
    listeners.push(callback);
    return () => {
        const idx = listeners.indexOf(callback);
        if(idx > -1) listeners.splice(idx, 1);
    }
}

// --- User Services ---
export const updateUserProfile = async (userId: string, data: Partial<User>) => {
  const db = getDB();
  if (!db.users) db.users = {};
  if (!db.users[userId]) db.users[userId] = {};
  
  db.users[userId].profile = { ...(db.users[userId].profile || {}), ...data };
  saveDB(db);
};

export const getUserProfile = async (userId: string): Promise<Partial<User> | null> => {
  const db = getDB();
  return db.users?.[userId]?.profile || null;
};

export const listenToUserProfile = (userId: string, callback: (data: Partial<User>) => void) => {
    const handler = () => {
        const db = getDB();
        callback(db.users?.[userId]?.profile || {});
    };
    handler(); // Initial call
    return subscribe(handler);
};

// --- Members Services ---
export const addMember = async (userId: string, member: Omit<Member, 'id'>) => {
  const db = getDB();
  if (!db.users[userId].members) db.users[userId].members = {};
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  db.users[userId].members[id] = { id, ...member };
  saveDB(db);
  return id;
};

export const listenToMembers = (userId: string, callback: (members: Member[]) => void) => {
  const handler = () => {
    const db = getDB();
    const memMap = db.users?.[userId]?.members || {};
    const list = Object.values(memMap) as Member[];
    callback(list);
  };
  handler();
  return subscribe(handler);
};

// --- Family Goals Services ---
export const addFamilyGoal = async (userId: string, goal: Omit<FamilyGoal, 'id'>) => {
    const db = getDB();
    if (!db.users[userId].goals) db.users[userId].goals = {};
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    db.users[userId].goals[id] = { id, ...goal };
    saveDB(db);
};

export const updateFamilyGoal = async (userId: string, goal: FamilyGoal) => {
    const db = getDB();
    if (db.users[userId]?.goals?.[goal.id]) {
        db.users[userId].goals[goal.id] = goal;
        saveDB(db);
    }
};

export const deleteFamilyGoal = async (userId: string, goalId: string) => {
    const db = getDB();
    if (db.users[userId]?.goals?.[goalId]) {
        delete db.users[userId].goals[goalId];
        saveDB(db);
    }
};

export const listenToGoals = (userId: string, callback: (goals: FamilyGoal[]) => void) => {
    const handler = () => {
        const db = getDB();
        const map = db.users?.[userId]?.goals || {};
        callback(Object.values(map) as FamilyGoal[]);
    };
    handler();
    return subscribe(handler);
}

// --- Transactions Services ---
export const addTransaction = async (userId: string, transaction: Omit<Transaction, 'id'>) => {
  const db = getDB();
  if (!db.users) db.users = {};
  if (!db.users[userId]) db.users[userId] = {};
  if (!db.users[userId].transactions) db.users[userId].transactions = {};
  
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  db.users[userId].transactions[id] = { id, ...transaction };
  saveDB(db);
  return id;
};

export const deleteTransaction = async (userId: string, transactionId: string) => {
  const db = getDB();
  if (db.users?.[userId]?.transactions?.[transactionId]) {
      delete db.users[userId].transactions[transactionId];
      saveDB(db);
  }
};

export const restoreTransaction = async (userId: string, transaction: Transaction) => {
   const db = getDB();
   if (!db.users) db.users = {};
   if (!db.users[userId]) db.users[userId] = {};
   if (!db.users[userId].transactions) db.users[userId].transactions = {};
   
   db.users[userId].transactions[transaction.id] = transaction;
   saveDB(db);
};

export const listenToTransactions = (userId: string, callback: (transactions: Transaction[]) => void) => {
  const handler = () => {
    const db = getDB();
    const txMap = db.users?.[userId]?.transactions || {};
    const formatted: Transaction[] = Object.values(txMap);
    // Sort by date desc
    formatted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    callback(formatted);
  };
  
  handler();
  return subscribe(handler);
};

// --- Reminders Services ---
export const addReminder = async (userId: string, reminder: Omit<Reminder, 'id'>) => {
  const db = getDB();
  if (!db.users) db.users = {};
  if (!db.users[userId]) db.users[userId] = {};
  if (!db.users[userId].reminders) db.users[userId].reminders = {};
  
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  db.users[userId].reminders[id] = { id, ...reminder };
  saveDB(db);
  return id;
};

export const deleteReminder = async (userId: string, reminderId: string) => {
  const db = getDB();
  if (db.users?.[userId]?.reminders?.[reminderId]) {
      delete db.users[userId].reminders[reminderId];
      saveDB(db);
  }
};

export const updateReminder = async (userId: string, reminder: Reminder) => {
    const db = getDB();
    if (db.users?.[userId]?.reminders?.[reminder.id]) {
        db.users[userId].reminders[reminder.id] = reminder;
        saveDB(db);
    }
};

export const listenToReminders = (userId: string, callback: (reminders: Reminder[]) => void) => {
  const handler = () => {
    const db = getDB();
    const remMap = db.users?.[userId]?.reminders || {};
    const formatted: Reminder[] = Object.values(remMap);
    callback(formatted);
  };
  
  handler();
  return subscribe(handler);
};
