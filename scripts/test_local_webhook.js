// Simulate a Pluggy Webhook locally
import fetch from 'node-fetch';

async function testLocalWebhook() {
    const payload = {
        event: "item/updated",
        itemId: "ac2db73b-2801-4f5d-bcb1-4f0d8bc6e0c5", // ID from your logs
        clientUserId: "QhSwFzrJ9kSiR2h2GYeLm8xeCky1"
    };

    console.log('>>> Sending Fake Webhook to localhost:3000...');
    try {
        const res = await fetch('http://localhost:3000/api/pluggy/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log('Response Status:', res.status);
        console.log('Response Body:', await res.json());
    } catch (e) {
        console.error('Error:', e.message);
    }
}

testLocalWebhook();
