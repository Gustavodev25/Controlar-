import axios from 'axios';

async function testSync() {
  console.log('Testing /api/pluggy/sync...');
  try {
    const response = await axios.post('http://localhost:3001/api/pluggy/sync', {
      itemId: '3bcea3dc-d829-4b55-85dd-a868d8eb9dfb'
    });
    console.log('Sync Success!');
    console.log('Accounts:', response.data.accounts?.length);
    console.log('Transactions:', response.data.transactions?.length);
  } catch (error) {
    console.error('Sync Error:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

testSync();
