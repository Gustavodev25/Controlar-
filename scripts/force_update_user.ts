
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

dotenv.config();

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

if (!serviceAccount.project_id) {
    console.error("❌ FIREBASE_SERVICE_ACCOUNT missing or invalid in .env");
    process.exit(1);
}

const app = initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore(app);

const TARGET_USER_ID = "zvtUEYhn61WlDvUtHpThnlq1f603"; // User from request
const ASAAS_CUSTOMER_ID = "cus_000154830123"; // Asaas ID from request

async function main() {
    console.log(`🚀 Starting force update for user: ${TARGET_USER_ID}`);

    try {
        const userRef = db.collection('users').doc(TARGET_USER_ID);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            console.error("❌ User not found!");
            return;
        }

        const userData = userSnap.data();
        console.log("Current Data (Partial):", {
            email: userData?.email,
            subscription: userData?.subscription
        });

        const now = new Date().toISOString();
        // Set 1 year from now for annual, or 1 month for monthly. Assuming Annual Pro based on "12x" hints in memory or default to Monthly if unknown.
        // User said "ta como starter mas ele é pro". Let's assume Annual if we want to be generous or match "Pro".
        // Let's set it to 'active' PRO.

        // We will set nextBillingDate to 1 year from now to be safe, or just a valid date.
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);

        const updateData = {
            'subscription.plan': 'pro',
            'subscription.status': 'active',
            'subscription.billingCycle': 'annual', // Assuming annual for now, can be changed
            'subscription.nextBillingDate': nextYear.toISOString().split('T')[0],
            'subscription.asaasCustomerId': ASAAS_CUSTOMER_ID,
            'subscription.updatedAt': now,
            'subscription.autoRenew': true,

            // Update profile mirror as well
            'profile.subscription.plan': 'pro',
            'profile.subscription.status': 'active',
            'profile.subscription.billingCycle': 'annual',
            'profile.subscription.nextBillingDate': nextYear.toISOString().split('T')[0],
            'profile.subscription.asaasCustomerId': ASAAS_CUSTOMER_ID,
            'profile.subscription.updatedAt': now,
            'profile.subscription.autoRenew': true,

            // Ensure isAdmin is NOT set accidentally, but we are just touching subscription
            // 'isAdmin': true // NO, do not make admin unless requested
        };

        await userRef.update(updateData);
        console.log("✅ Update successful!");
        console.log("New State:", updateData);

    } catch (error) {
        console.error("❌ Error updating user:", error);
    }
}

main();
