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
  arrayUnion,
  arrayRemove,
  serverTimestamp
} from "firebase/firestore";
import { database as db } from "./firebase";
import { FamilyGroup, User } from "../types";

export const PLAN_LIMITS = {
  starter: 0,
  pro: 2,
  family: 5
};

// Create or get existing family group for a user
export const initializeFamilyGroup = async (userId: string, plan: 'pro' | 'family'): Promise<string> => {
  if (!db) throw new Error("Database not initialized");

  // Check if user already has a group
  const q = query(collection(db, "families"), where("ownerId", "==", userId));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    return snapshot.docs[0].id;
  }

  // Create new group
  const newGroup: Omit<FamilyGroup, 'id'> = {
    ownerId: userId,
    plan,
    members: [userId], // Owner is the first member
    invites: []
  };

  const docRef = await addDoc(collection(db, "families"), newGroup);
  
  // Update user profile
  const userRef = doc(db, "users", userId);
  await setDoc(userRef, { profile: { familyGroupId: docRef.id, familyRole: 'owner' } }, { merge: true });

  return docRef.id;
};

export const getFamilyGroup = async (groupId: string): Promise<FamilyGroup | null> => {
  if (!db) return null;
  const docRef = doc(db, "families", groupId);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as FamilyGroup;
  }
  return null;
};

export const listenToFamilyGroup = (groupId: string, callback: (group: FamilyGroup | null) => void) => {
  if (!db) return () => {};
  return onSnapshot(doc(db, "families", groupId), (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() } as FamilyGroup);
    } else {
      callback(null);
    }
  }, (error) => {
    console.warn("Listen failed (likely permission or connection):", error);
    callback(null);
  });
};

export const generateInvite = async (groupId: string): Promise<string> => {
  if (!db) throw new Error("Database not initialized");
  
  const group = await getFamilyGroup(groupId);
  if (!group) throw new Error("Group not found");

  const limit = PLAN_LIMITS[group.plan] || 0;
  const usedSlots = group.members.length + group.invites.filter(i => i.status === 'pending').length;

  if (usedSlots >= limit) {
    throw new Error("Limite do plano atingido. Faça upgrade para adicionar mais membros.");
  }

  // Generate simple random token
  const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  const invite = {
    token,
    createdAt: new Date().toISOString(),
    status: 'pending' as const
  };

  const groupRef = doc(db, "families", groupId);
  await updateDoc(groupRef, {
    invites: arrayUnion(invite)
  });

  return token;
};

export const acceptInvite = async (userId: string, token: string): Promise<boolean> => {
  if (!db) throw new Error("Database not initialized");

  // Find group with this pending token
  // Note: querying inside arrays of objects is tricky in Firestore without specific structure or indices.
  // For small scale, we can fetch all families (bad) or store invites in a separate collection (better).
  // BUT, let's optimize: User pastes the link, we can't just search all.
  // We'll change `invites` strategy slightly or just use a root `invites` collection mapping token -> groupId.
  // Let's use a root 'invites' collection for lookup efficiency.
  
  // Actually, for this scale, let's query families where invites contains the token? 
  // Firestore doesn't strictly support "array contains object with field X".
  // Alternative: The user creates the invite, we return the LINK which includes the groupId? 
  // "mysite.com/join?groupId=XYZ&token=ABC". This is much safer and easier.
  // I will assume the UI will handle passing the groupId if I return it, OR I'll implement a lookup.
  
  // Let's do a client-side scan for now if we can't change the URL structure, 
  // BUT better: creating a `invitations` root collection is cleaner.
  
  // Let's refactor `generateInvite` to also create a document in `invitations` collection.
  return false; // Placeholder, will be implemented in the refactored function below.
};

// Refactored Invite Generation with Lookup
export const createInvite = async (groupId: string, email?: string) => {
  if (!db) throw new Error("Database not initialized");
   
  const group = await getFamilyGroup(groupId);
  if (!group) throw new Error("Group not found");

  const limit = PLAN_LIMITS[group.plan] || 0;
  // Count members + pending invites
  // We need to be careful about "ghost" invites. 
  // For now, let's just count active members for the hard limit, 
  // and maybe cap pending invites reasonably.
  
  if (group.members.length >= limit) {
     throw new Error("Limite de membros atingido.");
  }

  const token = Math.random().toString(36).substring(2, 15);
  
  // 1. Add to local array for UI display
  // Sanitize inviteData to remove undefined fields
  const inviteData: any = {
    token,
    createdAt: new Date().toISOString(),
    status: 'pending' as const
  };

  if (email) {
      inviteData.email = email;
  }
  
  const groupRef = doc(db, "families", groupId);
  await updateDoc(groupRef, {
    invites: arrayUnion(inviteData)
  });

  // 2. Create lookup doc (optional but good for validation)
  // For simplicity in this CLI env, I'll skip a separate collection and rely on 
  // the user providing the token. To validate, we might need to ask the user to input the "Family ID" 
  // or we scan. 
  // ACTUALLY, the best "Link" usually contains the ID. 
  // Link: /join-family?id=GROUP_ID&token=TOKEN
  
  return token;
};

export const joinFamily = async (userId: string, groupId: string, token: string) => {
  if (!db) throw new Error("Database not initialized");

  const groupRef = doc(db, "families", groupId);
  const groupSnap = await getDoc(groupRef);
  
  if (!groupSnap.exists()) throw new Error("Família não encontrada.");
  
  const group = groupSnap.data() as FamilyGroup;
  
  // Validate Token
  const validInvite = group.invites?.find(i => i.token === token && i.status === 'pending');
  if (!validInvite) {
    throw new Error("Convite inválido ou expirado.");
  }

  // Check limits again
  const limit = PLAN_LIMITS[group.plan];
  if (group.members.length >= limit) {
     throw new Error("Este grupo familiar já está cheio.");
  }
  
  if (group.members.includes(userId)) {
      throw new Error("Você já faz parte desta família.");
  }

  // Execute Join
  // 1. Update Family Group
  const updatedInvites = group.invites.map(i => 
    i.token === token ? { ...i, status: 'accepted' as const } : i
  );
  
  await updateDoc(groupRef, {
    members: arrayUnion(userId),
    invites: updatedInvites
  });

  // 2. Update User Profile
  const userRef = doc(db, "users", userId);
  await setDoc(userRef, { 
      profile: { 
          familyGroupId: groupId, 
          familyRole: 'member',
          // Inherit plan status conceptually, though subscription might be separate
          // For now, we just link them. The app logic should check familyGroupId to unlock features.
      } 
  }, { merge: true });
};

export const removeMember = async (groupId: string, memberId: string) => {
    if (!db) return;
    const groupRef = doc(db, "families", groupId);
    
    await updateDoc(groupRef, {
        members: arrayRemove(memberId)
    });
    
    // Unlink user
    const userRef = doc(db, "users", memberId);
    await setDoc(userRef, { 
        profile: { 
            familyGroupId: null, 
            familyRole: null 
        } 
    }, { merge: true });
};

export const cancelInvite = async (groupId: string, token: string) => {
    if (!db) return;
    const groupRef = doc(db, "families", groupId);
    const group = (await getDoc(groupRef)).data() as FamilyGroup;
    
    const updatedInvites = group.invites.filter(i => i.token !== token);
    
    await updateDoc(groupRef, { invites: updatedInvites });
};
