import dotenv from 'dotenv';
dotenv.config();
console.log('Current Directory:', process.cwd());
console.log('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID ? 'Found' : 'Missing');
console.log('TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN ? 'Found' : 'Missing');
