const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '.env');

try {
  let content = fs.readFileSync(envPath, 'utf8');
  
  const updates = {
    'SMTP_HOST': 'smtp.hostinger.com',
    'SMTP_PORT': '465',
    'SMTP_SECURE': 'true',
    'SMTP_USER': 'contato@controlarmais.com.br',
    'SMTP_PASS': '70WaksJ45Tj3'
  };

  Object.entries(updates).forEach(([key, value]) => {
    const regex = new RegExp(`^${key}=.*`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
      console.log(`Updated ${key}`);
    } else {
      content += `\n${key}=${value}`;
      console.log(`Added ${key}`);
    }
  });

  fs.writeFileSync(envPath, content);
  console.log('.env updated successfully.');
} catch (e) {
  console.error('Error updating .env:', e);
}

