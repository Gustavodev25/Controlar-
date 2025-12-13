import axios from 'axios';

async function testPluggyAuth() {
  console.log('Testing /api/pluggy/create-token (auth only)...');
  try {
    const response = await axios.post('http://localhost:3001/api/pluggy/create-token', {
      userId: 'test-user'
    });

    console.log('Auth Success!');
    console.log('AccessToken present:', !!response.data.accessToken);
    console.log('Existing items:', Array.isArray(response.data.existingItems) ? response.data.existingItems.length : 0);
  } catch (error) {
    console.error('Auth Error:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

testPluggyAuth();
