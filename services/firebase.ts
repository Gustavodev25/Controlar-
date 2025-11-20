
// Mock Authentication Service to replace Firebase completely
// This service uses localStorage to simulate user sessions.

const STORAGE_KEY = 'financas_auth_user';
const DB_KEY = 'financas_ai_db';

class MockAuth {
    currentUser: any = null;
    listeners: Function[] = [];

    constructor() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                this.currentUser = JSON.parse(stored);
            }
        } catch (e) {
            console.error("Auth restoration error", e);
        }
    }

    onAuthStateChanged(callback: Function) {
        this.listeners.push(callback);
        // Trigger immediately with current state
        callback(this.currentUser);
        // Return unsubscribe function
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    notify() {
        this.listeners.forEach(cb => cb(this.currentUser));
    }

    async signInWithEmailAndPassword(email: string, password: string) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));

        const uid = btoa(email); // Simple mock ID based on email
        
        const dbStr = localStorage.getItem(DB_KEY);
        const db = dbStr ? JSON.parse(dbStr) : { users: {} };
        
        // Check if user exists in our local "DB"
        if (!db.users || !db.users[uid]) {
             const err: any = new Error("User not found");
             err.code = 'auth/user-not-found';
             throw err;
        }

        const profile = db.users[uid].profile;

        const user = {
            uid,
            email,
            displayName: profile?.name || email.split('@')[0],
            updateProfile: async (data: any) => {
                 if(data.displayName) {
                     this.currentUser.displayName = data.displayName;
                 }
                 this.updateStorage();
            }
        };
        
        this.currentUser = user;
        this.updateStorage();
        this.notify();
        return { user };
    }

    async createUserWithEmailAndPassword(email: string, password: string) {
         await new Promise(resolve => setTimeout(resolve, 500));
         
         const uid = btoa(email);
         
         const dbStr = localStorage.getItem(DB_KEY);
         const db = dbStr ? JSON.parse(dbStr) : { users: {} };
         
         if (db.users && db.users[uid]) {
             const err: any = new Error("Email already in use");
             err.code = 'auth/email-already-in-use';
             throw err;
         }

         const user = {
            uid,
            email,
            displayName: '', 
            updateProfile: async (data: any) => {
                if(data.displayName) {
                    this.currentUser.displayName = data.displayName;
                    this.currentUser = { ...this.currentUser, displayName: data.displayName };
                }
                this.updateStorage();
            }
         };

         this.currentUser = user;
         this.updateStorage();
         this.notify();
         return { user };
    }

    async signOut() {
        this.currentUser = null;
        localStorage.removeItem(STORAGE_KEY);
        this.notify();
    }

    updateStorage() {
        if (this.currentUser) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.currentUser));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    }
}

export const auth = new MockAuth();
export const database = null;
