import axios from 'axios';

const PLUGGY_API_URL = 'https://api.pluggy.ai';
const PLUGGY_CLIENT_ID = 'd93b0176-0cd8-4563-b9c1-bcb9c6e510bd';
const PLUGGY_CLIENT_SECRET = '2b45852a-9638-4677-8232-6b2da7c54967';

async function testPluggy() {
  console.log('Testing Pluggy Auth...');
  try {
    const authResponse = await axios.post(`${PLUGGY_API_URL}/auth`, {
      clientId: PLUGGY_CLIENT_ID,
      clientSecret: PLUGGY_CLIENT_SECRET
    });

    console.log('Auth Success! API Key:', authResponse.data.apiKey ? 'Received' : 'Missing');
    const apiKey = authResponse.data.apiKey;

    console.log('Creating Connect Token...');
    const tokenResponse = await axios.post(`${PLUGGY_API_URL}/connect_token`, {}, {
      headers: { 'X-API-KEY': apiKey }
    });

    console.log('Token Success! Access Token:', tokenResponse.data.accessToken ? 'Received' : 'Missing');

  } catch (error) {
    console.error('Pluggy Error:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

testPluggy();
