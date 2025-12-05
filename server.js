import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import twilio from 'twilio';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const port = 3001;

app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const fromNumber = process.env.TWILIO_PHONE_NUMBER || 'whatsapp:+14155238886';

// Initialize Clients
let client;
try {
    if (accountSid && authToken) {
        client = twilio(accountSid, authToken);
    } else {
        console.warn("Twilio credentials missing in .env");
    }
} catch (e) {
    console.error("Twilio init error:", e);
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL_NAME = "gemini-1.5-flash";

async function generateResponse(text) {
    if (!ai) return "Erro: API do Gemini não configurada.";
    
    const todayStr = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    const prompt = `
    Hoje é: ${todayStr}.
    Você é o "Coinzinha", um assistente financeiro pessoal divertido, amigável e inteligente.
    
    O usuário enviou via WhatsApp: "${text}"
    
    Objetivo:
    1. Se for uma transação (ex: "gastei 10 padaria"), extraia os dados mentalmente e responda confirmando: "Entendido! R$ 10,00 em Padaria (Alimentação) anotado. 📝" (Observação: nesta demo, apenas responda, não salve).
    2. Se for conversa, responda amigavelmente.
    3. Use emojis.
    
    Responda em português, texto curto.
    `;

    try {
        const result = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt
        });
        return result.response.text() || result.text; // Handle different response structures
    } catch (e) {
        console.error("Gemini Error:", e);
        return "Opa, tive um teto preto aqui 😵‍💫. Pode repetir?";
    }
}

app.post('/whatsapp', async (req, res) => {
    const { Body, From } = req.body;
    console.log(`📩 Message from ${From}: ${Body}`);

    // Immediate response for connection/join messages to avoid AI processing
    if (Body?.toLowerCase().includes('join')) {
        // Twilio usually handles the actual joining logic, but we can send a welcome just in case the webhook is hit
        const welcomeMsg = "🎉 Conectado ao Coinzinha! Pode falar comigo. Ex: 'Gastei 50 reais no mercado'.";
        
        if (client) {
            await client.messages.create({
                from: fromNumber,
                to: From,
                body: welcomeMsg
            });
        }
        
        res.set('Content-Type', 'text/xml');
        return res.send('<Response></Response>');
    }

    if (!client) {
        console.error("Twilio client not ready.");
        return res.status(500).send("Twilio not configured");
    }

    try {
        // Reply with Gemini
        const replyText = await generateResponse(Body);
        console.log(`🤖 Gemini Reply: ${replyText}`);

        await client.messages.create({
            from: fromNumber,
            to: From,
            body: replyText
        });
    } catch (e) {
        console.error("Error processing message:", e);
    }

    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');
});

app.listen(port, () => {
    const ngrokUrl = process.env.NGROK_URL || `http://localhost:${port}`;
    const webhookUrl = `${ngrokUrl}/whatsapp`;

    console.log(`
    🚀 Server running on http://localhost:${port}
    
    🔗 Twilio Webhook URL (Paste this in Twilio Console):
    👉 ${webhookUrl}
    
    (Twilio Console > Messaging > Sandbox Settings > "When a message comes in")
    `);
});
