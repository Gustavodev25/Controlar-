// Test script to verify Pluggy API authentication
// Run this in the browser console to test the credentials

const PLUGGY_CLIENT_ID = "d93b0176-0cd8-4563-b9c1-bcb9c6e510bd";
const PLUGGY_CLIENT_SECRET = "2b45852a-9638-4677-8232-6b2da7c54967";
const API_URL = "https://api.pluggy.ai";

async function testPluggyAuth() {
    console.log("🔐 Testing Pluggy Authentication...");
    console.log("Client ID:", PLUGGY_CLIENT_ID);
    console.log("Client Secret:", PLUGGY_CLIENT_SECRET.substring(0, 8) + "...");

    try {
        // Step 1: Authenticate
        console.log("\n📡 Step 1: Authenticating...");
        const authResponse = await fetch(`${API_URL}/auth`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                clientId: PLUGGY_CLIENT_ID,
                clientSecret: PLUGGY_CLIENT_SECRET,
            }),
        });

        console.log("Auth Response Status:", authResponse.status);

        if (!authResponse.ok) {
            const errorText = await authResponse.text();
            console.error("❌ Auth Failed:", errorText);
            return;
        }

        const authData = await authResponse.json();
        console.log("✅ Auth Success! API Key received:", authData.apiKey.substring(0, 20) + "...");

        // Step 2: Create Connect Token
        console.log("\n📡 Step 2: Creating Connect Token...");
        const tokenResponse = await fetch(`${API_URL}/connect_token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "X-API-KEY": authData.apiKey
            },
            body: JSON.stringify({
                clientUserId: "test-user-123"
            }),
        });

        console.log("Token Response Status:", tokenResponse.status);

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error("❌ Token Creation Failed:", errorText);
            return;
        }

        const tokenData = await tokenResponse.json();
        console.log("✅ Connect Token Created:", tokenData.accessToken.substring(0, 20) + "...");
        console.log("\n🎉 All tests passed! Pluggy is configured correctly.");

    } catch (error) {
        console.error("❌ Test Failed:", error);
    }
}

// Run the test
testPluggyAuth();
