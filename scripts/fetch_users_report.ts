
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Load service account from .env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT=(.*)/);
if (!match) {
    console.error("FIREBASE_SERVICE_ACCOUNT not found in .env.local");
    process.exit(1);
}

const serviceAccount = JSON.parse(match[1]);

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
    const snapshot = await db.collection('users').get();
    const results: any[] = [];

    snapshot.forEach(doc => {
        const data = doc.data();
        const profile = data.profile || {};

        // Merge logic similar to database.ts
        const subscription = data.subscription || profile.subscription;
        const connectionLogs = data.connectionLogs || profile.connectionLogs || [];
        const phone = profile.phone || data.phone;
        const email = profile.email || data.email;
        const name = profile.name || data.name;

        // Filter criteria:
        // 1. Android access
        const hasAndroid = connectionLogs.some((log: any) =>
            log.os && log.os.toLowerCase().includes('android')
        );

        // 2. Has plan (not starter)
        // "tem plano" usually means pro or family, but I'll check if it exists and is active.
        const hasPlan = subscription && (subscription.plan === 'pro' || subscription.plan === 'family');

        // 3. Has phone
        const hasPhone = phone && phone.trim() !== '';

        if (hasAndroid && hasPlan && hasPhone) {
            results.push({
                name: name || 'N/A',
                email: email || 'N/A',
                phone: phone,
                plan: subscription.plan,
                status: subscription.status || 'active'
            });
        }
    });

    if (results.length === 0) {
        console.log("Nenhum cliente encontrado com os critérios especificados.");
    } else {
        // Print Markdown Table
        console.log("| Nome | Email | Telefone | Plano | Status |");
        console.log("|------|-------|----------|-------|--------|");
        results.forEach(u => {
            console.log(`| ${u.name} | ${u.email} | ${u.phone} | ${u.plan} | ${u.status} |`);
        });
    }
}

run().catch(console.error);
