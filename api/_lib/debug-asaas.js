import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    console.log('.env not found at', envPath);
}

const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const isSandbox = ASAAS_API_KEY && ASAAS_API_KEY.includes('hmlg');
const ASAAS_API_URL = isSandbox
    ? 'https://sandbox.asaas.com/api/v3'
    : 'https://www.asaas.com/api/v3';

console.log(`Environment: ${isSandbox ? 'SANDBOX' : 'PRODUCTION'}`);
console.log(`URL: ${ASAAS_API_URL}`);
// print first few chars of key to verify
console.log(`Key: ${ASAAS_API_KEY ? ASAAS_API_KEY.substring(0, 10) + '...' : 'MISSING'}`);

const customerId = 'cus_000154567289';

const test = async () => {
    try {
        console.log(`Querying payments for customer ${customerId}...`);
        const url = `${ASAAS_API_URL}/payments?customer=${customerId}&limit=20`;
        const response = await axios.get(url, {
            headers: {
                'access_token': ASAAS_API_KEY
            }
        });
        console.log('Success:', response.status);
        console.log('Data sample:', response.data.data?.[0] || 'No payments found');
    } catch (error) {
        console.error('Error Status:', error.response?.status);
        console.error('Error Data:', error.response?.data);
        console.error('Error Message:', error.message);
    }
};

test();
