fetch('http://localhost:3001/whatsapp', {
  method: 'POST',
  headers: {'Content-Type': 'application/x-www-form-urlencoded'},
  body: 'Body=join throat-feature&From=whatsapp:+5518996239335'
}).then(r => console.log('Status:', r.status, r.statusText));
