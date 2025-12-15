import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import twilio from 'twilio';
import { GoogleGenAI } from '@google/genai';
import axios from 'axios';
import geminiHandler from './gemini.js';
import claudeHandler from './claude.js';
import path from 'path';
import nodemailer from 'nodemailer';
import pluggyRouter from './pluggy.js';

// Explicitly load .env from root
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

// Firebase Admin - Only initialize if service account is provided
// For password reset, we'll use a different approach that doesn't require Admin SDK
let firebaseAdmin = null;
let firebaseAuth = null;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const admin = await import('firebase-admin');
    const { getAuth } = await import('firebase-admin/auth');

    if (!admin.default.apps.length) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.default.initializeApp({
        credential: admin.default.credential.cert(serviceAccount),
        projectId: process.env.VITE_FIREBASE_PROJECT_ID || "financeiro-609e1"
      });
      firebaseAdmin = admin.default;
      firebaseAuth = getAuth();
      console.log('>>> Firebase Admin Initialized with Service Account');
    }
  } else {
    console.log('>>> Firebase Admin: No service account provided, password reset will work without user verification');
  }
} catch (error) {
  console.error('>>> Firebase Admin Init Error:', error.message);
  console.log('>>> Continuing without Firebase Admin - password reset will still work');
}

const router = express.Router();

router.use(cors());
router.use(express.urlencoded({ extended: false, limit: '50mb' }));
router.use(express.json({ limit: '50mb' }));

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
    console.error('Reset Password Error:', error.response?.data || error.message);

    // If Firebase API fails, try to provide a helpful message
    const firebaseError = error.response?.data?.error;
    if (firebaseError?.message === 'EMAIL_NOT_FOUND') {
      return res.status(400).json({ error: 'Email não encontrado. Verifique se digitou corretamente.' });
    }

    res.status(500).json({ error: 'Erro ao redefinir senha.', details: error.message });
  }
});

// ===============================
// TWILIO + GEMINI (WhatsApp bot)
// ===============================
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
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

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL_NAME = 'gemini-1.5-flash';

