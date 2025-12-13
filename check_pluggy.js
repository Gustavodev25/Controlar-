import dotenv from 'dotenv';
import axios from 'axios';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const PLUGGY_API_URL = 'https://api.pluggy.ai';

const CLIENT_ID = process.env.PLUGGY_CLIENT_ID;
const CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET;

console.log('--- Diagnóstico de Conexão Pluggy ---');

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('ERRO: Credenciais não encontradas no arquivo .env');
    console.error('Certifique-se de definir PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET.');
    process.exit(1);
}

console.log(`ClientID: ${CLIENT_ID}`);
console.log(`Secret:   ******${CLIENT_SECRET.slice(-4)}`);
console.log(`URL:      ${PLUGGY_API_URL}`);

async function check() {
    try {
        // 1. Authenticate
        console.log('\n1. Testando Autenticação...');
        const authRes = await axios.post(`${PLUGGY_API_URL}/auth`, {
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET
        });
        const apiKey = authRes.data.apiKey;
        console.log('✅ Autenticação com sucesso!');
        
        // 2. Check Permissions (Connectors)
        console.log('\n2. Testando Permissões Públicas (Connectors)...');
        try {
            const connectorsRes = await axios.get(`${PLUGGY_API_URL}/connectors?countries=BR&pageSize=1`, {
                headers: { 'X-API-KEY': apiKey }
            });
            console.log(`✅ Sucesso! Encontrados ${connectorsRes.data.total} conectores.`);
        } catch (err) {
            console.error('❌ Falha ao listar conectores:', err.response?.status, err.response?.data?.message);
        }

        // 3. Check Data Access (Items)
        console.log('\n3. Testando Acesso a Dados Privados (Items)...');
        try {
            const itemsRes = await axios.get(`${PLUGGY_API_URL}/items`, {
                headers: { 'X-API-KEY': apiKey }
            });
            console.log(`✅ Sucesso! Encontrados ${itemsRes.data.results.length} itens.`);
        } catch (err) {
            console.error('❌ Falha ao listar itens:', err.response?.status);
            console.error('   Erro:', err.response?.data);
            
            if (err.response?.status === 401) {
                console.warn('\n⚠️  ALERTA: Erro 401 ao acessar itens.');
                console.warn('   Isso geralmente indica que a conta Pluggy expirou, está bloqueada');
                console.warn('   ou as credenciais não têm permissão para ler dados de contas.');
                console.warn('   Verifique o status da sua conta no Dashboard da Pluggy.');
            }
        }

        // 4. Check Token Creation
        console.log('\n4. Testando Criação de Connect Token (Widget)...');
        try {
            await axios.post(`${PLUGGY_API_URL}/connect_token`, {
                clientUserId: 'test-diagnostic'
            }, {
                headers: { 'X-API-KEY': apiKey }
            });
            console.log('✅ Sucesso! Token de conexão criado.');
        } catch (err) {
            console.error('❌ Falha ao criar token:', err.response?.status, err.response?.data);
        }

    } catch (err) {
        console.error('❌ Falha na Autenticação:', err.response?.status);
        console.error('   Verifique se o ClientID e Secret estão corretos.');
        console.error('   Erro:', err.response?.data);
    }
}

check();
