const fs = require('fs');
const path = 'components/TwoFactorPrompt.tsx';

try {
    let content = fs.readFileSync(path, 'utf8');
    let lines = content.split('\n');
    let changed = false;

    for (let i = 0; i < lines.length; i++) {
        // Look for ref assignment to array index
        // ref={el => inputs.current[index] = el}
        // Match "ref={" then "current[index]"
        if (lines[i].includes('ref={') && lines[i].includes('current[index]')) {
            console.log(`Matched line ${i + 1}: ${lines[i].trim()}`);

            // Extract ref variable name
            // Expecting "something.current[index]"
            const distinctMatch = lines[i].match(/([a-zA-Z0-9_]+)\.current\[index\]/);
            const refName = distinctMatch ? distinctMatch[1] : 'inputs';

            console.log(`Detected ref name: ${refName}`);

            // Replacement: ref={el => { refName.current[index] = el; }}
            // We use a regex to replace the whole ref prop
            // Regex: ref=\{[^}]*current\[index\][^}]*\}
            const regex = /ref=\{[^}]*current\[index\][^}]*\}/;

            const newline = lines[i].replace(regex, `ref={el => { ${refName}.current[index] = el; }}`);

            if (newline !== lines[i]) {
                lines[i] = newline;
                changed = true;
                console.log(`Replaced with: ${newline.trim()}`);
            }
        }
    }

    if (changed) {
        fs.writeFileSync(path, lines.join('\n'), 'utf8');
        console.log('Fixed TwoFactorPrompt.tsx');
    } else {
        console.log('No matching line found.');
    }

} catch (err) {
    console.error('Error processing file:', err);
}
