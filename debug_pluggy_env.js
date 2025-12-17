import dotenv from 'dotenv';
dotenv.config();
console.log('PLUGGY_API_URL:', `"${process.env.PLUGGY_API_URL}"`);
console.log('PLUGGY_CLIENT_ID:', process.env.PLUGGY_CLIENT_ID ? 'Found (' + process.env.PLUGGY_CLIENT_ID.substring(0,5) + '...)' : 'Missing');
console.log('PLUGGY_CLIENT_SECRET:', process.env.PLUGGY_CLIENT_SECRET ? 'Found' : 'Missing');
