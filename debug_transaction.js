import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const PORT = process.env.PORT || 3001;
const API_URL = `http://localhost:${PORT}/api/asaas/subscription`;
const CUSTOMER_URL = `http://localhost:${PORT}/api/asaas/customer`;

const run = async () => {
    try {
        // 1. Create Customer
        console.log('Creating Customer...');
        const customerRes = await axios.post(CUSTOMER_URL, {
            name: 'Test User',
            email: 'test@example.com',
            cpfCnpj: '52998224725',
            phone: '11987654321',
            postalCode: '01001000',
            addressNumber: '123'
        });
        const customerId = customerRes.data.customer.id;
        console.log('Customer ID:', customerId);

        // 2. Create Subscription with FAKE CARD
        console.log('Creating Subscription with FAKE CARD...');
        const subRes = await axios.post(API_URL, {
            customerId,
            planId: 'pro',
            billingCycle: 'monthly',
            value: 35.90,
            creditCard: {
                holderName: 'TEST HOLDER',
                number: '4111111111111111', // Generic fake visa
                expiryMonth: '12',
                expiryYear: '2030',
                ccv: '123'
            },
            creditCardHolderInfo: {
                name: 'TEST HOLDER',
                email: 'test@example.com',
                cpfCnpj: '52998224725',
                postalCode: '01001000',
                addressNumber: '123',
                phone: '11987654321'
            }
        });

        console.log('Subscription Response:', JSON.stringify(subRes.data, null, 2));

    } catch (error) {
        if (error.response) {
            console.error('API Error Status:', error.response.status);
            console.error('API Error Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error:', error.message);
        }
    }
};

run();
