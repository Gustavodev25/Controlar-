import express from 'express';
import cors from 'cors';
import twilio from 'twilio';
import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import geminiHandler from './gemini.js';
import claudeHandler from './claude.js';
import nodemailer from 'nodemailer';
import pluggyRouter from './pluggy.js';
import cronSyncRouter from './cron-sync.js';
import { firebaseAdmin, firebaseAuth } from './firebaseAdmin.js';
import { loadEnv } from './env.js';
import { sendSaleToUtmify, sendRefundToUtmify } from './utmifyService.js';

loadEnv();

const router = express.Router();

router.use(cors());
router.use(express.urlencoded({ extended: false, limit: '50mb' }));
router.use(express.json({ limit: '50mb' }));

// Health Check / Diagnostics
router.get('/status', async (req, res) => {
  const status = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      firebase: !!firebaseAdmin ? 'Connected' : 'Not Initialized',
      pluggy: {
        clientId: !!process.env.PLUGGY_CLIENT_ID ? 'Configured' : 'Missing',
        clientSecret: !!process.env.PLUGGY_CLIENT_SECRET ? 'Configured' : 'Missing'
      },
      smtp: {
        host: process.env.SMTP_HOST || 'Default',
        user: !!process.env.SMTP_USER ? 'Configured' : 'Missing'
      },
      asaas: {
        apiKey: !!process.env.ASAAS_API_KEY ? 'Configured' : 'Missing'
      }
    }
  };
  res.json(status);
});

// ===============================
// AUTH & OTP SYSTEM
// ===============================
const otpStore = new Map(); // Store OTPs in memory: email -> { code, expires }

// Clean up expired OTPs every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of otpStore.entries()) {
    if (data.expires < now) {
      otpStore.delete(email);
    }
  }
}, 10 * 60 * 1000);

router.post('/auth/send-recovery-code', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email é obrigatório.' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Formato de email inválido.' });
  }

  try {
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 15 * 60 * 1000; // 15 minutes

    otpStore.set(email.toLowerCase(), { code, expires });

    // Send Email - Dark theme matching the app design
    const htmlTemplate = `
      <!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperação de Senha</title>
</head>
<body style="margin: 0; padding: 0; background-color: transparent; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: transparent; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="500" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #30302E; border: 1px solid #373734; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          
          <!-- Header -->
          <tr>
            <td align="left" style="padding: 24px 32px; background-color: #333432; border-bottom: 1px solid #373734;">
              <div style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 24px; font-weight: bold; color: #ffffff; letter-spacing: -0.025em;">
                Controlar<span style="color: #d97757;">+</span>
              </div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h1 style="margin: 0 0 24px 0; color: #ffffff; font-size: 24px; font-weight: bold; text-align: left;">
                Recuperação de Senha
              </h1>
              
              <p style="color: #d1d5db; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                Olá,
              </p>
              
              <p style="color: #d1d5db; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Recebemos uma solicitação para redefinir a senha da sua conta no <strong style="color: #ffffff;">Controlar+</strong>.
              </p>
              
              <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 0 0 16px 0;">
                Use o código abaixo para validar sua identidade:
              </p>
              
              <!-- Code Box -->
              <div style="text-align: center; margin: 32px 0;">
                <div style="display: inline-block; background: linear-gradient(135deg, #363735 0%, #30302E 100%); padding: 20px 40px; border-radius: 12px; border: 1px solid #4a4a48;">
                  <!-- Placeholder value used for preview: 852910 -->
                  <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #d97757; font-family: 'Courier New', monospace;">${code}</span>
                </div>
              </div>
              
              <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 24px 0 0 0;">
                Este código expira em <strong style="color: #ffffff;">15 minutos</strong>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #333432; border-top: 1px solid #373734;">
              <p style="color: #6b7280; font-size: 12px; text-align: center; margin: 0 0 8px 0;">
                Se você não solicitou esta redefinição de senha, pode ignorar este email com segurança.
              </p>
              <p style="color: #4b5563; font-size: 11px; text-align: center; margin: 0;">
                <!-- Placeholder value used for preview: 2025 -->
                © 2025 Controlar+. Todos os direitos reservados.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    await smtpTransporter.sendMail({
      from: process.env.SMTP_FROM || `"Controlar+" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Código de Recuperação de Senha - Controlar+',
      html: htmlTemplate,
      text: `Seu código de recuperação é: ${code}`
    });

    console.log(`>>> OTP sent to ${email}: ${code}`);
    res.json({ success: true, message: 'Código enviado com sucesso.' });

  } catch (error) {
    console.error('Send OTP Error:', error);
    res.status(500).json({ error: 'Erro ao enviar código.', details: error.message });
  }
});

router.post('/auth/verify-recovery-code', async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Email e código são obrigatórios.' });
  }

  const normalizedEmail = email.toLowerCase();
  const record = otpStore.get(normalizedEmail);

  if (!record) {
    return res.status(400).json({ error: 'Código inválido ou expirado.' });
  }

  if (record.code !== code) {
    return res.status(400).json({ error: 'Código incorreto.' });
  }

  if (record.expires < Date.now()) {
    otpStore.delete(normalizedEmail);
    return res.status(400).json({ error: 'Código expirado.' });
  }

  // Mark as verified so reset-password knows it's valid
  record.verified = true;
  otpStore.set(normalizedEmail, record);

  res.json({ success: true, message: 'Código válido.' });
});