async function generateResponse(text) {
  if (!ai) return 'Erro: API do Gemini nao configurada.';

  const todayStr = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const prompt = `
Hoje e: ${todayStr}.
Voce e o "Coinzinha", um assistente financeiro pessoal divertido, amigavel e inteligente.

O usuario enviou via WhatsApp: "${text}"

Objetivo:
1. Se for uma transacao (ex: "gastei 10 padaria"), responda confirmando com o valor e categoria de forma amigavel (nao precisa salvar).
2. Se for conversa, responda de forma curta e amigavel.
3. Use emojis.

Responda em portugues, texto curto.
`;

  try {
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt
    });
    return result.response.text() || result.text;
  } catch (e) {
    console.error('Gemini Error:', e);
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
    console.log(`Gemini Reply: ${replyText}`);

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
<body style="margin: 0; padding: 0; background-color: #1a1a1a; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #d1d5db;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #1a1a1a; padding: 40px 0;">
    <tr>
      <td align="center">
        <!-- Largura alterada para 500 e cores ajustadas para o tema do exemplo 2 -->
        <table width="500" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #30302E; border: 1px solid #373734; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); border-collapse: separate; mso-border-radius-alt: 16px;">
          
          <!-- Header (Estilo visual do exemplo 2, mas com alinhamento variável do exemplo 1) -->
          <tr>
            <td align="${hAlign === 'justify' ? 'left' : hAlign}" style="padding: 24px 32px; background-color: #333432; border-bottom: 1px solid #373734; text-align: ${hAlign === 'justify' ? 'left' : hAlign};">
              <div style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 24px; font-weight: bold; color: #ffffff; letter-spacing: -0.025em; line-height: 1; display: inline-block;">
                Controlar<span style="color: #d97757;">+</span>
              </div>
            </td>
          </tr>

          <!-- Content (Padding e cores do exemplo 2) -->
          <tr>
            <td style="padding: 40px 32px; background-color: #30302E;">
              <h1 style="margin: 0 0 24px 0; color: #ffffff; font-size: 24px; font-weight: bold; line-height: 1.25; text-align: ${tAlign};">
                ${title || 'Título da Mensagem'}
              </h1>

              <div style="color: #d1d5db; font-size: 16px; line-height: 1.6; white-space: pre-wrap; text-align: ${bAlign};">
                ${(body || '').replace(/\n/g, '<br/>')}
              </div>

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
            <td align="center" style="padding: 24px 32px; background-color: #333432; border-top: 1px solid #373734; color: #6b7280; font-size: 12px;">
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

router.post('/asaas/subscription', async (req, res) => {
  const {
    customerId,
    planId,
    billingCycle,
    value,
    creditCard,
    creditCardHolderInfo,
    installmentCount
  } = req.body;

  if (!customerId || !value || !creditCard || !creditCardHolderInfo) {
    return res.status(400).json({ error: 'Dados incompletos para criar assinatura.' });
  }

  try {
    const cycle = billingCycle === 'annual' ? 'YEARLY' : 'MONTHLY';

    // Use current date for immediate charge attempt (robust format YYYY-MM-DD)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dueDateStr = `${year}-${month}-${day}`;

    if (billingCycle === 'annual' && installmentCount && installmentCount > 1) {
      const paymentData = {
        customer: customerId,
        billingType: 'CREDIT_CARD',
        value: value,
        dueDate: dueDateStr,
        description: `Plano ${planId} - Anual (${installmentCount}x)`,
        installmentCount: installmentCount,
        installmentValue: Math.round((value / installmentCount) * 100) / 100,
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
        remoteIp: req.ip,
        externalReference: `${planId}_annual_${Date.now()}`
      };

      const payment = await asaasRequest('POST', '/payments', paymentData);

      if (payment.status === 'CONFIRMED' || payment.status === 'RECEIVED') {
        return res.json({
          success: true,
          payment,
          status: 'CONFIRMED',
          message: 'Pagamento confirmado com sucesso!'
        });
      } else {
        // Reject PENDING, REFUSED, or any other non-confirmed status
        // This ensures the card was actually validated and charged
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
      const subscriptionData = {
        customer: customerId,
        billingType: 'CREDIT_CARD',
        value: value,
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
        remoteIp: req.ip,
        externalReference: `${planId}_${cycle.toLowerCase()}_${Date.now()}`
      };

      const subscription = await asaasRequest('POST', '/subscriptions', subscriptionData);

      const payments = await asaasRequest('GET', `/payments?subscription=${subscription.id}`);
      const firstPayment = payments.data?.[0];

      if (firstPayment && (firstPayment.status === 'CONFIRMED' || firstPayment.status === 'RECEIVED')) {
        return res.json({
          success: true,
          subscription,
          payment: firstPayment,
          status: 'CONFIRMED',
          message: 'Assinatura criada e pagamento confirmado!'
        });
      } else {
        // Reject any status that is not CONFIRMED or RECEIVED
        // This includes PENDING - we need immediate card validation
        const paymentStatus = firstPayment?.status || 'NO_PAYMENT';
        const errorMsg = paymentStatus === 'PENDING'
          ? 'Pagamento não pôde ser processado. Verifique os dados do cartão e tente novamente.'
          : paymentStatus === 'REFUSED'
            ? 'Cartão recusado. Verifique os dados ou tente outro cartão.'
            : `Não foi possível processar o pagamento (${paymentStatus}). Verifique os dados do cartão.`;

        // Cancel the subscription since payment failed
        try {
          await asaasRequest('DELETE', `/subscriptions/${subscription.id}`);
          console.log(`>>> Subscription ${subscription.id} cancelled due to failed payment`);
        } catch (cancelError) {
          console.error('>>> Error cancelling subscription:', cancelError.message);
        }

        return res.status(400).json({
          success: false,
          subscription,
          status: paymentStatus,
          error: errorMsg
        });
      }
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

// ========================================
// PLUGGY OPEN FINANCE INTEGRATION
// ========================================
router.use('/pluggy', pluggyRouter);

export default router;
