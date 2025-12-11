import axios from 'axios';

async function checkEndpoint() {
  try {
    console.log('Checking /api/pluggy/create-token...');
    const response = await axios.post('http://localhost:3001/api/pluggy/create-token', { userId: 'test' });
    console.log('Response Status:', response.status);
    console.log('Response Data:', response.data);
  } catch (error) {
    if (error.response) {
      console.log('Error Status:', error.response.status);
      console.log('Error Data:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
}

checkEndpoint();