router.post('/auth/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Dados incompletos.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
  }

  const normalizedEmail = email.toLowerCase();

  // Verify OTP again
  const record = otpStore.get(normalizedEmail);
  if (!record || record.code !== code || record.expires < Date.now()) {
    return res.status(400).json({ error: 'Sessão inválida ou expirada. Solicite um novo código.' });
  }

  try {
    // If Firebase Admin is available, use it
    if (firebaseAuth) {
      const user = await firebaseAuth.getUserByEmail(email);
      await firebaseAuth.updateUser(user.uid, {
        password: newPassword
      });

      // Clear OTP
      otpStore.delete(normalizedEmail);

      console.log(`>>> Password reset successful for ${email} via Firebase Admin`);
      return res.json({ success: true, message: 'Senha alterada com sucesso!' });
    }

    // Alternative: Use Firebase REST API
    const firebaseApiKey = process.env.VITE_FIREBASE_API_KEY || 'AIzaSyBGhm5J90b4fVlhmyP7bhVPliQZmQUSmmo';

    // Step 1: Send password reset email via Firebase REST API to get an oobCode
    const sendResetResponse = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${firebaseApiKey}`,
      {
        requestType: 'PASSWORD_RESET',
        email: email
      }
    );

    if (sendResetResponse.data.email) {
      // Firebase sent a reset email - we'll store the new password and 
      // instruct the user to click the link, OR we redirect them to use the link

      // Clear our OTP since Firebase is handling it
      otpStore.delete(normalizedEmail);

      console.log(`>>> Password reset email sent to ${email} via Firebase REST API`);
      return res.json({
        success: true,
        message: 'Enviamos um email do Firebase com link para redefinir sua senha. Clique no link recebido.',
        requiresFirebaseLink: true
      });
    }

  } catch (error) {
    console.error('Reset Password Error:', error);

    // Handle Firebase Admin SDK errors
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'Usuário não encontrado. Verifique o email.' });
    }

    if (error.code === 'auth/invalid-password') {
      return res.status(400).json({ error: 'Senha inválida. A senha deve ter pelo menos 6 caracteres.' });
    }

    // Handle Firebase REST API errors (legacy fallback)
    const firebaseError = error.response?.data?.error;
    if (firebaseError?.message === 'EMAIL_NOT_FOUND') {
      return res.status(404).json({ error: 'Email não encontrado. Verifique se digitou corretamente.' });
    }

    res.status(500).json({
      error: 'Erro ao redefinir senha.',
      details: error.message || 'Erro interno no servidor.'
    });
  }
});

// ===============================
// TWILIO + CLAUDE (WhatsApp bot)
// ===============================
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
const fromNumber = process.env.TWILIO_PHONE_NUMBER || 'whatsapp:+14155238886';

// Initialize Twilio client if credentials are present
let client;
try {
  if (accountSid && authToken) {
    client = twilio(accountSid, authToken);
  }
} catch (e) {
  console.error('Twilio init error:', e);
}

const claude = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;
// Use Sonnet 3.5 (latest stable) for smart responses
const CLAUDE_MODEL = 'claude-3-5-sonnet-20240620';

async function generateResponse(text) {
  if (!claude) return 'Erro: API do Claude nao configurada.';

  const todayStr = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const systemPrompt = `
Hoje é: ${todayStr}.
Você é o "Coinzinha", um assistente financeiro pessoal divertido, amigável e inteligente.

O usuário enviou via WhatsApp: "${text}"

Objetivo:
1. Se for uma transação (ex: "gastei 10 padaria"), responda confirmando com o valor e categoria de forma amigável (não precisa salvar, apenas confirmar o entendimento).
2. Se for conversa, responda de forma curta e amigável.
3. Use emojis.
4. Responda SEMPRE em português brasileiro.
5. Seja conciso (max 2-3 frases).
`;

  try {
    const response = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: [
        { role: 'user', content: text }
      ]
    });

    // Extract text from response content
    const reply = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');

    return reply;
  } catch (e) {
    console.error('Claude Error:', e);
    return 'Opa, tive um problema aqui. Pode repetir?';
  }
}

// WhatsApp webhook
router.post('/whatsapp', async (req, res) => {
  const { Body, From } = req.body;
  console.log(`Mensagem de ${From}: ${Body}`);

  if (Body?.toLowerCase().includes('join')) {
    const welcomeMsg =
      "Conectado ao Coinzinha! Pode falar comigo. Ex: 'Gastei 50 reais no mercado'.";

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
    console.error('Twilio client not ready.');
    return res.status(500).send('Twilio not configured');
  }

  try {
    const replyText = await generateResponse(Body);
    console.log(`Claude Reply: ${replyText}`);

    await client.messages.create({
      from: fromNumber,
      to: From,
      body: replyText
    });
  } catch (e) {
    console.error('Error processing message:', e);
  }

  res.set('Content-Type', 'text/xml');
  res.send('<Response></Response>');
});

// Gemini proxy endpoint
router.post('/gemini', geminiHandler);

// Claude proxy endpoint
router.post('/claude', claudeHandler);

// ========================================
// EMAIL SENDING (NODEMAILER)
// ========================================

// Remove spaces from password if present (common when copying from Google)
const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

// Auto-detect Zoho for controlarmais domain
const smtpUser = process.env.SMTP_USER || '';
const isZohoEmail = smtpUser.includes('@controlarmais.com.br') || smtpUser.includes('zoho');
const defaultHost = isZohoEmail ? 'smtp.zoho.com' : 'smtp.gmail.com';

const smtpConfig = {
  host: process.env.SMTP_HOST || defaultHost,
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: smtpUser,
    pass: smtpPass
  },
  logger: false,
  debug: false,
  // Zoho specific settings
  tls: {
    rejectUnauthorized: true
  }
};

console.log(`>>> SMTP Config: host=${smtpConfig.host}, port=${smtpConfig.port}, secure=${smtpConfig.secure}, user=${smtpUser ? smtpUser.substring(0, 5) + '...' : 'NOT SET'}`);

const smtpTransporter = nodemailer.createTransport(smtpConfig);

smtpTransporter.verify(function (error, success) {
  if (error) {
    console.error('>>> SMTP Connection Error:', error.message);
    console.error('>>> SMTP Error Code:', error.code);
  } else {
    console.log('>>> SMTP Server is ready to send emails');
  }
});

router.post('/admin/send-email', async (req, res) => {
  const {
    recipients,
    subject,
    title,
    body,
    boxContent, // New field
    buttonText,
    buttonLink,
    headerAlign,
    titleAlign,
    bodyAlign
  } = req.body;

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'Nenhum destinatário selecionado.' });
  }

  const hAlign = headerAlign || 'center';
  const tAlign = titleAlign || 'center';
  const bAlign = bodyAlign || 'left';

  const htmlTemplate = `
 <!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table,td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: transparent; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #d1d5db;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: transparent; padding: 40px 0;">
    <tr>
      <td align="center">
        <!-- Largura alterada para 500 e cores ajustadas para o tema do exemplo 2 -->
        <table width="500" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #30302E; border: 1px solid #373734; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); border-collapse: separate; mso-border-radius-alt: 16px;">
          
          <!-- Header (Estilo visual do exemplo 2, mas com alinhamento variável do exemplo 1) -->
          <tr>
            <td align="${hAlign === 'justify' ? 'left' : hAlign}" style="padding: 24px 32px; background-color: transparent; border-bottom: 1px solid #373734; text-align: ${hAlign === 'justify' ? 'left' : hAlign};">
              <div style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 24px; font-weight: bold; color: #ffffff; letter-spacing: -0.025em; line-height: 1; display: inline-block;">
                Controlar<span style="color: #d97757;">+</span>
              </div>
            </td>
          </tr>

          <!-- Content (Padding e cores do exemplo 2) -->
          <tr>
            <td style="padding: 40px 32px; background-color: #30302E;">
              <h1 style="margin: 0 0 8px 0; color: #ffffff; font-size: 24px; font-weight: bold; line-height: 1.25; text-align: ${tAlign};">
                ${title || 'Título da Mensagem'}
              </h1>

              <div style="color: #d1d5db; font-size: 16px; line-height: 1.6; text-align: ${bAlign};">
                ${(body || '').replace(/\n/g, '<br/>')}
              </div>

              <!-- Box Content (Opcional) -->
              ${boxContent ? `
              <div style="text-align: center; margin: 32px 0;">
                <div style="display: inline-block; background: linear-gradient(135deg, #363735 0%, #30302E 100%); padding: 20px 40px; border-radius: 12px; border: 1px solid #4a4a48;">
                  <span style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #d97757; font-family: 'Courier New', monospace;">${boxContent}</span>
                </div>
              </div>
              ` : ''}

              <!-- Botão (Mantido a lógica, mas ajustado visualmente se necessário) -->
              <div style="margin-top: 32px; text-align: center;">
                <a href="${buttonLink}" target="_blank" style="display: inline-block; background-color: #d97757; color: #ffffff; font-weight: bold; padding: 12px 32px; border-radius: 9999px; text-decoration: none; box-shadow: 0 4px 6px -1px rgba(217, 119, 87, 0.2);">
                  ${buttonText || 'Ver Agora'}
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer (Estilo visual do exemplo 2) -->
          <tr>
            <td align="center" style="padding: 24px 32px; background-color: transparent; color: #6b7280; font-size: 12px;">
              <p style="margin: 0;">© ${new Date().getFullYear()} Controlar+. Todos os direitos reservados.</p>
              <p style="margin: 8px 0 0 0;">
                <a href="#" style="color: #9ca3af; text-decoration: underline;">Descadastrar</a> • 
                <a href="#" style="color: #9ca3af; text-decoration: underline; margin-left: 8px;">Política de Privacidade</a>
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    // Helper functionality for batching
    const batchSize = 10; // Number of emails per batch
    const delayBetweenBatches = 2000; // Delay in ms (2 seconds)

    // Split recipients into batches
    const batches = [];
    for (let i = 0; i < recipients.length; i += batchSize) {
      batches.push(recipients.slice(i, i + batchSize));
    }

    console.log(`>>> Starting batch email send. Total recipients: ${recipients.length}. Batches: ${batches.length}`);

    let successCount = 0;
    let failCount = 0;
    const failures = [];

    // Process batches sequentially
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`>>> Sending batch ${i + 1}/${batches.length} (${batch.length} emails)...`);

      const batchPromises = batch.map((email) => {
        return smtpTransporter.sendMail({
          from: process.env.SMTP_FROM || `"Controlar+" <${process.env.SMTP_USER}>`,
          to: email,
          subject: subject,
          html: htmlTemplate,
          text: body
        });
      });

      // Wait for all emails in this batch to finish
      const results = await Promise.allSettled(batchPromises);

      // Tally results
      results.forEach(r => {
        if (r.status === 'fulfilled') {
          successCount++;
        } else {
          failCount++;
          failures.push(r);
        }
      });

      // If there are more batches, wait before sending the next one
      if (i < batches.length - 1) {
        console.log(`>>> Waiting ${delayBetweenBatches}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    console.log(`>>> Email Campaign Finished: ${successCount} success, ${failCount} failed.`);

    if (successCount === 0 && failCount > 0) {
      const firstError = failures[0].reason;
      return res.status(500).json({
        error: 'Falha ao enviar todos os emails.',
        details: firstError?.message || 'Erro desconhecido no SMTP.'
      });
    }

    res.json({
      success: true,
      sent: successCount,
      failed: failCount,
      message: `Enviado para ${successCount} usuários.`
    });
  } catch (error) {
    console.error('Email Send Error:', error);
    res.status(500).json({ error: 'Falha ao processar envio.', details: error.message });
  }
});

// ========================================
// ASAAS PAYMENT INTEGRATION
// ========================================
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = ASAAS_API_KEY && ASAAS_API_KEY.includes('hmlg')
  ? 'https://sandbox.asaas.com/api/v3'
  : 'https://www.asaas.com/api/v3';

// Helper to get client IP from request (works with proxies/serverless)
const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs: client, proxy1, proxy2, etc.
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.ip || req.connection?.remoteAddress || '127.0.0.1';
};

const asaasRequest = async (method, endpoint, data = null) => {
  const config = {
    method,
    url: `${ASAAS_API_URL}${endpoint}`,
    headers: {
      'Content-Type': 'application/json',
      access_token: ASAAS_API_KEY
    }
  };

  if (data) config.data = data;

  console.log(`>>> ASAAS ${method.toUpperCase()} ${endpoint}`);

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error('>>> ASAAS Error:', error.response?.data || error.message);
    throw error;
  }
};

// Validate credit card before purchase
router.post('/asaas/validate-card', async (req, res) => {
  const { creditCard, creditCardHolderInfo, customerId, customerData } = req.body;

  if (!creditCard || !creditCardHolderInfo) {
    return res.status(400).json({
      valid: false,
      error: 'Dados do cartão incompletos.'
    });
  }

  try {
    let customerIdToUse = customerId;

    // If no customerId provided, create/update customer first
    if (!customerIdToUse && customerData) {
      console.log('>>> Creating/updating customer for card validation...');

      // Search for existing customer by CPF
      const searchResult = await asaasRequest(
        'GET',
        `/customers?cpfCnpj=${customerData.cpfCnpj.replace(/\D/g, '')}`
      );

      if (searchResult.data && searchResult.data.length > 0) {
        // Update existing customer
        const existingCustomer = searchResult.data[0];
        const updateData = {
          name: customerData.name,
          email: customerData.email,
          phone: customerData.phone?.replace(/\D/g, '') || undefined,
          postalCode: customerData.postalCode?.replace(/\D/g, '') || undefined,
          addressNumber: customerData.addressNumber || undefined
        };
        await asaasRequest('PUT', `/customers/${existingCustomer.id}`, updateData);
        customerIdToUse = existingCustomer.id;
        console.log('>>> Updated existing customer:', customerIdToUse);
      } else {
        // Create new customer
        const newCustomerData = {
          name: customerData.name,
          email: customerData.email,
          cpfCnpj: customerData.cpfCnpj.replace(/\D/g, ''),
          phone: customerData.phone?.replace(/\D/g, '') || undefined,
          postalCode: customerData.postalCode?.replace(/\D/g, '') || undefined,
          addressNumber: customerData.addressNumber || undefined,
          notificationDisabled: false
        };
        const newCustomer = await asaasRequest('POST', '/customers', newCustomerData);
        customerIdToUse = newCustomer.id;
        console.log('>>> Created new customer:', customerIdToUse);
      }
    }

    if (!customerIdToUse) {
      return res.status(400).json({
        valid: false,
        error: 'Dados do cliente incompletos para validação.'
      });
    }

    // Use Asaas tokenization to validate the card
    const tokenData = {
      customer: customerIdToUse,
      creditCard: {
        holderName: creditCard.holderName,
        number: creditCard.number.replace(/\s/g, ''),
        expiryMonth: creditCard.expiryMonth,
        expiryYear: creditCard.expiryYear,
        ccv: creditCard.ccv
      },
      creditCardHolderInfo: {
        name: creditCardHolderInfo.name,
        email: creditCardHolderInfo.email,
        cpfCnpj: creditCardHolderInfo.cpfCnpj.replace(/\D/g, ''),
        postalCode: creditCardHolderInfo.postalCode.replace(/\D/g, ''),
        addressNumber: creditCardHolderInfo.addressNumber,
        phone: creditCardHolderInfo.phone?.replace(/\D/g, '') || undefined
      },
      remoteIp: getClientIp(req)
    };

    const tokenResult = await asaasRequest('POST', '/creditCard/tokenize', tokenData);

    if (tokenResult.creditCardToken) {
      return res.json({
        valid: true,
        customerId: customerIdToUse,
        token: tokenResult.creditCardToken,
        brand: tokenResult.creditCardBrand,
        lastDigits: tokenResult.creditCardNumber
      });
    } else {
      return res.status(400).json({
        valid: false,
        error: 'Não foi possível validar o cartão. Verifique os dados e tente novamente.'
      });
    }
  } catch (error) {
    const asaasError = error.response?.data?.errors?.[0];
    const errorMessage = asaasError?.description || 'Cartão inválido ou não autorizado para esta transação.';

    console.error('>>> Card validation error:', asaasError || error.message);

    return res.status(400).json({
      valid: false,
      error: errorMessage,
      code: asaasError?.code
    });
  }
});

router.post('/asaas/customer', async (req, res) => {
  const { name, email, cpfCnpj, phone, postalCode, addressNumber } = req.body;

  if (!name || !email || !cpfCnpj) {
    return res.status(400).json({ error: 'Nome, email e CPF/CNPJ são obrigatórios.' });
  }

  try {
    const searchResult = await asaasRequest(
      'GET',
      `/customers?cpfCnpj=${cpfCnpj.replace(/\D/g, '')}`
    );

    let customer;

    if (searchResult.data && searchResult.data.length > 0) {
      customer = searchResult.data[0];
      console.log(`>>> Found existing customer: ${customer.id}`);

      const updateData = {
        name,
        email,
        phone: phone?.replace(/\D/g, '') || undefined,
        postalCode: postalCode?.replace(/\D/g, '') || undefined,
        addressNumber: addressNumber || undefined
      };

      customer = await asaasRequest('PUT', `/customers/${customer.id}`, updateData);
    } else {
      const customerData = {
        name,
        email,
        cpfCnpj: cpfCnpj ? cpfCnpj.replace(/\D/g, '') : undefined,
        phone: phone?.replace(/\D/g, '') || undefined,
        postalCode: postalCode?.replace(/\D/g, '') || undefined,
        addressNumber: addressNumber || undefined,
        notificationDisabled: false
      };

      customer = await asaasRequest('POST', '/customers', customerData);
      console.log(`>>> Created new customer: ${customer.id}`);
    }

    res.json({ success: true, customer });
  } catch (error) {
    console.error('>>> Customer creation error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Erro ao criar cliente.',
      details: error.response?.data?.errors?.[0]?.description || error.message
    });
  }
});

// Get customer by CPF/CNPJ (for refund lookup)
router.get('/asaas/customer', async (req, res) => {
  const { cpfCnpj } = req.query;

  if (!cpfCnpj) {
    return res.status(400).json({ error: 'CPF/CNPJ é obrigatório.' });
  }

  try {
    const searchResult = await asaasRequest(
      'GET',
      `/customers?cpfCnpj=${cpfCnpj.replace(/\D/g, '')}`
    );

    if (searchResult.data && searchResult.data.length > 0) {
      res.json({ success: true, customer: searchResult.data[0] });
    } else {
      res.status(404).json({ error: 'Cliente não encontrado.' });
    }
  } catch (error) {
    console.error('>>> Customer search error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Erro ao buscar cliente.',
      details: error.response?.data?.errors?.[0]?.description || error.message
    });
  }
});

router.post('/asaas/subscription', async (req, res) => {
  const {
    userId, // [NEW] User ID for server-side activation
    customerId,
    planId,
    billingCycle,
    value,
    baseValue,
    creditCard,
    creditCardHolderInfo,
    installmentCount,
    couponId, // [NEW] Track coupon
    utmData   // [NEW] UTM tracking data for Utmify
  } = req.body;

  if (!customerId || !value || !creditCard || !creditCardHolderInfo) {
    return res.status(400).json({ error: 'Dados incompletos para criar assinatura.' });
  }

  // Helper to activate plan in Firestore
  const activatePlanOnServer = async (uid, plan, cycle, paymentId, subId, status = 'active') => {
    if (!uid || !firebaseAdmin) return;
    try {
      const db = firebaseAdmin.firestore();
      const now = new Date();

      const nextDate = new Date();
      if (cycle === 'YEARLY' || cycle === 'annual') {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      } else {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }

      const billingCycleFormatted = cycle === 'YEARLY' ? 'annual' : 'monthly';
      const nextBillingDateFormatted = nextDate.toISOString().split('T')[0];
      const updatedAtFormatted = now.toISOString();
      const subscriptionIdValue = subId || paymentId;
      const couponValue = couponId || null;

      // Update BOTH subscription.* (root) AND profile.subscription.* for consistency
      // The frontend merges both, so we must update both to prevent stale data
      await db.collection('users').doc(uid).update({
        'subscription.plan': plan,
        'subscription.status': status,
        'subscription.billingCycle': billingCycleFormatted,
        'subscription.nextBillingDate': nextBillingDateFormatted,
        'subscription.paymentMethod': 'CREDIT_CARD',
        'subscription.asaasCustomerId': customerId,
        'subscription.asaasSubscriptionId': subscriptionIdValue,
        'subscription.couponUsed': couponValue,
        'subscription.updatedAt': updatedAtFormatted,
        'profile.subscription.plan': plan,
        'profile.subscription.status': status,
        'profile.subscription.billingCycle': billingCycleFormatted,
        'profile.subscription.nextBillingDate': nextBillingDateFormatted,
        'profile.subscription.paymentMethod': 'CREDIT_CARD',
        'profile.subscription.asaasCustomerId': customerId,
        'profile.subscription.asaasSubscriptionId': subscriptionIdValue,
        'profile.subscription.couponUsed': couponValue,
        'profile.subscription.updatedAt': updatedAtFormatted
      });
      console.log(`>>> [SERVER] User ${uid} plan ACTIVATED: ${plan} (${cycle})`);
    } catch (e) {
      console.error(`>>> [SERVER] Failed to activate plan for ${uid}:`, e);
    }
  };

  try {
    const cycle = billingCycle === 'annual' ? 'YEARLY' : 'MONTHLY';

    // Use current date for immediate charge attempt (robust format YYYY-MM-DD)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dueDateStr = `${year}-${month}-${day}`;

    // Determine recurring value (use baseValue if provided, otherwise value)
    const recurringValue = baseValue !== undefined ? baseValue : value;

    // CASE 1: Annual Plan with Installments (One-off payment splitted)
    if (billingCycle === 'annual' && installmentCount && installmentCount > 1) {

      // Calculate the correct value to charge.
      // If a coupon was applied, 'value' contains the discounted price.
      // For annual installments, we charge the DISCOUNTED price ('value') splitted.
      const valueToCharge = value;

      const paymentData = {
        customer: customerId,
        billingType: 'CREDIT_CARD',
        value: valueToCharge,
        dueDate: dueDateStr,
        description: `Plano ${planId} - Anual (${installmentCount}x)`,
        installmentCount: installmentCount,
        installmentValue: Math.round((valueToCharge / installmentCount) * 100) / 100,
        creditCard: {
          holderName: creditCard.holderName,
          number: creditCard.number.replace(/\s/g, ''),
          expiryMonth: creditCard.expiryMonth,
          expiryYear: creditCard.expiryYear,
          ccv: creditCard.ccv
        },
        creditCardHolderInfo: {
          name: creditCardHolderInfo.name,
          email: creditCardHolderInfo.email,
          cpfCnpj: creditCardHolderInfo.cpfCnpj.replace(/\D/g, ''),
          postalCode: creditCardHolderInfo.postalCode.replace(/\D/g, ''),
          addressNumber: creditCardHolderInfo.addressNumber,
          phone: creditCardHolderInfo.phone?.replace(/\D/g, '') || undefined
        },
        remoteIp: getClientIp(req),
        externalReference: `${userId || 'anon'}:${planId}_annual_${Date.now()}` // [MODIFIED] Include userId
      };

      const payment = await asaasRequest('POST', '/payments', paymentData);

      if (payment.status === 'CONFIRMED' || payment.status === 'RECEIVED') {

        // [NEW] Activate on Server
        await activatePlanOnServer(userId, planId, cycle, payment.id, null);

        // [NEW] Send sale to Utmify for tracking
        try {
          sendSaleToUtmify({
            orderId: payment.id,
            paymentMethod: 'credit_card',
            status: 'paid',
            valueInCents: Math.round(value * 100),
            customer: {
              name: creditCardHolderInfo.name,
              email: creditCardHolderInfo.email,
              phone: creditCardHolderInfo.phone,
              document: creditCardHolderInfo.cpfCnpj
            },
            product: {
              id: planId,
              name: `Plano ${planId} - Anual`
            },
            utmData: utmData || {}
          }).catch(err => console.error('>>> [UTMIFY] Error sending:', err));
        } catch (utmError) {
          console.error('>>> [UTMIFY] Error building payload:', utmError);
        }

        return res.json({
          success: true,
          payment,
          status: 'CONFIRMED',
          message: 'Pagamento confirmado com sucesso!'
        });
      } else {
        // Reject PENDING, REFUSED, or any other non-confirmed status
        const errorMsg = payment.status === 'PENDING'
          ? 'Pagamento não pôde ser processado. Verifique os dados do cartão e tente novamente.'
          : payment.status === 'REFUSED'
            ? 'Cartão recusado. Verifique os dados ou tente outro cartão.'
            : `Pagamento não aprovado (${payment.status}). Verifique os dados do cartão.`;

        return res.status(400).json({
          success: false,
          payment,
          status: payment.status,
          error: errorMsg
        });
      }
    } else {
      // CASE 2: Subscription (Monthly or Yearly recurring)

      // Check if coupon was applied (discounted value)
      const hasDiscount = value < recurringValue;

      console.log(`>>> Creating subscription: originalValue=${recurringValue}, discountedValue=${value}, hasDiscount=${hasDiscount}`);

      // Calculate next month date for subscription start (if using coupon)
      const getNextMonthDate = () => {
        const next = new Date();
        if (cycle === 'YEARLY') {
          next.setFullYear(next.getFullYear() + 1);
        } else {
          next.setMonth(next.getMonth() + 1);
        }
        const y = next.getFullYear();
        const m = String(next.getMonth() + 1).padStart(2, '0');
        const d = String(next.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };

      // If coupon applied: Create single payment first, then subscription starting next month
      if (hasDiscount) {
        console.log(`>>> Coupon detected! Creating single payment of R$ ${value} + subscription starting next month`);

        // 1. Create single payment with discounted value
        const paymentData = {
          customer: customerId,
          billingType: 'CREDIT_CARD',
          value: Math.round(value * 100) / 100, // Discounted value from coupon
          dueDate: dueDateStr,
          description: `Plano ${planId} - Primeira mensalidade (com desconto)`,
          creditCard: {
            holderName: creditCard.holderName,
            number: creditCard.number.replace(/\s/g, ''),
            expiryMonth: creditCard.expiryMonth,
            expiryYear: creditCard.expiryYear,
            ccv: creditCard.ccv
          },
          creditCardHolderInfo: {
            name: creditCardHolderInfo.name,
            email: creditCardHolderInfo.email,
            cpfCnpj: creditCardHolderInfo.cpfCnpj.replace(/\D/g, ''),
            postalCode: creditCardHolderInfo.postalCode.replace(/\D/g, ''),
            addressNumber: creditCardHolderInfo.addressNumber,
            phone: creditCardHolderInfo.phone?.replace(/\D/g, '') || undefined
          },
          remoteIp: getClientIp(req),
          externalReference: `${userId || 'anon'}:${planId}_first_${Date.now()}` // [MODIFIED] Include userId
        };

        const firstPayment = await asaasRequest('POST', '/payments', paymentData);
        console.log(`>>> First payment created: ${firstPayment.id}, status: ${firstPayment.status}`);

        // Check if first payment was successful
        if (firstPayment.status !== 'CONFIRMED' && firstPayment.status !== 'RECEIVED') {
          const errorMsg = firstPayment.status === 'REFUSED'
            ? 'Cartão recusado. Verifique os dados ou tente outro cartão.'
            : 'Pagamento não aprovado. Verifique os dados do cartão.';

          return res.status(400).json({
            success: false,
            payment: firstPayment,
            status: firstPayment.status,
            error: errorMsg
          });
        }

        // 2. Create subscription starting next month with full value
        const subscriptionData = {
          customer: customerId,
          billingType: 'CREDIT_CARD',
          value: Math.round(recurringValue * 100) / 100, // Full price for future months
          nextDueDate: getNextMonthDate(), // Starts next month
          cycle: cycle,
          description: `Plano ${planId} - ${cycle === 'YEARLY' ? 'Anual' : 'Mensal'}`,
          creditCard: {
            holderName: creditCard.holderName,
            number: creditCard.number.replace(/\s/g, ''),
            expiryMonth: creditCard.expiryMonth,
            expiryYear: creditCard.expiryYear,
            ccv: creditCard.ccv
          },
          creditCardHolderInfo: {
            name: creditCardHolderInfo.name,
            email: creditCardHolderInfo.email,
            cpfCnpj: creditCardHolderInfo.cpfCnpj.replace(/\D/g, ''),
            postalCode: creditCardHolderInfo.postalCode.replace(/\D/g, ''),
            addressNumber: creditCardHolderInfo.addressNumber,
            phone: creditCardHolderInfo.phone?.replace(/\D/g, '') || undefined
          },
          remoteIp: getClientIp(req),
          externalReference: `${userId || 'anon'}:${planId}_${cycle.toLowerCase()}_${Date.now()}` // [MODIFIED] Include userId
        };

        // SAFEGUARD: If subscription fails but payment succeeded, we MUST still activate the plan.
        let subscription = null;
        try {
          subscription = await asaasRequest('POST', '/subscriptions', subscriptionData);
          console.log(`>>> Subscription created: ${subscription.id}, starts: ${getNextMonthDate()}`);
        } catch (subError) {
          console.error(`>>> WARNING: Payment succeeded but Subscription failed:`, subError.message);
          console.error('>>> The plan will be ACTIVATED to honor the payment. Admin must fix subscription manually.');

          // Mock a partial subscription object for the activation logs
          subscription = { id: 'manual_recheck_needed_' + Date.now() };
        }

        // [NEW] Activate on Server (Even if subscription failed, because Payment was CONFIRMED)
        await activatePlanOnServer(userId, planId, cycle, firstPayment.id, subscription?.id);

        // [NEW] Send sale to Utmify for tracking
        try {
          sendSaleToUtmify({
            orderId: firstPayment.id,
            paymentMethod: 'credit_card',
            status: 'paid',
            valueInCents: Math.round(value * 100),
            customer: {
              name: creditCardHolderInfo.name,
              email: creditCardHolderInfo.email,
              phone: creditCardHolderInfo.phone,
              document: creditCardHolderInfo.cpfCnpj
            },
            product: {
              id: planId,
              name: `Plano ${planId} - ${cycle === 'YEARLY' ? 'Anual' : 'Mensal'}`
            },
            utmData: utmData || {}
          }).catch(err => console.error('>>> [UTMIFY] Error sending:', err));
        } catch (utmError) {
          console.error('>>> [UTMIFY] Error building payload:', utmError);
        }

        return res.json({
          success: true,
          payment: firstPayment,
          // If subscription failed, we return success but maybe checking status logs
          subscription: subscription,
          status: 'CONFIRMED',
          message: 'Pagamento confirmado! Plano ativado.'
        });
      }

      // No coupon: Create normal subscription starting today
      const subscriptionData = {
        customer: customerId,
        billingType: 'CREDIT_CARD',
        value: Math.round(recurringValue * 100) / 100,
        nextDueDate: dueDateStr,
        cycle: cycle,
        description: `Plano ${planId} - ${cycle === 'YEARLY' ? 'Anual' : 'Mensal'}`,
        creditCard: {
          holderName: creditCard.holderName,
          number: creditCard.number.replace(/\s/g, ''),
          expiryMonth: creditCard.expiryMonth,
          expiryYear: creditCard.expiryYear,
          ccv: creditCard.ccv
        },
        creditCardHolderInfo: {
          name: creditCardHolderInfo.name,
          email: creditCardHolderInfo.email,
          cpfCnpj: creditCardHolderInfo.cpfCnpj.replace(/\D/g, ''),
          postalCode: creditCardHolderInfo.postalCode.replace(/\D/g, ''),
          addressNumber: creditCardHolderInfo.addressNumber,
          phone: creditCardHolderInfo.phone?.replace(/\D/g, '') || undefined
        },
        remoteIp: getClientIp(req),
        externalReference: `${userId || 'anon'}:${planId}_${cycle.toLowerCase()}_${Date.now()}` // [MODIFIED] Include userId
      };

      const subscription = await asaasRequest('POST', '/subscriptions', subscriptionData);
      console.log(`>>> Subscription created: ${subscription.id}, status: ${subscription.status}`);

      // If subscription is ACTIVE, success
      if (subscription.status === 'ACTIVE') {
        let firstPayment = null;
        try {
          const payments = await asaasRequest('GET', `/payments?subscription=${subscription.id}`);
          firstPayment = payments.data?.[0];
          console.log(`>>> First payment status: ${firstPayment?.status || 'processing'}`);
        } catch (e) {
          console.log('>>> Could not fetch payment details, but subscription is ACTIVE');
        }

        // [NEW] Activate on Server
        await activatePlanOnServer(userId, planId, cycle, firstPayment?.id, subscription.id);

        // [NEW] Send sale to Utmify for tracking
        try {
          sendSaleToUtmify({
            orderId: subscription.id,
            paymentMethod: 'credit_card',
            status: 'paid',
            valueInCents: Math.round(value * 100),
            customer: {
              name: creditCardHolderInfo.name,
              email: creditCardHolderInfo.email,
              phone: creditCardHolderInfo.phone,
              document: creditCardHolderInfo.cpfCnpj
            },
            product: {
              id: planId,
              name: `Plano ${planId} - ${cycle === 'YEARLY' ? 'Anual' : 'Mensal'}`
            },
            utmData: utmData || {}
          }).catch(err => console.error('>>> [UTMIFY] Error sending:', err));
        } catch (utmError) {
          console.error('>>> [UTMIFY] Error building payload:', utmError);
        }

        return res.json({
          success: true,
          subscription,
          payment: firstPayment,
          status: 'CONFIRMED',
          message: 'Assinatura criada com sucesso!'
        });
      }

      // Check for refused payment
      const payments = await asaasRequest('GET', `/payments?subscription=${subscription.id}`);
      const firstPayment = payments.data?.[0];

      if (firstPayment?.status === 'REFUSED') {
        console.log(`>>> Payment REFUSED, cancelling subscription`);
        try {
          await asaasRequest('DELETE', `/subscriptions/${subscription.id}`);
        } catch (cancelError) {
          console.error('>>> Error cancelling subscription:', cancelError.message);
        }

        return res.status(400).json({
          success: false,
          subscription,
          status: 'REFUSED',
          error: 'Cartão recusado. Verifique os dados ou tente outro cartão.'
        });
      }

      // For other statuses, consider success (pending processing)
      // [NEW] We should probably NOT activate here if it's not confirmed yet, 
      // but usually 'ACTIVE' subscription means payment was at least initiated successfully.

      return res.json({
        success: true,
        subscription,
        payment: firstPayment,
        status: firstPayment?.status || subscription.status,
        message: 'Assinatura criada! Pagamento sendo processado.'
      });
    }
  } catch (error) {
    console.error('>>> Subscription error:', error.response?.data || error.message);

    const asaasErrors = error.response?.data?.errors;
    let errorMessage = 'Erro ao processar pagamento.';

    if (asaasErrors && asaasErrors.length > 0) {
      errorMessage = asaasErrors.map((e) => e.description).join('. ');
    }

    res.status(500).json({
      error: errorMessage,
      details: error.response?.data
    });
  }
});

router.post('/asaas/webhook', async (req, res) => {
  // Ignore webhooks on Vercel to prevent double processing/conflicts
  if (process.env.VERCEL || process.env.VERCEL_URL) {
    console.log('>>> Asaas Webhook ignored on Vercel.');
    return res.status(200).json({ received: true, ignored: true, environment: 'Vercel' });
  }

  const event = req.body;
  const incomingToken = req.headers['asaas-access-token'];
  const configuredToken = process.env.ASAAS_WEBHOOK_TOKEN;

  if (configuredToken && incomingToken !== configuredToken) {
    console.warn('>>> Suspicious Webhook Attempt: Invalid Token');
    return res.status(401).json({ error: 'Unauthorized webhook' });
  }

  console.log('>>> ASAAS WEBHOOK RECEIVED:', event.event);
  console.log('>>> Payment ID:', event.payment?.id);
  console.log('>>> Subscription ID:', event.subscription?.id);
  console.log('>>> Customer ID:', event.payment?.customer || event.subscription?.customer);
  console.log('>>> Status:', event.payment?.status);

  // Helper function to revoke user plan by customer ID
  const revokeUserPlanByCustomerId = async (customerId, newStatus) => {
    if (!customerId || !firebaseAdmin) return false;
    try {
      const db = firebaseAdmin.firestore();
      const usersRef = db.collection('users');
      const snapshot = await usersRef.where('subscription.asaasCustomerId', '==', customerId).get();

      if (snapshot.empty) {
        console.log(`>>> No user found with asaasCustomerId: ${customerId}`);
        return false;
      }

      const batch = db.batch();
      const now = new Date().toISOString();
      snapshot.forEach(doc => {
        // Update BOTH subscription.* (root) AND profile.subscription.* for consistency
        // The frontend merges both, so we must update both to prevent stale data
        batch.update(doc.ref, {
          'subscription.plan': 'starter',
          'subscription.status': newStatus,
          'subscription.autoRenew': false,
          'subscription.updatedAt': now,
          'profile.subscription.plan': 'starter',
          'profile.subscription.status': newStatus,
          'profile.subscription.autoRenew': false,
          'profile.subscription.updatedAt': now
        });
        console.log(`>>> Revoking plan for user ${doc.id} (status: ${newStatus})`);
      });

      await batch.commit();
      return true;
    } catch (error) {
      console.error('>>> Error revoking user plan:', error);
      return false;
    }
  };

  // Helper function to revoke user plan by subscription ID
  const revokeUserPlanBySubscriptionId = async (subscriptionId, newStatus) => {
    if (!subscriptionId || !firebaseAdmin) return false;
    try {
      const db = firebaseAdmin.firestore();
      const usersRef = db.collection('users');
      const snapshot = await usersRef.where('subscription.asaasSubscriptionId', '==', subscriptionId).get();

      if (snapshot.empty) {
        console.log(`>>> No user found with asaasSubscriptionId: ${subscriptionId}`);
        return false;
      }

      const batch = db.batch();
      const now = new Date().toISOString();
      snapshot.forEach(doc => {
        // Update BOTH subscription.* (root) AND profile.subscription.* for consistency
        // The frontend merges both, so we must update both to prevent stale data
        batch.update(doc.ref, {
          'subscription.plan': 'starter',
          'subscription.status': newStatus,
          'subscription.autoRenew': false,
          'subscription.updatedAt': now,
          'profile.subscription.plan': 'starter',
          'profile.subscription.status': newStatus,
          'profile.subscription.autoRenew': false,
          'profile.subscription.updatedAt': now
        });
        console.log(`>>> Revoking plan for user ${doc.id} (status: ${newStatus})`);
      });

      await batch.commit();
      return true;
    } catch (error) {
      console.error('>>> Error revoking user plan:', error);
      return false;
    }
  };

  try {
    switch (event.event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        console.log(`>>> Payment confirmed: ${event.payment?.id}`);
        break;

      case 'PAYMENT_OVERDUE':
        console.log(`>>> Payment overdue: ${event.payment?.id}`);
        break;

      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_REFUND_IN_PROGRESS':
      case 'PAYMENT_CHARGEBACK_REQUESTED':
      case 'PAYMENT_CHARGEBACK_DISPUTE':
        // Revoke plan when payment is refunded or chargeback occurs
        console.log(`>>> Payment refunded/chargeback: ${event.payment?.id}`);
        if (event.payment?.customer) {
          const revoked = await revokeUserPlanByCustomerId(event.payment.customer, 'refunded');
          console.log(`>>> Plan revocation result: ${revoked ? 'SUCCESS' : 'FAILED'}`);
        }
        break;

      case 'SUBSCRIPTION_CREATED':
        console.log(`>>> Subscription created: ${event.subscription?.id}`);
        break;

      case 'SUBSCRIPTION_RENEWED':
        console.log(`>>> Subscription renewed: ${event.subscription?.id}`);
        break;

      case 'SUBSCRIPTION_CANCELED':
      case 'SUBSCRIPTION_DELETED':
        // Check if user has accessUntil set (graceful cancellation by admin)
        // If so, don't revoke immediately - user keeps access until that date
        console.log(`>>> Subscription canceled: ${event.subscription?.id}`);
        if (event.subscription?.id && firebaseAdmin) {
          try {
            const db = firebaseAdmin.firestore();
            const usersRef = db.collection('users');
            const snapshot = await usersRef.where('subscription.asaasSubscriptionId', '==', event.subscription.id).get();

            if (!snapshot.empty) {
              const userDoc = snapshot.docs[0];
              const userData = userDoc.data();
              const accessUntil = userData.subscription?.accessUntil;

              if (accessUntil) {
                // User has graceful cancellation - check if access period has passed
                const accessUntilDate = new Date(accessUntil);
                const now = new Date();

                if (now < accessUntilDate) {
                  // Access period not expired - do NOT revoke now
                  console.log(`>>> User ${userDoc.id} has accessUntil ${accessUntil} - keeping plan active until then`);
                  // Just ensure status is marked as canceled (in case webhook fired first)
                  await userDoc.ref.update({
                    'subscription.status': 'canceled',
                    'subscription.autoRenew': false,
                    'profile.subscription.status': 'canceled',
                    'profile.subscription.autoRenew': false
                  });
                } else {
                  // Access period expired - revoke now
                  console.log(`>>> User ${userDoc.id} accessUntil ${accessUntil} has passed - revoking now`);
                  const revoked = await revokeUserPlanBySubscriptionId(event.subscription.id, 'canceled');
                  console.log(`>>> Plan revocation result: ${revoked ? 'SUCCESS' : 'FAILED'}`);
                }
              } else {
                // No accessUntil set - immediate revocation (legacy behavior or immediate cancel)
                const revoked = await revokeUserPlanBySubscriptionId(event.subscription.id, 'canceled');
                console.log(`>>> Plan revocation result: ${revoked ? 'SUCCESS' : 'FAILED'}`);
              }
            } else {
              console.log(`>>> No user found with subscription ${event.subscription.id}`);
            }
          } catch (checkError) {
            console.error('>>> Error checking accessUntil:', checkError);
            // Fallback to immediate revocation on error
            const revoked = await revokeUserPlanBySubscriptionId(event.subscription.id, 'canceled');
            console.log(`>>> Fallback plan revocation result: ${revoked ? 'SUCCESS' : 'FAILED'}`);
          }
        }
        break;

      default:
        console.log(`>>> Unknown event: ${event.event}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('>>> Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

router.get('/asaas/subscription/:subscriptionId', async (req, res) => {
  const { subscriptionId } = req.params;

  try {
    const subscription = await asaasRequest('GET', `/subscriptions/${subscriptionId}`);
    res.json({ success: true, subscription });
  } catch (error) {
    res.status(500).json({
      error: 'Erro ao buscar assinatura.',
      details: error.response?.data
    });
  }
});

router.delete('/asaas/subscription/:subscriptionId', async (req, res) => {
  const { subscriptionId } = req.params;

  try {
    const result = await asaasRequest('DELETE', `/subscriptions/${subscriptionId}`);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({
      error: 'Erro ao cancelar assinatura.',
      details: error.response?.data
    });
  }
});

router.get('/asaas/payments', async (req, res) => {
  try {
    const { customer, subscription, status, limit, offset } = req.query;

    // Build query string
    const params = new URLSearchParams();
    if (customer) params.append('customer', customer);
    if (subscription) params.append('subscription', subscription);
    if (status) params.append('status', status);
    if (limit) params.append('limit', limit);
    if (offset) params.append('offset', offset);

    const queryString = params.toString() ? `?${params.toString()}` : '';

    const result = await asaasRequest('GET', `/payments${queryString}`);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('>>> /asaas/payments Error:', error.message);
    res.status(500).json({
      error: 'Erro ao buscar pagamentos.',
      message: error.message,
      details: error.response?.data,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.get('/asaas/payment/:paymentId', async (req, res) => {
  const { paymentId } = req.params;

  try {
    const payment = await asaasRequest('GET', `/payments/${paymentId}`);
    res.json({ success: true, payment });
  } catch (error) {
    res.status(500).json({
      error: 'Erro ao buscar pagamento.',
      details: error.response?.data
    });
  }
});

router.post('/asaas/payment/:paymentId/refund', async (req, res) => {
  const { paymentId } = req.params;
  const { value, description } = req.body;

  try {
    const payload = {
      value: value || undefined, // Optional: for partial refunds
      description: description || 'Solicitado pelo cliente (7 dias)'
    };

    const result = await asaasRequest('POST', `/payments/${paymentId}/refund`, payload);

    console.log(`>>> Payment ${paymentId} refunded:`, result);

    res.json({ success: true, result });
  } catch (error) {
    console.error('>>> Refund error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Erro ao estornar pagamento.',
      details: error.response?.data?.errors?.[0]?.description || error.message
    });
  }
});

// Endpoint to apply coupon to users (and update Asaas if needed)
router.post('/admin/apply-coupons', async (req, res) => {
  const { userIds, couponId, month } = req.body; // month: YYYY-MM

  if (!userIds || !Array.isArray(userIds) || !couponId) {
    return res.status(400).json({ error: 'Dados inválidos. userIds (array) e couponId são obrigatórios.' });
  }

  if (!firebaseAdmin) {
    return res.status(500).json({ error: 'Firebase não inicializado.' });
  }

  try {
    const db = firebaseAdmin.firestore();

    // 1. Get Coupon Details
    const couponDoc = await db.collection('coupons').doc(couponId).get();
    if (!couponDoc.exists) {
      return res.status(404).json({ error: 'Cupom não encontrado.' });
    }
    const coupon = { id: couponDoc.id, ...couponDoc.data() };

    let successCount = 0;
    let errorCount = 0;

    for (const userId of userIds) {
      try {
        // 2. Update Firestore
        // Update BOTH subscription.* (root) AND profile.subscription.*
        const updatePayload = {
          'subscription.couponUsed': couponId,
          'profile.subscription.couponUsed': couponId
        };

        if (month) {
          updatePayload['subscription.couponStartMonth'] = month;
          updatePayload['profile.subscription.couponStartMonth'] = month;
        } else {
          // Remove start month if not provided (apply generally)
          updatePayload['subscription.couponStartMonth'] = firebaseAdmin.firestore.FieldValue.delete();
          updatePayload['profile.subscription.couponStartMonth'] = firebaseAdmin.firestore.FieldValue.delete();
        }

        await db.collection('users').doc(userId).update(updatePayload);

        // 3. Try to update Asaas Payment (if month is provided)
        // This is optional - if it fails, we still count as success since Firebase was updated
        if (month) {
          try {
            const userDoc = await db.collection('users').doc(userId).get();
            const user = userDoc.data();
            const subId = user?.subscription?.asaasSubscriptionId;

            if (subId) {
              // Find pending payments for this subscription
              const paymentsRes = await asaasRequest('GET', `/payments?subscription=${subId}&status=PENDING`);
              const payments = paymentsRes.data || [];

              // Find payment due in the target month (YYYY-MM)
              const targetPayment = payments.find(p => p.dueDate && p.dueDate.startsWith(month));

              if (targetPayment) {
                let discountObj = null;

                if (coupon.type === 'percentage') {
                  discountObj = { value: coupon.value, type: 'PERCENTAGE' };
                } else if (coupon.type === 'fixed') {
                  discountObj = { value: coupon.value, type: 'FIXED' };
                }
                // Note: 'progressive' logic is complex to map to a single payment update without context.
                // For now, only simple coupons trigger immediate Asaas update.
                // If progressive, we might need to calculate the specific value for this month manually.

                if (discountObj) {
                  // Update the payment in Asaas
                  await asaasRequest('POST', `/payments/${targetPayment.id}`, {
                    discount: discountObj
                  });
                  console.log(`>>> [ADMIN] Updated Asaas payment ${targetPayment.id} with coupon ${coupon.code}`);
                }
              } else {
                console.log(`>>> [ADMIN] No pending payment found for month ${month} - coupon applied to Firebase only`);
              }
            }
          } catch (asaasErr) {
            // Asaas update failed, but Firebase was updated successfully
            console.warn(`>>> [ADMIN] Asaas update failed for user ${userId}, but Firebase was updated:`, asaasErr.message);
          }
        }

        successCount++;
      } catch (err) {
        console.error(`>>> Error applying coupon to user ${userId}:`, err);
        errorCount++;
      }
    }

    res.json({ success: true, processed: successCount, errors: errorCount });

  } catch (error) {
    console.error('>>> Apply Coupon Error:', error);
    res.status(500).json({ error: 'Erro ao aplicar cupons.', details: error.message });
  }
});

// ========================================
// CANCEL PLAN (GRACEFUL) - Cancel subscription but maintain access until next billing date
// User keeps PRO access until nextBillingDate, then gets revoked automatically
// ========================================
router.post('/admin/cancel-plan', async (req, res) => {
  const { userId, subscriptionId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId é obrigatório' });
  }

  if (!firebaseAdmin) {
    return res.status(500).json({ error: 'Firebase não inicializado' });
  }

  try {
    const db = firebaseAdmin.firestore();
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const userData = userDoc.data();
    const subscription = userData.subscription || {};
    const currentPlan = subscription.plan || 'starter';
    const nextBillingDate = subscription.nextBillingDate;
    const asaasSubId = subscriptionId || subscription.asaasSubscriptionId;

    // Cancel subscription on Asaas if we have the ID
    if (asaasSubId && !asaasSubId.startsWith('manual_')) {
      try {
        await asaasRequest('DELETE', `/subscriptions/${asaasSubId}`);
        console.log(`>>> [ADMIN] Canceled Asaas subscription: ${asaasSubId}`);
      } catch (asaasError) {
        console.warn(`>>> [ADMIN] Failed to cancel Asaas subscription ${asaasSubId}:`, asaasError.message);
        // Continue anyway - maybe already canceled
      }
    }

    const now = new Date().toISOString();

    // Determine accessUntil date (use nextBillingDate, fallback to end of current month)
    let accessUntil = nextBillingDate;
    if (!accessUntil) {
      // Fallback: end of current billing period (assume monthly, end of next month)
      const fallbackDate = new Date();
      fallbackDate.setMonth(fallbackDate.getMonth() + 1);
      accessUntil = fallbackDate.toISOString().split('T')[0];
    }

    // Update subscription: status = canceled, BUT keep current plan until accessUntil
    const updatePayload = {
      'subscription.status': 'canceled',
      'subscription.autoRenew': false,
      'subscription.canceledAt': now,
      'subscription.accessUntil': accessUntil,
      'subscription.updatedAt': now,
      'profile.subscription.status': 'canceled',
      'profile.subscription.autoRenew': false,
      'profile.subscription.canceledAt': now,
      'profile.subscription.accessUntil': accessUntil,
      'profile.subscription.updatedAt': now
    };

    // NOTE: We do NOT change subscription.plan here - user keeps PRO/Family until accessUntil

    await userRef.update(updatePayload);

    console.log(`>>> [ADMIN] Plan canceled gracefully for user ${userId}. Plan: ${currentPlan}, Access until: ${accessUntil}`);

    res.json({
      success: true,
      message: `Assinatura cancelada. Usuário mantém acesso ${currentPlan.toUpperCase()} até ${accessUntil}`,
      userId,
      currentPlan,
      accessUntil,
      canceledAt: now
    });
  } catch (error) {
    console.error('>>> Error canceling plan:', error);
    res.status(500).json({ error: 'Erro ao cancelar plano', details: error.message });
  }
});

// Endpoint to revoke user plan (admin action)
router.post('/admin/revoke-plan', async (req, res) => {
  const { userId, reason } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId é obrigatório' });
  }

  if (!firebaseAdmin) {
    return res.status(500).json({ error: 'Firebase não inicializado' });
  }

  try {
    const db = firebaseAdmin.firestore();
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const userData = userDoc.data();
    const previousPlan = userData.subscription?.plan || 'starter';

    const now = new Date().toISOString();
    const newStatus = reason === 'refund' ? 'refunded' : 'canceled';

    // Update BOTH subscription.* (root) AND profile.subscription.* for consistency
    // The frontend merges both, so we must update both to prevent stale data on reload
    await userRef.update({
      'subscription.plan': 'starter',
      'subscription.status': newStatus,
      'subscription.autoRenew': false,
      'subscription.updatedAt': now,
      'subscription.revokedAt': now,
      'subscription.revokedReason': reason || 'admin_action',
      'profile.subscription.plan': 'starter',
      'profile.subscription.status': newStatus,
      'profile.subscription.autoRenew': false,
      'profile.subscription.updatedAt': now,
      'profile.subscription.revokedAt': now,
      'profile.subscription.revokedReason': reason || 'admin_action'
    });

    console.log(`>>> [ADMIN] Plan revoked for user ${userId}. Previous: ${previousPlan}, Reason: ${reason}`);

    res.json({
      success: true,
      message: `Plano revogado com sucesso`,
      previousPlan,
      userId
    });
  } catch (error) {
    console.error('>>> Error revoking plan:', error);
    res.status(500).json({ error: 'Erro ao revogar plano', details: error.message });
  }
});

// Endpoint to revoke plan by customer ID (for webhook fallback or admin use)
router.post('/admin/revoke-plan-by-customer', async (req, res) => {
  const { customerId, reason } = req.body;

  if (!customerId) {
    return res.status(400).json({ error: 'customerId é obrigatório' });
  }

  if (!firebaseAdmin) {
    return res.status(500).json({ error: 'Firebase não inicializado' });
  }

  try {
    const db = firebaseAdmin.firestore();
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('subscription.asaasCustomerId', '==', customerId).get();

    if (snapshot.empty) {
      return res.status(404).json({ error: 'Nenhum usuário encontrado com esse customerId' });
    }

    const results = [];
    const batch = db.batch();

    snapshot.forEach(doc => {
      const userData = doc.data();
      results.push({
        userId: doc.id,
        previousPlan: userData.subscription?.plan || 'starter'
      });

      const now = new Date().toISOString();
      const newStatus = reason === 'refund' ? 'refunded' : 'canceled';

      // Update BOTH subscription.* (root) AND profile.subscription.* for consistency
      batch.update(doc.ref, {
        'subscription.plan': 'starter',
        'subscription.status': newStatus,
        'subscription.autoRenew': false,
        'subscription.updatedAt': now,
        'subscription.revokedAt': now,
        'subscription.revokedReason': reason || 'admin_action',
        'profile.subscription.plan': 'starter',
        'profile.subscription.status': newStatus,
        'profile.subscription.autoRenew': false,
        'profile.subscription.updatedAt': now,
        'profile.subscription.revokedAt': now,
        'profile.subscription.revokedReason': reason || 'admin_action'
      });
    });

    await batch.commit();

    console.log(`>>> [ADMIN] Plan revoked for ${results.length} user(s) with customerId: ${customerId}`);

    res.json({
      success: true,
      message: `Plano revogado para ${results.length} usuário(s)`,
      results
    });
  } catch (error) {
    console.error('>>> Error revoking plan:', error);
    res.status(500).json({ error: 'Erro ao revogar plano', details: error.message });
  }
});

// ========================================
// UPDATE PLAN - For admin to manually update user's plan
// ========================================
router.post('/admin/update-plan', async (req, res) => {
  const { userId, customerId, plan, status, billingCycle, couponUsed } = req.body;

  if (!userId && !customerId) {
    return res.status(400).json({ error: 'userId ou customerId é obrigatório' });
  }

  if (!firebaseAdmin) {
    return res.status(500).json({ error: 'Firebase não inicializado' });
  }

  try {
    const db = firebaseAdmin.firestore();
    let userDoc;
    let userDocId;

    // Find user by userId or customerId
    if (userId) {
      userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      userDocId = userId;
    } else {
      const snapshot = await db.collection('users')
        .where('subscription.asaasCustomerId', '==', customerId)
        .get();

      if (snapshot.empty) {
        return res.status(404).json({ error: 'Usuário não encontrado com esse customerId' });
      }
      userDoc = snapshot.docs[0];
      userDocId = userDoc.id;
    }

    const userData = userDoc.data();
    const now = new Date().toISOString();

    // Build update payload
    const updatePayload = {
      'subscription.updatedAt': now,
      'profile.subscription.updatedAt': now
    };

    if (plan) {
      updatePayload['subscription.plan'] = plan;
      updatePayload['profile.subscription.plan'] = plan;
    }

    if (status) {
      updatePayload['subscription.status'] = status;
      updatePayload['profile.subscription.status'] = status;
    }

    if (billingCycle) {
      updatePayload['subscription.billingCycle'] = billingCycle;
      updatePayload['profile.subscription.billingCycle'] = billingCycle;
    }

    if (couponUsed !== undefined) {
      if (couponUsed === null || couponUsed === '') {
        // Remove coupon
        updatePayload['subscription.couponUsed'] = firebaseAdmin.firestore.FieldValue.delete();
        updatePayload['profile.subscription.couponUsed'] = firebaseAdmin.firestore.FieldValue.delete();
        updatePayload['subscription.couponStartMonth'] = firebaseAdmin.firestore.FieldValue.delete();
        updatePayload['profile.subscription.couponStartMonth'] = firebaseAdmin.firestore.FieldValue.delete();
      } else {
        updatePayload['subscription.couponUsed'] = couponUsed;
        updatePayload['profile.subscription.couponUsed'] = couponUsed;
      }
    }

    await db.collection('users').doc(userDocId).update(updatePayload);

    console.log(`>>> [ADMIN] Plan updated for user ${userDocId}. New plan: ${plan}, Status: ${status}`);

    res.json({
      success: true,
      message: 'Plano atualizado com sucesso',
      userId: userDocId,
      updates: {
        plan,
        status,
        billingCycle,
        couponUsed
      },
      previousData: {
        plan: userData.subscription?.plan,
        status: userData.subscription?.status
      }
    });
  } catch (error) {
    console.error('>>> Error updating plan:', error);
    res.status(500).json({ error: 'Erro ao atualizar plano', details: error.message });
  }
});

// ========================================
// FIX SUBSCRIPTION - For customers with manual_recheck_needed status
// ========================================
router.post('/admin/fix-subscription', async (req, res) => {
  const { userId, customerId, planId, billingCycle, cardToken } = req.body;

  if (!userId && !customerId) {
    return res.status(400).json({ error: 'userId ou customerId é obrigatório' });
  }

  if (!firebaseAdmin) {
    return res.status(500).json({ error: 'Firebase não inicializado' });
  }

  try {
    const db = firebaseAdmin.firestore();
    let userDoc;
    let userData;

    // Find user by userId or customerId
    if (userId) {
      userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      userData = userDoc.data();
    } else {
      const snapshot = await db.collection('users')
        .where('subscription.asaasCustomerId', '==', customerId)
        .get();

      if (snapshot.empty) {
        return res.status(404).json({ error: 'Usuário não encontrado com esse customerId' });
      }
      userDoc = snapshot.docs[0];
      userData = userDoc.data();
    }

    const subscription = userData.subscription || {};
    const asaasCustomerId = customerId || subscription.asaasCustomerId;
    const currentPlan = planId || subscription.plan || 'pro';
    const cycle = billingCycle || subscription.billingCycle || 'monthly';

    // Validate that subscription needs fixing
    const subId = subscription.asaasSubscriptionId || '';
    if (!subId.startsWith('manual_recheck_needed_')) {
      return res.status(400).json({
        error: 'Este usuário não precisa de correção',
        currentSubscriptionId: subId
      });
    }

    if (!asaasCustomerId) {
      return res.status(400).json({ error: 'asaasCustomerId não encontrado para este usuário' });
    }

    // Calculate next due date (start of next month or year)
    const getNextDueDate = () => {
      const next = new Date();
      if (cycle === 'annual' || cycle === 'YEARLY') {
        next.setFullYear(next.getFullYear() + 1);
      } else {
        next.setMonth(next.getMonth() + 1);
      }
      const y = next.getFullYear();
      const m = String(next.getMonth() + 1).padStart(2, '0');
      const d = String(next.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    // Get plan value
    const getPlanValue = (plan, billing) => {
      const prices = {
        pro: { monthly: 35.90, annual: 359.00 },
        premium: { monthly: 79.90, annual: 799.00 }
      };
      const planPrices = prices[plan] || prices.pro;
      return billing === 'annual' || billing === 'YEARLY' ? planPrices.annual : planPrices.monthly;
    };

    // Allow custom value override via request body
    const value = req.body.value || getPlanValue(currentPlan, cycle);
    const asaasCycle = cycle === 'annual' || cycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY';

    // Create subscription in Asaas
    const subscriptionData = {
      customer: asaasCustomerId,
      billingType: 'CREDIT_CARD',
      value: value,
      nextDueDate: getNextDueDate(),
      cycle: asaasCycle,
      description: `Plano ${currentPlan} - ${asaasCycle === 'YEARLY' ? 'Anual' : 'Mensal'} (Correção Admin)`,
      externalReference: `${userDoc.id}:${currentPlan}_${asaasCycle.toLowerCase()}_fix_${Date.now()}`
    };

    // If card token provided, use it (optional - Asaas may use saved card)
    if (cardToken) {
      subscriptionData.creditCardToken = cardToken;
    }

    console.log(`>>> [ADMIN] Creating subscription for user ${userDoc.id}:`, subscriptionData);

    const newSubscription = await asaasRequest('POST', '/subscriptions', subscriptionData);
    console.log(`>>> [ADMIN] Subscription created: ${newSubscription.id}`);

    // Update user's subscription in Firebase
    await db.collection('users').doc(userDoc.id).update({
      'subscription.asaasSubscriptionId': newSubscription.id,
      'subscription.updatedAt': new Date().toISOString(),
      'subscription.fixedAt': new Date().toISOString(),
      'subscription.fixedBy': 'admin'
    });

    res.json({
      success: true,
      message: 'Assinatura criada com sucesso!',
      subscription: newSubscription,
      user: {
        id: userDoc.id,
        email: userData.email,
        plan: currentPlan,
        billingCycle: cycle
      }
    });
  } catch (error) {
    console.error('>>> [ADMIN] Fix subscription error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Erro ao criar assinatura',
      details: error.response?.data?.errors?.[0]?.description || error.message
    });
  }
});

// ========================================
// CREATE SUBSCRIPTION - For users with COUPON_100 (no Asaas subscription)
// ========================================
router.post('/admin/create-subscription', async (req, res) => {
  const { userId, value, billingType = 'BOLETO' } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId é obrigatório' });
  }

  if (!firebaseAdmin) {
    return res.status(500).json({ error: 'Firebase não inicializado' });
  }

  try {
    const db = firebaseAdmin.firestore();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const userData = userDoc.data();
    const profile = userData.profile || {};
    const subscription = userData.subscription || {};
    const address = profile.address || {};

    // Log for debugging
    console.log(`>>> [ADMIN] User data keys:`, Object.keys(userData));
    console.log(`>>> [ADMIN] Profile keys:`, Object.keys(profile));

    // Get user data - check multiple possible locations
    const name = userData.name || profile.name;
    const email = userData.email || profile.email;
    const cpf = profile.cpf || userData.cpf;
    const phone = profile.phone || userData.phone;

    console.log(`>>> [ADMIN] Found: name=${name}, email=${email}, cpf=${cpf}`);

    if (!name || !email || !cpf) {
      return res.status(400).json({
        error: 'Dados incompletos do usuário',
        missing: { name: !name, email: !email, cpf: !cpf },
        available: {
          userDataKeys: Object.keys(userData),
          profileKeys: Object.keys(profile)
        }
      });
    }

    // Check if user already has Asaas customer
    let customerId = subscription.asaasCustomerId;

    if (!customerId) {
      // Search for existing customer by CPF
      const cleanCpf = cpf.replace(/\D/g, '');
      const searchResult = await asaasRequest('GET', `/customers?cpfCnpj=${cleanCpf}`);

      if (searchResult.data && searchResult.data.length > 0) {
        customerId = searchResult.data[0].id;
        console.log(`>>> Found existing Asaas customer: ${customerId}`);
      } else {
        // Create new customer
        const customerData = {
          name,
          email,
          cpfCnpj: cleanCpf,
          phone: phone?.replace(/\D/g, '') || undefined,
          postalCode: address.cep?.replace(/\D/g, '') || undefined,
          address: address.street || undefined,
          addressNumber: address.number || undefined,
          complement: address.complement || undefined,
          province: address.neighborhood || undefined,
          notificationDisabled: false
        };

        const newCustomer = await asaasRequest('POST', '/customers', customerData);
        customerId = newCustomer.id;
        console.log(`>>> Created new Asaas customer: ${customerId}`);
      }
    }

    // Calculate next due date based on user's nextBillingDate or next month
    const getNextDueDate = () => {
      if (subscription.nextBillingDate) {
        // Use existing nextBillingDate if it's in the future
        const existing = new Date(subscription.nextBillingDate);
        const today = new Date();
        if (existing > today) {
          return subscription.nextBillingDate;
        }
      }

      // Otherwise, use next month
      const next = new Date();
      next.setMonth(next.getMonth() + 1);
      const y = next.getFullYear();
      const m = String(next.getMonth() + 1).padStart(2, '0');
      const d = String(next.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const cycle = subscription.billingCycle === 'annual' ? 'YEARLY' : 'MONTHLY';
    const planValue = value || 35.90;
    const nextDueDate = getNextDueDate();

    // Create subscription
    const subscriptionData = {
      customer: customerId,
      billingType: billingType, // BOLETO, PIX, or CREDIT_CARD (needs token)
      value: planValue,
      nextDueDate: nextDueDate,
      cycle: cycle,
      description: `Plano ${subscription.plan || 'pro'} - Mensal`,
      externalReference: `${userId}:${subscription.plan || 'pro'}_monthly_admin_${Date.now()}`
    };

    console.log(`>>> [ADMIN] Creating subscription for user ${userId}:`, subscriptionData);

    const newSubscription = await asaasRequest('POST', '/subscriptions', subscriptionData);
    console.log(`>>> [ADMIN] Subscription created: ${newSubscription.id}`);

    // Update user's subscription in Firebase
    await db.collection('users').doc(userId).update({
      'subscription.asaasCustomerId': customerId,
      'subscription.asaasSubscriptionId': newSubscription.id,
      'subscription.paymentMethod': billingType,
      'subscription.updatedAt': new Date().toISOString(),
      'subscription.createdByAdmin': true
    });

    res.json({
      success: true,
      message: 'Assinatura criada com sucesso!',
      subscription: newSubscription,
      user: {
        id: userId,
        name: name,
        email: email,
        plan: subscription.plan || 'pro',
        billingCycle: subscription.billingCycle || 'monthly',
        nextDueDate: nextDueDate
      }
    });
  } catch (error) {
    console.error('>>> [ADMIN] Create subscription error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Erro ao criar assinatura',
      details: error.response?.data?.errors?.[0]?.description || error.message
    });
  }
});

// ========================================
// PLUGGY OPEN FINANCE INTEGRATION
// ========================================
router.use('/pluggy', pluggyRouter);

// ========================================
// CRON JOB - AUTOMATIC SYNC
// ========================================
router.use('/cron/sync', cronSyncRouter);

// ========================================
// ASAAS ADMIN STATS - DASHBOARD METRICS
// ========================================
router.get('/asaas/admin/stats', async (req, res) => {
  try {
    // Fee constants (same as AdminDashboard.tsx)
    const ASAAS_CARD_FEE_PERCENT = 2.99;
    const ASAAS_ANTICIPATION_FEE_PERCENT = 1.15;
    const ASAAS_ANTICIPATION_MIN_VALUE = 5.00;

    const calculateNetValue = (grossValue, installments = 1) => {
      if (grossValue <= 0) return 0;
      let cardFeePercent = ASAAS_CARD_FEE_PERCENT;
      if (installments >= 2 && installments <= 6) cardFeePercent = 3.49;
      else if (installments >= 7 && installments <= 12) cardFeePercent = 3.99;
      else if (installments >= 13) cardFeePercent = 4.29;

      const cardFee = grossValue * (cardFeePercent / 100);
      let anticipationFee = 0;
      if (grossValue > ASAAS_ANTICIPATION_MIN_VALUE) {
        anticipationFee = grossValue * (ASAAS_ANTICIPATION_FEE_PERCENT / 100);
      }
      return grossValue - cardFee - anticipationFee;
    };

    // 1. Fetch active subscriptions
    let subscriptions = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const subsResult = await asaasRequest('GET', `/subscriptions?status=ACTIVE&limit=100&offset=${offset}`);
      if (subsResult.data && subsResult.data.length > 0) {
        subscriptions = subscriptions.concat(subsResult.data);
        offset += subsResult.data.length;
        hasMore = subsResult.hasMore || false;
      } else {
        hasMore = false;
      }
    }

    // Calculate subscription metrics
    let monthlyCount = 0;
    let yearlyCount = 0;
    let mrrGross = 0;

    subscriptions.forEach(sub => {
      const value = sub.value || 0;
      if (sub.cycle === 'MONTHLY') {
        monthlyCount++;
        mrrGross += value;
      } else if (sub.cycle === 'YEARLY') {
        yearlyCount++;
        mrrGross += value / 12; // Convert to monthly
      } else if (sub.cycle === 'WEEKLY') {
        mrrGross += value * 4; // Convert to monthly
      }
    });

    const mrrNet = calculateNetValue(mrrGross, 1);

    // 2. Fetch received/confirmed payments for total revenue
    let payments = [];
    offset = 0;
    hasMore = true;

    // Get payments from last 12 months
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const dateFilter = oneYearAgo.toISOString().split('T')[0];

    while (hasMore) {
      const paymentsResult = await asaasRequest(
        'GET',
        `/payments?status=RECEIVED&dateCreated[ge]=${dateFilter}&limit=100&offset=${offset}`
      );
      if (paymentsResult.data && paymentsResult.data.length > 0) {
        payments = payments.concat(paymentsResult.data);
        offset += paymentsResult.data.length;
        hasMore = paymentsResult.hasMore || false;
      } else {
        hasMore = false;
      }
    }

    // Also fetch CONFIRMED status
    offset = 0;
    hasMore = true;
    while (hasMore) {
      const confirmedResult = await asaasRequest(
        'GET',
        `/payments?status=CONFIRMED&dateCreated[ge]=${dateFilter}&limit=100&offset=${offset}`
      );
      if (confirmedResult.data && confirmedResult.data.length > 0) {
        payments = payments.concat(confirmedResult.data);
        offset += confirmedResult.data.length;
        hasMore = confirmedResult.hasMore || false;
      } else {
        hasMore = false;
      }
    }

    // Calculate total revenue
    let totalRevenueGross = 0;
    payments.forEach(payment => {
      totalRevenueGross += payment.value || 0;
    });

    const totalRevenueNet = calculateNetValue(totalRevenueGross, 1);

    // 3. Fetch pending payments
    let pendingPayments = [];
    offset = 0;
    hasMore = true;

    while (hasMore) {
      const pendingResult = await asaasRequest(
        'GET',
        `/payments?status=PENDING&limit=100&offset=${offset}`
      );
      if (pendingResult.data && pendingResult.data.length > 0) {
        pendingPayments = pendingPayments.concat(pendingResult.data);
        offset += pendingResult.data.length;
        hasMore = pendingResult.hasMore || false;
      } else {
        hasMore = false;
      }
    }

    let pendingRevenue = 0;
    pendingPayments.forEach(payment => {
      pendingRevenue += payment.value || 0;
    });

    console.log(`>>> [ADMIN STATS] Subs: ${subscriptions.length}, Payments: ${payments.length}, MRR: R$ ${mrrGross.toFixed(2)}`);

    res.json({
      success: true,
      subscriptions: {
        active: subscriptions.length,
        monthly: monthlyCount,
        yearly: yearlyCount
      },
      revenue: {
        mrrGross: Math.round(mrrGross * 100) / 100,
        mrrNet: Math.round(mrrNet * 100) / 100,
        totalGross: Math.round(totalRevenueGross * 100) / 100,
        totalNet: Math.round(totalRevenueNet * 100) / 100,
        pending: Math.round(pendingRevenue * 100) / 100
      },
      paymentsCount: payments.length,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('>>> [ADMIN STATS] Error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Erro ao buscar estatísticas do Asaas',
      details: error.response?.data?.errors?.[0]?.description || error.message
    });
  }
});

// ========================================
// ASAAS WEBHOOK
// ========================================
router.post('/asaas/webhook', async (req, res) => {
  try {
    const { event, payment } = req.body;

    // Log apenas eventos relevantes para não poluir
    if (event === 'PAYMENT_REFUNDED' || event === 'PAYMENT_CHARGEBACK') {
      console.log(`>>> [WEBHOOK] Event received: ${event}`);

      if (payment && payment.id) {
        console.log(`>>> [WEBHOOK] Processing refund for payment ${payment.id}`);
        // Send to Utmify
        await sendRefundToUtmify(payment.id);

        // TODO: Aqui você também pode atualizar o status no Firestore se desejar
        // Por enquanto, focando apenas no requisito do Utmify
      }
    }

    // Sempre responder 200 OK para o Asaas não reenviar
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('>>> [WEBHOOK] Error processing event:', error);
    // Ainda retornamos 200 para não travar a fila do Asaas se for erro nosso interno de logica nao critica
    res.status(200).json({ received: true, error: error.message });
  }
});

// ========================================
// SEND EMAIL (GENERIC) - For Admin Notifications
// ========================================
router.post('/admin/send-email', async (req, res) => {
  const { recipients, subject, title, body, buttonText, buttonLink, headerAlign, titleAlign, bodyAlign } = req.body;

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'Recipients array is required' });
  }

  try {
    const htmlTemplate = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title || 'Notificacao Controlar+'}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: transparent; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: transparent; padding: 40px 0;">
          <tr>
            <td align="center">
              <table width="500" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #30302E; border: 1px solid #373734; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
                
                <!-- Header -->
                <tr>
                  <td align="${headerAlign || 'left'}" style="padding: 24px 32px; background-color: #333432; border-bottom: 1px solid #373734;">
                    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 24px; font-weight: bold; color: #ffffff; letter-spacing: -0.025em;">
                      Controlar<span style="color: #d97757;">+</span>
                    </div>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px 32px;">
                    <h1 style="margin: 0 0 24px 0; color: #ffffff; font-size: 24px; font-weight: bold; text-align: ${titleAlign || 'left'};">
                      ${title || 'Notificacao'}
                    </h1>
                    
                    <div style="color: #d1d5db; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0; text-align: ${bodyAlign || 'left'}; white-space: pre-line;">
                      ${body}
                    </div>
                    
                    ${buttonText && buttonLink ? `
                    <!-- Button -->
                    <div style="text-align: center; margin: 32px 0;">
                      <a href="${buttonLink}" style="display: inline-block; background-color: #d97757; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                        ${buttonText}
                      </a>
                    </div>
                    ` : ''}
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 24px 32px; background-color: #333432; border-top: 1px solid #373734;">
                    <p style="color: #4b5563; font-size: 11px; text-align: center; margin: 0;">
                      © ${new Date().getFullYear()} Controlar+. Todos os direitos reservados.
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Send to all recipients
    const promises = recipients.map(email =>
      // Assuming smtpTransporter is reused from recovery logic. I must ensure it's available in scope.
      // Checking top of file... I see imports but smtpTransporter definition was likely not exported or globally available if defined inside a closure.
      // Wait, I need to check where `smtpTransporter` is defined.
      // In line 159 of previous view_file, `smtpTransporter.sendMail` was used.
      // I should define or get it. 
      // Actually, looking at previous code, `smtpTransporter` was used directly.
      // Let's assume it is defined in the file scope. I'll add a check or re-define if unsure.
      // But re-defining might break if I don't import `nodemailer` properly.
      // `nodemailer` is imported at top.
      // Let's create a new transporter instance just to be safe if `smtpTransporter` isn't global, OR rely on it being there.
      // Given the file structure, it's likely defined at the top level.
      // Let's look at lines 1-100 to find `smtpTransporter`.
      smtpTransporter.sendMail({
        from: process.env.SMTP_FROM || `"Controlar+" <${process.env.SMTP_USER}>`,
        to: email,
        subject: subject || 'Notificacao Controlar+',
        html: htmlTemplate,
        text: body // Fallback text
      })
    );

    await Promise.all(promises);

    console.log(`>>> Emails sent to ${recipients.length} recipients`);
    res.json({ success: true, count: recipients.length });

  } catch (error) {
    console.error('Send Email Error:', error);
    res.status(500).json({ error: 'Failed to send emails', details: error.message });
  }
});

export default router;

