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
  getDocs,
  limit
} from "firebase/firestore";
import { database as db } from "./firebase";
import { Subscription } from "../types";

export const addSubscription = async (userId: string, subscription: Omit<Subscription, 'id'>) => {
  if (!db) return "";
  const subRef = collection(db, "users", userId, "subscriptions");
  const docRef = await addDoc(subRef, subscription);
  return docRef.id;
};

export const updateSubscription = async (userId: string, subscription: Subscription) => {
  if (!db) return;
  const subRef = doc(db, "users", userId, "subscriptions", subscription.id);
  const { id, ...data } = subscription;
  await updateDoc(subRef, data);
};

export const deleteSubscription = async (userId: string, subscriptionId: string) => {
  if (!db) return;
  const subRef = doc(db, "users", userId, "subscriptions", subscriptionId);
  await deleteDoc(subRef);
};

export const listenToSubscriptions = (userId: string, callback: (subscriptions: Subscription[]) => void) => {
  if (!db) return () => { };
  const subRef = collection(db, "users", userId, "subscriptions");

  return onSnapshot(subRef, (snapshot) => {
    const subs: Subscription[] = [];
    snapshot.forEach(doc => {
      subs.push({ id: doc.id, ...doc.data() } as Subscription);
    });
    callback(subs);
  });
};

// Helper to detect if a subscription exists by name (case-insensitive)
export const checkSubscriptionExists = async (userId: string, name: string): Promise<boolean> => {
  if (!db) return false;
  const subRef = collection(db, "users", userId, "subscriptions");
  // Firestore doesn't support native case-insensitive queries efficiently without external tools
  // so we fetch all and check in client for this specific use case (assuming low volume of subscriptions)
  const snap = await getDocs(subRef);
  const target = name.toLowerCase();
  return snap.docs.some(doc => {
    const data = doc.data();
    return (data.name || "").toLowerCase() === target;
  });
};
