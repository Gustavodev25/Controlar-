import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const PLUGGY_CLIENT_ID = process.env.PLUGGY_CLIENT_ID;
const PLUGGY_CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET;
const PLUGGY_API_URL = process.env.PLUGGY_API_URL || 'https://api.pluggy.ai';

async function test() {
    console.log('Testing Pluggy Auth & Scopes...');
    
    try {
        // 1. Auth
        console.log('1. Authenticating...');
        const authRes = await axios.post(
            `${PLUGGY_API_URL}/auth`,
            { clientId: PLUGGY_CLIENT_ID, clientSecret: PLUGGY_CLIENT_SECRET },
            { headers: { 'Content-Type': 'application/json' } }
        );
        const apiKey = authRes.data.apiKey;
        console.log('Auth Success. Token:', apiKey.substring(0, 10) + '...');

        // 2. Test POST /connect_token (Should work based on app behavior)
        console.log('2. Testing POST /connect_token...');
        try {
            const tokenRes = await axios.post(`${PLUGGY_API_URL}/connect_token`, 
                { clientUserId: 'test_user_123' },
                { headers: { 'X-API-KEY': apiKey } }
            );
            console.log('POST /connect_token Success. Token:', tokenRes.data.accessToken?.substring(0,10));
        } catch (err) {
            console.error('POST /connect_token Failed:', err.response?.status, err.response?.data);
        }

        // 3. Test GET /items with X-API-KEY
        console.log('3. Testing GET /items (X-API-KEY)...');
        try {
            await axios.get(`${PLUGGY_API_URL}/items`, {
                headers: { 'X-API-KEY': apiKey }
            });
            console.log('GET /items (X-API-KEY) Success.');
        } catch (err) {
            console.error('GET /items (X-API-KEY) Failed:', err.response?.status); //, err.response?.data);
        }

        // 4. Test GET /items with Bearer (Just in case)
        console.log('4. Testing GET /items (Bearer)...');
        try {
            await axios.get(`${PLUGGY_API_URL}/items`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            console.log('GET /items (Bearer) Success.');
        } catch (err) {
            console.error('GET /items (Bearer) Failed:', err.response?.status);
        }

        // 5. Test GET /connectors
        console.log('5. Testing GET /connectors...');
        try {
            const conRes = await axios.get(`${PLUGGY_API_URL}/connectors?countries=BR`, {
                headers: { 'X-API-KEY': apiKey }
            });
            console.log('GET /connectors Success. Count:', conRes.data.results?.length);
        } catch (err) {
            console.error('GET /connectors Failed:', err.response?.status);
        }

        // 6. Test GET /accounts (Try to fetch any account)
        console.log('6. Testing GET /accounts...');
        try {
            const accRes = await axios.get(`${PLUGGY_API_URL}/accounts`, {
                headers: { 'X-API-KEY': apiKey }
            });
            console.log('GET /accounts Success. Count:', accRes.data.results?.length);
        } catch (err) {
            console.error('GET /accounts Failed:', err.response?.status, err.response?.data?.message);
        }

    } catch (e) {
        console.error('Fatal Error:', e.message);
    }
}

test();
