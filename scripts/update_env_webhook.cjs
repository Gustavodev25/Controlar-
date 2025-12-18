const fs = require('fs');
const path = require('path');

const envFiles = ['.env', '.env.local'];
const newUrl = 'https://noble-microlecithal-adriene.ngrok-free.dev/api/pluggy/webhook';
const key = 'PLUGGY_WEBHOOK_URL';

envFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        let found = false;

        const newLines = lines.map(line => {
            if (line.trim().startsWith(`${key}=`)) {
                found = true;
                return `${key}=${newUrl}`;
            }
            return line;
        });

        if (!found) {
            newLines.push(`${key}=${newUrl}`);
        }

        fs.writeFileSync(filePath, newLines.join('\n'));
        console.log(`Updated ${file}`);
    } else {
        console.log(`${file} not found, skipping.`);
    }
});
