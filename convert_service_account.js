// Script para converter Service Account JSON em uma linha para o .env
// Uso: node convert_service_account.js caminho/para/arquivo.json

import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);

if (args.length === 0) {
    console.log('='.repeat(60));
    console.log('🔧 Conversor de Service Account para .env');
    console.log('='.repeat(60));
    console.log('');
    console.log('Como usar:');
    console.log('  node convert_service_account.js <caminho-do-arquivo.json>');
    console.log('');
    console.log('Exemplo:');
    console.log('  node convert_service_account.js ~/Downloads/financeiro-609e1-firebase-adminsdk.json');
    console.log('');
    console.log('Depois de executar, copie a linha gerada para o seu arquivo .env');
    console.log('');
    process.exit(1);
}

const filePath = args[0];

try {
    const absolutePath = path.resolve(filePath);
    const jsonContent = fs.readFileSync(absolutePath, 'utf8');
    const parsed = JSON.parse(jsonContent);

    // Validate it's a service account
    if (!parsed.type || parsed.type !== 'service_account') {
        console.error('❌ Erro: Este não parece ser um arquivo de Service Account do Firebase.');
        process.exit(1);
    }

    // Convert to single line
    const singleLine = JSON.stringify(parsed);

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Service Account convertida com sucesso!');
    console.log('='.repeat(60));
    console.log('');
    console.log('Adicione esta linha ao seu arquivo .env:');
    console.log('');
    console.log('FIREBASE_SERVICE_ACCOUNT=' + singleLine);
    console.log('');
    console.log('='.repeat(60));
    console.log('');

    // Also save to a temp file for easy copying
    const outputPath = path.join(path.dirname(absolutePath), 'service_account_env_line.txt');
    fs.writeFileSync(outputPath, 'FIREBASE_SERVICE_ACCOUNT=' + singleLine);
    console.log(`📄 Também salvo em: ${outputPath}`);

} catch (error) {
    if (error.code === 'ENOENT') {
        console.error(`❌ Erro: Arquivo não encontrado: ${filePath}`);
    } else if (error instanceof SyntaxError) {
        console.error('❌ Erro: Arquivo JSON inválido.');
    } else {
        console.error('❌ Erro:', error.message);
    }
    process.exit(1);
}
