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
    const sendPromises = recipients.map((email) => {
      return smtpTransporter.sendMail({
        from: process.env.SMTP_FROM || `"Controlar+" <${process.env.SMTP_USER}>`,
        to: email,
        subject: subject,
        html: htmlTemplate,
        text: body
      });
    });

    const results = await Promise.allSettled(sendPromises);

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const failures = results.filter((r) => r.status === 'rejected');
    const failCount = failures.length;

    console.log(`>>> Email Campaign Sent: ${successCount} success, ${failCount} failed.`);

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
    couponId // [NEW] Track coupon
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

      await db.collection('users').doc(uid).update({
        'subscription.plan': plan,
        'subscription.status': status,
        'subscription.billingCycle': cycle === 'YEARLY' ? 'annual' : 'monthly',
        'subscription.nextBillingDate': nextDate.toISOString().split('T')[0],
        'subscription.paymentMethod': 'CREDIT_CARD',
        'subscription.asaasCustomerId': customerId,
        'subscription.asaasSubscriptionId': subId || paymentId, // Can be payment ID for annual installments
        'subscription.couponUsed': couponId || null,
        'subscription.updatedAt': now.toISOString()
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
          value: value, // Discounted value from coupon
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
          value: recurringValue, // Full price for future months
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
        value: recurringValue,
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
  console.log('>>> Status:', event.payment?.status);

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
        console.log(`>>> Payment refunded: ${event.payment?.id}`);
        break;
      case 'SUBSCRIPTION_CREATED':
        console.log(`>>> Subscription created: ${event.subscription?.id}`);
        break;
      case 'SUBSCRIPTION_RENEWED':
        console.log(`>>> Subscription renewed: ${event.subscription?.id}`);
        break;
      case 'SUBSCRIPTION_CANCELED':
        console.log(`>>> Subscription canceled: ${event.subscription?.id}`);
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
    res.status(500).json({
      error: 'Erro ao buscar pagamentos.',
      details: error.response?.data
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

// ========================================
// PLUGGY OPEN FINANCE INTEGRATION
// ========================================
router.use('/pluggy', pluggyRouter);

// ========================================
// CRON JOB - AUTOMATIC SYNC
// ========================================
router.use('/cron/sync', cronSyncRouter);

export default router;
