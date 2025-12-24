const fs = require('fs');
const path = 'components/TwoFactorPrompt.tsx';

try {
    let content = fs.readFileSync(path, 'utf8');

    // Fix the Ref return type issue
    const oldPattern = 'ref={(el) => inputRef.current = el}';
    const newPattern = 'ref={(el) => { inputRef.current = el; }}';

    if (content.includes(oldPattern)) {
        content = content.replace(oldPattern, newPattern);
        fs.writeFileSync(path, content, 'utf8');
        console.log('Fixed TwoFactorPrompt.tsx');
    } else {
        // Try with regex if exact match fails due to formatting
        const regex = /ref=\{\(el\) => inputRef\.current = el\}/;
        if (regex.test(content)) {
            content = content.replace(regex, newPattern);
            fs.writeFileSync(path, content, 'utf8');
            console.log('Fixed TwoFactorPrompt.tsx (regex)');
        } else {
            console.log('Pattern not found in TwoFactorPrompt.tsx');
            // console.log('Content preview:', content.substring(0, 200)); 
        }
    }
} catch (err) {
    console.error('Error processing file:', err);
}
