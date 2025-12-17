import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Correct regex syntax
const clean = (str) => (str || '').replace(/[\r\n\s"']/g, '');

const CLIENT_ID = clean(process.env.PLUGGY_CLIENT_ID);
const CLIENT_SECRET = clean(process.env.PLUGGY_CLIENT_SECRET);
const API_URL = clean(process.env.PLUGGY_API_URL) || 'https://api.pluggy.ai';

async function testDirectAuth() {
    console.log('>>> Testing Direct Pluggy Auth (Cleaned Credentials)...');
    console.log('URL:', API_URL);
    console.log('Client ID:', CLIENT_ID ? `${CLIENT_ID.substring(0, 5)}...` : 'MISSING');

    if (!CLIENT_ID || !CLIENT_SECRET) {
        console.error('❌ Missing credentials in .env');
        return;
    }

    try {
        // 1. Authenticate
        const authRes = await fetch(`${API_URL}/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientId: CLIENT_ID,
                clientSecret: CLIENT_SECRET
            })
        });

        if (!authRes.ok) {
            console.error('❌ Auth Failed:', authRes.status);
            console.error(await authRes.text());
            return;
        }

        const data = await authRes.json();
        const apiKey = data.apiKey;
        console.log('✅ Auth Success! Token obtained.');
        
        // 2. Test /connectors (Public endpoint, usually works if token is valid)
        console.log('\n>>> Testing /connectors...');
        const connRes = await fetch(`${API_URL}/connectors?country=BR`, {
            headers: { 'X-API-KEY': apiKey }
        });

        if (connRes.ok) {
            const connData = await connRes.json();
            console.log(`✅ Connectors fetch success! Found ${connData.results?.length || 0} connectors.`);
        } else {
            console.error('❌ Connectors fetch failed:', connRes.status);
            console.error(await connRes.text());
        }

        // 3. Test /items (Requires existing items)
        console.log('\n>>> Testing /items...');
        const itemsRes = await fetch(`${API_URL}/items`, {
            headers: { 'X-API-KEY': apiKey }
        });
        
        if (itemsRes.ok) {
            const itemsData = await itemsRes.json();
            console.log(`✅ Items fetch success! Found ${itemsData.results?.length || 0} items.`);
        } else {
            console.error('❌ Items fetch failed:', itemsRes.status);
            console.error(await itemsRes.text());
        }

    } catch (error) {
        console.error('❌ Script Error:', error.message);
    }
}

testDirectAuth();