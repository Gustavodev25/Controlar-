import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const PLUGGY_CLIENT_ID = process.env.PLUGGY_CLIENT_ID;
const PLUGGY_CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET;
const PLUGGY_API_URL = 'https://api.pluggy.ai';

async function getApiKey() {
    const response = await axios.post(`${PLUGGY_API_URL}/auth`, {
        clientId: PLUGGY_CLIENT_ID,
        clientSecret: PLUGGY_CLIENT_SECRET
    });
    return response.data.apiKey;
}

async function main() {
    console.log('>>> Getting Pluggy API key...');
    const apiKey = await getApiKey();
    console.log('>>> API key obtained');

    console.log('>>> Fetching existing items...');
    const itemsResponse = await axios.get(`${PLUGGY_API_URL}/items`, {
        headers: { 'X-API-KEY': apiKey }
    });

    const items = itemsResponse.data.results || [];
    console.log(`>>> Found ${items.length} items`);

    for (const item of items) {
        console.log(`>>> Deleting item ${item.id} (${item.connector?.name || 'Unknown'})...`);
        try {
            await axios.delete(`${PLUGGY_API_URL}/items/${item.id}`, {
                headers: { 'X-API-KEY': apiKey }
            });
            console.log(`>>> Deleted item ${item.id}`);
        } catch (err) {
            console.error(`>>> Failed to delete item ${item.id}:`, err.message);
        }
    }

    console.log('>>> Done! All Pluggy items have been deleted.');
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
