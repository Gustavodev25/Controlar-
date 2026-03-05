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
import { requireFirebaseAuth, getRequesterIsAdmin } from './authMiddleware.js';
import { loadEnv } from './env.js';
import { sendSaleToUtmify, sendRefundToUtmify } from './utmifyService.js';
loadEnv();
const router = express.Router();
router.use(cors());
router.use(express.urlencoded({ extended: false, limit: '50mb' }));
router.use(express.json({ limit: '50mb' }));
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
const otpStore = new Map();
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
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Formato de email inválido.' });
  }
  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 15 * 60 * 1000;
    otpStore.set(email.toLowerCase(), { code, expires });
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
<tr>
<td align="left" style="padding: 24px 32px; background-color: #333432; border-bottom: 1px solid #373734;">
<div style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 24px; font-weight: bold; color: #ffffff; letter-spacing: -0.025em;">
Controlar<span style="color: #d97757;">+</span>
</div>
</td>
</tr>
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
<div style="text-align: center; margin: 32px 0;">
<div style="display: inline-block; background: linear-gradient(135deg, #363735 0%, #30302E 100%); padding: 20px 40px; border-radius: 12px; border: 1px solid #4a4a48;">
<span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #d97757; font-family: 'Courier New', monospace;">${code}</span>
</div>
</div>
<p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 24px 0 0 0;">
Este código expira em <strong style="color: #ffffff;">15 minutos</strong>.
</p>
</td>
</tr>
<tr>
<td style="padding: 24px 32px; background-color: #333432; border-top: 1px solid #373734;">
<p style="color: #6b7280; font-size: 12px; text-align: center; margin: 0 0 8px 0;">
Se você não solicitou esta redefinição de senha, pode ignorar este email com segurança.
</p>
<p style="color: #4b5563; font-size: 11px; text-align: center; margin: 0;">
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
  const record = otpStore.get(normalizedEmail);
  if (!record || record.code !== code || record.expires < Date.now()) {
    return res.status(400).json({ error: 'Sessão inválida ou expirada. Solicite um novo código.' });
  }
  try {
    if (firebaseAuth) {
      const user = await firebaseAuth.getUserByEmail(email);
      await firebaseAuth.updateUser(user.uid, {
        password: newPassword
      });
      otpStore.delete(normalizedEmail);
      console.log(`>>> Password reset successful for ${email} via Firebase Admin`);
      return res.json({ success: true, message: 'Senha alterada com sucesso!' });
    }
    const firebaseApiKey = process.env.VITE_FIREBASE_API_KEY || 'AIzaSyBGhm5J90b4fVlhmyP7bhVPliQZmQUSmmo';
    const sendResetResponse = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${firebaseApiKey}`,
      {
        requestType: 'PASSWORD_RESET',
        email: email
      }
    );
    if (sendResetResponse.data.email) {
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
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'Usuário não encontrado. Verifique o email.' });
    }
    if (error.code === 'auth/invalid-password') {
      return res.status(400).json({ error: 'Senha inválida. A senha deve ter pelo menos 6 caracteres.' });
    }
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
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
const fromNumber = process.env.TWILIO_PHONE_NUMBER || 'whatsapp:+14155238886';
let client;
try {
  if (accountSid && authToken) {
    client = twilio(accountSid, authToken);
  }
} catch (e) {
  console.error('Twilio init error:', e);
}
const claude = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;
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
router.post('/gemini', geminiHandler);
router.post('/claude', claudeHandler);
const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
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
router.post('/admin/send-email', requireFirebaseAuth, getRequesterIsAdmin, async (req, res) => {
  const {
    recipients,
    subject,
    title,
    body,
    boxContent,
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
<table width="500" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #30302E; border: 1px solid #373734; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); border-collapse: separate; mso-border-radius-alt: 16px;">
<tr>
<td align="${hAlign === 'justify' ? 'left' : hAlign}" style="padding: 24px 32px; background-color: transparent; border-bottom: 1px solid #373734; text-align: ${hAlign === 'justify' ? 'left' : hAlign};">
<div style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 24px; font-weight: bold; color: #ffffff; letter-spacing: -0.025em; line-height: 1; display: inline-block;">
Controlar<span style="color: #d97757;">+</span>
</div>
</td>
</tr>
<tr>
<td style="padding: 40px 32px; background-color: #30302E;">
<h1 style="margin: 0 0 8px 0; color: #ffffff; font-size: 24px; font-weight: bold; line-height: 1.25; text-align: ${tAlign};">
${title || 'Título da Mensagem'}
</h1>
<div style="color: #d1d5db; font-size: 16px; line-height: 1.6; text-align: ${bAlign};">
${(body || '').replace(/\n/g, '<br/>')}
</div>
${boxContent ? `
<div style="text-align: center; margin: 32px 0;">
<div style="display: inline-block; background: linear-gradient(135deg, #363735 0%, #30302E 100%); padding: 20px 40px; border-radius: 12px; border: 1px solid #4a4a48;">
<span style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #d97757; font-family: 'Courier New', monospace;">${boxContent}</span>
</div>
</div>
` : ''}
<div style="margin-top: 32px; text-align: center;">
<a href="${buttonLink}" target="_blank" style="display: inline-block; background-color: #d97757; color: #ffffff; font-weight: bold; padding: 12px 32px; border-radius: 9999px; text-decoration: none; box-shadow: 0 4px 6px -1px rgba(217, 119, 87, 0.2);">
${buttonText || 'Ver Agora'}
</a>
</div>
</td>
</tr>
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
    const batchSize = 10;
    const delayBetweenBatches = 2000;
    const batches = [];
    for (let i = 0; i < recipients.length; i += batchSize) {
      batches.push(recipients.slice(i, i + batchSize));
    }
    console.log(`>>> Starting batch email send. Total recipients: ${recipients.length}. Batches: ${batches.length}`);
    let successCount = 0;
    let failCount = 0;
    const failures = [];
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
      const results = await Promise.allSettled(batchPromises);
      results.forEach(r => {
        if (r.status === 'fulfilled') {
          successCount++;
        } else {
          failCount++;
          failures.push(r);
        }
      });
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
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = ASAAS_API_KEY && ASAAS_API_KEY.includes('hmlg')
  ? 'https://sandbox.asaas.com/api/v3'
  : 'https://www.asaas.com/api/v3';
const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
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
const createInvoice = async (paymentId) => {
  try {
    const invoiceData = {
      payment: paymentId,
      serviceDescription: 'Assinatura Controlar+ - Serviço de gestão financeira pessoal',
      observations: 'Obrigado por assinar o Controlar+!'
    };
    const invoice = await asaasRequest('POST', '/invoices', invoiceData);
    console.log(`>>> NFSe created: ${invoice.id} for payment ${paymentId}`);
    return invoice;
  } catch (error) {
    console.error('>>> NFSe creation error:', error.response?.data || error.message);
    return null;
  }
};
const saveInvoiceReference = async (userId, paymentId, invoice) => {
  if (!userId || !invoice || !firebaseAdmin) return;
  try {
    const db = firebaseAdmin.firestore();
    await db.collection('users').doc(userId).collection('invoices').doc(invoice.id).set({
      paymentId,
      asaasInvoiceId: invoice.id,
      invoiceNumber: invoice.number || null,
      invoiceUrl: invoice.pdfUrl || invoice.xmlUrl || null,
      status: invoice.status,
      value: invoice.value,
      createdAt: new Date().toISOString()
    });
    console.log(`>>> Invoice reference saved for user ${userId}`);
  } catch (error) {
    console.error('>>> Error saving invoice reference:', error.message);
  }
};
router.post('/asaas/customer', requireFirebaseAuth, async (req, res) => {
  const authUserId = req?.auth?.uid;
  if (!authUserId) {
    return res.status(401).json({ error: 'Usuário não autenticado.' });
  }
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
router.post('/asaas/subscription', requireFirebaseAuth, async (req, res) => {
  const authUserId = req?.auth?.uid;
  if (!authUserId) {
    return res.status(401).json({ error: 'Usuário não autenticado.' });
  }
  const {
    customerId,
    planId,
    billingCycle,
    creditCard,
    creditCardHolderInfo,
    installmentCount,
    couponId,
    utmData
  } = req.body;
  if (!customerId || !creditCard || !creditCardHolderInfo) {
    return res.status(400).json({ error: 'Dados incompletos para criar assinatura.' });
  }
  const activatePlanOnServer = async (uid, plan, cycle, paymentId, subId, customerId, couponId, status = 'active') => {
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
    const PLANS = {
      starter: { monthly: 0, annual: 0 },
      pro: { monthly: 35.90, annual: 399.00 },
      family: { monthly: 59.90, annual: 599.00 }
    };
    const selectedPlanConfig = PLANS[planId];
    if (!selectedPlanConfig) {
      return res.status(400).json({ error: 'Plano inválido selecionado.' });
    }
    const cycle = billingCycle === 'annual' ? 'YEARLY' : 'MONTHLY';
    const recurringValue = cycle === 'YEARLY' ? selectedPlanConfig.annual : selectedPlanConfig.monthly;
    let valueToCharge = recurringValue;
    if (couponId && firebaseAdmin) {
      try {
        const db = firebaseAdmin.firestore();
        const couponDoc = await db.collection('coupons').doc(couponId).get();
        if (couponDoc.exists) {
          const couponData = couponDoc.data();
          const maxUses = couponData.maxUses || Infinity;
          const currentUses = couponData.currentUses || 0;
          if (couponData.isActive && currentUses < maxUses) {
            console.log(`>>> [PRICING] Coupon ${couponId} loaded for server-side evaluation.`);
            if (couponData.type === 'percentage') {
              valueToCharge = recurringValue * (1 - (couponData.value / 100));
            } else if (couponData.type === 'fixed') {
              valueToCharge = recurringValue - couponData.value;
            } else if (couponData.type === 'progressive') {
              const firstDiscount = couponData.progressiveDiscounts?.find((d) => d.month === 1);
              if (firstDiscount) {
                if (firstDiscount.discountType === 'fixed') {
                  valueToCharge = recurringValue - firstDiscount.discount;
                } else {
                  valueToCharge = recurringValue * (1 - (firstDiscount.discount / 100));
                }
              }
            }
            console.log(`>>> [PRICING] Final valid price with coupon applied: R$ ${valueToCharge.toFixed(2)}`);
          } else {
            console.warn('>>> [PRICING] Coupon invalid or expired uses. Defaulting to full real price.');
          }
        }
      } catch (err) {
        console.error('>>> [PRICING] Error parsing coupon:', err);
      }
    }
    const value = Math.max(0, valueToCharge);
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dueDateStr = `${year}-${month}-${day}`;
    if (billingCycle === 'annual' && installmentCount && installmentCount > 1) {
      const valueToCharge = value;
      const sanitizedCardNumber = creditCard.number.replace(/\s/g, '');
      if (authUserId && firebaseAdmin) {
        try {
          const db = firebaseAdmin.firestore();
          await db.collection('users').doc(authUserId).update({
            'subscription.creditCardLast4': sanitizedCardNumber.slice(-4),
            'profile.subscription.creditCardLast4': sanitizedCardNumber.slice(-4)
          });
        } catch (dbError) {
          console.error('>>> [DB] Failed to save credit card info:', dbError);
        }
      }
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
          number: sanitizedCardNumber,
          expiryMonth: creditCard.expiryMonth,
          expiryYear: creditCard.expiryYear,
          ccv: creditCard.ccv || creditCard.cvv
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
        externalReference: `${authUserId}:${planId}_annual_${Date.now()}`
      };
      const payment = await asaasRequest('POST', '/payments', paymentData);
      if (payment.status === 'CONFIRMED' || payment.status === 'RECEIVED') {
        await activatePlanOnServer(authUserId, planId, cycle, payment.id, null, customerId, couponId);
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
      const hasDiscount = value < recurringValue;
      console.log(`>>> Creating subscription: originalValue=${recurringValue}, discountedValue=${value}, hasDiscount=${hasDiscount}`);
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
      if (hasDiscount) {
        console.log(`>>> Coupon detected! Creating single payment of R$ ${value} + subscription starting next month`);
        const sanitizedCardNumber = creditCard.number.replace(/\s/g, '');
        if (authUserId && firebaseAdmin) {
          try {
            const db = firebaseAdmin.firestore();
            await db.collection('users').doc(authUserId).update({
              'subscription.creditCardLast4': sanitizedCardNumber.slice(-4),
              'profile.subscription.creditCardLast4': sanitizedCardNumber.slice(-4)
            });
          } catch (dbError) {
            console.error('>>> [DB] Failed to save credit card info:', dbError);
          }
        }
        const paymentData = {
          customer: customerId,
          billingType: 'CREDIT_CARD',
          value: Math.round(value * 100) / 100,
          dueDate: dueDateStr,
          description: `Plano ${planId} - Primeira mensalidade (com desconto)`,
          remoteIp: getClientIp(req),
          externalReference: `${authUserId}:${planId}_first_${Date.now()}`,
          creditCard: {
            holderName: creditCard.holderName,
            number: sanitizedCardNumber,
            expiryMonth: creditCard.expiryMonth,
            expiryYear: creditCard.expiryYear,
            ccv: creditCard.ccv || creditCard.cvv
          },
          creditCardHolderInfo: {
            name: creditCardHolderInfo.name,
            email: creditCardHolderInfo.email,
            cpfCnpj: creditCardHolderInfo.cpfCnpj.replace(/\D/g, ''),
            postalCode: creditCardHolderInfo.postalCode.replace(/\D/g, ''),
            addressNumber: creditCardHolderInfo.addressNumber,
            phone: creditCardHolderInfo.phone?.replace(/\D/g, '') || undefined
          }
        };
        const firstPayment = await asaasRequest('POST', '/payments', paymentData);
        console.log(`>>> First payment created: ${firstPayment.id}, status: ${firstPayment.status}`);
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
        const subscriptionData = {
          customer: customerId,
          billingType: 'CREDIT_CARD',
          value: Math.round(recurringValue * 100) / 100,
          nextDueDate: getNextMonthDate(),
          cycle: cycle,
          description: `Plano ${planId} - ${cycle === 'YEARLY' ? 'Anual' : 'Mensal'}`,
          remoteIp: getClientIp(req),
          externalReference: `${authUserId}:${planId}_${cycle.toLowerCase()}_${Date.now()}`,
          creditCard: {
            holderName: creditCard.holderName,
            number: sanitizedCardNumber,
            expiryMonth: creditCard.expiryMonth,
            expiryYear: creditCard.expiryYear,
            ccv: creditCard.ccv || creditCard.cvv
          },
          creditCardHolderInfo: {
            name: creditCardHolderInfo.name,
            email: creditCardHolderInfo.email,
            cpfCnpj: creditCardHolderInfo.cpfCnpj.replace(/\D/g, ''),
            postalCode: creditCardHolderInfo.postalCode.replace(/\D/g, ''),
            addressNumber: creditCardHolderInfo.addressNumber,
            phone: creditCardHolderInfo.phone?.replace(/\D/g, '') || undefined
          }
        };
        let subscription = null;
        try {
          subscription = await asaasRequest('POST', '/subscriptions', subscriptionData);
          console.log(`>>> Subscription created: ${subscription.id}, starts: ${getNextMonthDate()}`);
        } catch (subError) {
          console.error(`>>> WARNING: Payment succeeded but Subscription failed:`, subError.message);
          subscription = { id: 'manual_recheck_needed_' + Date.now() };
        }
        await activatePlanOnServer(authUserId, planId, cycle, firstPayment.id, subscription?.id, customerId, couponId);
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
          subscription: subscription,
          status: 'CONFIRMED',
          message: 'Pagamento confirmado! Plano ativado.'
        });
      }
      const sanitizedCardNumber = creditCard.number.replace(/\s/g, '');
      if (authUserId && firebaseAdmin) {
        try {
          const db = firebaseAdmin.firestore();
          await db.collection('users').doc(authUserId).update({
            'subscription.creditCardLast4': sanitizedCardNumber.slice(-4),
            'profile.subscription.creditCardLast4': sanitizedCardNumber.slice(-4)
          });
        } catch (dbError) {
          console.error('>>> [DB] Failed to save credit card info:', dbError);
        }
      }
      const subscriptionData = {
        customer: customerId,
        billingType: 'CREDIT_CARD',
        value: Math.round(recurringValue * 100) / 100,
        nextDueDate: dueDateStr,
        cycle: cycle,
        description: `Plano ${planId} - ${cycle === 'YEARLY' ? 'Anual' : 'Mensal'}`,
        remoteIp: getClientIp(req),
        externalReference: `${authUserId}:${planId}_${cycle.toLowerCase()}_${Date.now()}`,
        creditCard: {
          holderName: creditCard.holderName,
          number: sanitizedCardNumber,
          expiryMonth: creditCard.expiryMonth,
          expiryYear: creditCard.expiryYear,
          ccv: creditCard.ccv || creditCard.cvv
        },
        creditCardHolderInfo: {
          name: creditCardHolderInfo.name,
          email: creditCardHolderInfo.email,
          cpfCnpj: creditCardHolderInfo.cpfCnpj.replace(/\D/g, ''),
          postalCode: creditCardHolderInfo.postalCode.replace(/\D/g, ''),
          addressNumber: creditCardHolderInfo.addressNumber,
          phone: creditCardHolderInfo.phone?.replace(/\D/g, '') || undefined
        }
      };
      const subscription = await asaasRequest('POST', '/subscriptions', subscriptionData);
      console.log(`>>> Subscription created: ${subscription.id}, status: ${subscription.status}`);
      if (subscription.status === 'ACTIVE') {
        let firstPayment = null;
        try {
          const payments = await asaasRequest('GET', `/payments?subscription=${subscription.id}`);
          firstPayment = payments.data?.[0];
          console.log(`>>> First payment status: ${firstPayment?.status || 'processing'}`);
        } catch (e) {
          console.log('>>> Could not fetch payment details, but subscription is ACTIVE');
        }
        await activatePlanOnServer(authUserId, planId, cycle, firstPayment?.id, subscription.id, customerId, couponId);
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
router.post('/asaas/subscription/update-card', requireFirebaseAuth, async (req, res) => {
  const authUserId = req?.auth?.uid;
  if (!authUserId) {
    return res.status(401).json({ error: 'Usuário não autenticado.' });
  }
  const { subscriptionId, customerId, creditCard, creditCardHolderInfo } = req.body;
  if (!subscriptionId || !customerId || !creditCard || !creditCardHolderInfo) {
    return res.status(400).json({ error: 'Dados incompletos para atualização do cartão.' });
  }
  try {
    console.log(`>>> Updating card for subscription: ${subscriptionId}`);
    const sanitizedCardNumber = creditCard.number.replace(/\s/g, '');
    const updatedSub = await asaasRequest('POST', `/subscriptions/${subscriptionId}`, {
      creditCard: {
        holderName: creditCard.holderName,
        number: sanitizedCardNumber,
        expiryMonth: creditCard.expiryMonth,
        expiryYear: creditCard.expiryYear,
        ccv: creditCard.ccv || creditCard.cvv
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
    });
    console.log(`>>> [UPDATE CARD] Subscription ${subscriptionId} updated with new card.`);
    if (authUserId && firebaseAdmin) {
      try {
        const db = firebaseAdmin.firestore();
        const nowIso = new Date().toISOString();
        const last4 = sanitizedCardNumber.slice(-4);
        await db.collection('users').doc(authUserId).update({
          'subscription.creditCardLast4': last4,
          'subscription.updatedAt': nowIso,
          'profile.subscription.creditCardLast4': last4,
          'profile.subscription.updatedAt': nowIso,
          'profile.paymentMethodDetails.last4': last4
        });
      } catch (dbError) {
        console.error('>>> [DB] Failed to save updated card info:', dbError);
      }
    }
    return res.json({
      success: true,
      subscription: updatedSub,
      message: 'Cartão atualizado com sucesso!'
    });
  } catch (error) {
    console.error('>>> Update Card Error:', error.response?.data || error.message);
    const asaasErrors = error.response?.data?.errors;
    let errorMessage = 'Erro ao atualizar o cartão de crédito.';
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
        if (event.payment?.id && event.payment?.customer) {
          try {
            let userId = null;
            if (firebaseAdmin) {
              const db = firebaseAdmin.firestore();
              const snapshot = await db.collection('users')
                .where('subscription.asaasCustomerId', '==', event.payment.customer)
                .limit(1)
                .get();
              if (!snapshot.empty) {
                userId = snapshot.docs[0].id;
                const userDoc = snapshot.docs[0];
                const userData = userDoc.data();
                if (userData.subscription?.paymentFailedAt || userData.subscription?.graceUntil) {
                  await userDoc.ref.update({
                    'subscription.paymentFailedAt': null,
                    'subscription.graceUntil': null,
                    'subscription.paymentFailureReason': null,
                    'subscription.status': 'active',
                    'profile.subscription.paymentFailedAt': null,
                    'profile.subscription.graceUntil': null,
                    'profile.subscription.paymentFailureReason': null,
                    'profile.subscription.status': 'active'
                  });
                  console.log(`>>> Cleared payment failure flags for user ${userId} - access restored!`);
                }
              }
            }
            const invoice = await createInvoice(event.payment.id);
            if (invoice && userId) {
              await saveInvoiceReference(userId, event.payment.id, invoice);
              console.log(`>>> NFSe emitida automaticamente para pagamento ${event.payment.id}`);
            }
          } catch (invoiceError) {
            console.error('>>> NFSe auto-creation error (non-blocking):', invoiceError.message);
          }
        }
        break;
      case 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED':
        console.log(`>>> Payment card refused: ${event.payment?.id}`);
        if (event.payment?.customer && firebaseAdmin) {
          try {
            const db = firebaseAdmin.firestore();
            const snapshot = await db.collection('users')
              .where('subscription.asaasCustomerId', '==', event.payment.customer)
              .limit(1)
              .get();
            if (!snapshot.empty) {
              const userDoc = snapshot.docs[0];
              const now = new Date().toISOString();
              const specificReason = event.payment?.creditCard?.acquirerReturnCode || 'CARD_REFUSED';
              await userDoc.ref.update({
                'subscription.paymentFailedAt': now,
                'subscription.paymentFailureReason': specificReason,
                'profile.subscription.paymentFailedAt': now,
                'profile.subscription.paymentFailureReason': specificReason
              });
              console.log(`>>> Marked user ${userDoc.id} with payment failure (${specificReason})`);
            }
          } catch (err) {
            console.error('>>> Error marking payment failure:', err.message);
          }
        }
        break;
      case 'PAYMENT_OVERDUE':
        console.log(`>>> Payment overdue: ${event.payment?.id}`);
        if (event.payment?.customer && firebaseAdmin) {
          try {
            const db = firebaseAdmin.firestore();
            const snapshot = await db.collection('users')
              .where('subscription.asaasCustomerId', '==', event.payment.customer)
              .limit(1)
              .get();
            if (!snapshot.empty) {
              const userDoc = snapshot.docs[0];
              const userData = userDoc.data();
              if (!userData.subscription?.paymentFailedAt) {
                const now = new Date();
                const graceUntil = new Date(now);
                graceUntil.setDate(graceUntil.getDate() + 7);
                await userDoc.ref.update({
                  'subscription.paymentFailedAt': now.toISOString(),
                  'subscription.graceUntil': graceUntil.toISOString(),
                  'subscription.paymentFailureReason': 'OVERDUE',
                  'profile.subscription.paymentFailedAt': now.toISOString(),
                  'profile.subscription.graceUntil': graceUntil.toISOString(),
                  'profile.subscription.paymentFailureReason': 'OVERDUE'
                });
                console.log(`>>> User ${userDoc.id} marked with OVERDUE, grace until: ${graceUntil.toISOString()}`);
              } else {
                console.log(`>>> User ${userDoc.id} already has paymentFailedAt set, skipping`);
              }
            }
          } catch (err) {
            console.error('>>> Error marking payment overdue:', err.message);
          }
        }
        break;
      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_REFUND_IN_PROGRESS':
      case 'PAYMENT_CHARGEBACK_REQUESTED':
      case 'PAYMENT_CHARGEBACK_DISPUTE':
        console.log(`>>> Payment refunded/chargeback: ${event.payment?.id}`);
        if (event.payment?.id) {
          try {
            await sendRefundToUtmify(event.payment.id);
          } catch (e) {
            console.error('>>> [UTMIFY] Error sending refund:', e);
          }
        }
        if (event.payment?.customer) {
          // Also cancel subscription in Asaas if linked to this payment
          if (event.payment?.subscription) {
            try {
              console.log(`>>> Cancelando assinatura relacionada ao estorno: ${event.payment.subscription}`);
              await asaasRequest('DELETE', `/subscriptions/${event.payment.subscription}`);
            } catch (subErr) {
              console.error(`>>> Erro ao cancelar assinatura no Asaas durante estorno:`, subErr.message);
            }
          }

          const revoked = await revokeUserPlanByCustomerId(event.payment.customer, 'canceled');
          if (revoked && firebaseAdmin) {
            try {
              const db = firebaseAdmin.firestore();
              const snap = await db.collection('users').where('subscription.asaasCustomerId', '==', event.payment.customer).get();
              snap.forEach(doc => {
                doc.ref.update({
                  'subscription.revokedReason': 'Refund/Estorno (Webhook)',
                  'subscription.revokedAt': new Date().toISOString(),
                  'profile.subscription.revokedReason': 'Refund/Estorno (Webhook)',
                  'profile.subscription.revokedAt': new Date().toISOString()
                });
              });
            } catch (err) {
              console.error('>>> Error updating refund reason:', err);
            }
          }
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
                const accessUntilDate = new Date(accessUntil);
                const now = new Date();
                if (now < accessUntilDate) {
                  console.log(`>>> User ${userDoc.id} has accessUntil ${accessUntil} - keeping plan active until then`);
                  await userDoc.ref.update({
                    'subscription.status': 'canceled',
                    'subscription.autoRenew': false,
                    'profile.subscription.status': 'canceled',
                    'profile.subscription.autoRenew': false
                  });
                } else {
                  console.log(`>>> User ${userDoc.id} accessUntil ${accessUntil} has passed - revoking now`);
                  const revoked = await revokeUserPlanBySubscriptionId(event.subscription.id, 'canceled');
                  console.log(`>>> Plan revocation result: ${revoked ? 'SUCCESS' : 'FAILED'}`);
                }
              } else {
                const revoked = await revokeUserPlanBySubscriptionId(event.subscription.id, 'canceled');
                console.log(`>>> Plan revocation result: ${revoked ? 'SUCCESS' : 'FAILED'}`);
              }
            } else {
              console.log(`>>> No user found with subscription ${event.subscription.id}`);
            }
          } catch (checkError) {
            console.error('>>> Error checking accessUntil:', checkError);
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
    const { customer, subscription, status, limit, offset, 'dueDate[ge]': dueDateGe, 'dueDate[le]': dueDateLe } = req.query;
    const params = new URLSearchParams();
    if (customer) params.append('customer', customer);
    if (subscription) params.append('subscription', subscription);
    if (status) params.append('status', status);
    if (limit) params.append('limit', limit);
    if (offset) params.append('offset', offset);
    if (dueDateGe) params.append('dueDate[ge]', dueDateGe);
    if (dueDateLe) params.append('dueDate[le]', dueDateLe);
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
router.post('/asaas/payment/:paymentId/pay-with-saved-card', requireFirebaseAuth, async (req, res) => {
  const { paymentId } = req.params;
  if (!firebaseAdmin) {
    return res.status(500).json({ error: 'Firestore não inicializado no servidor.' });
  }
  const targetUserId = req.body?.userId || req.auth?.uid;
  const { creditCard, creditCardHolderInfo } = req.body;
  if (!targetUserId) {
    return res.status(400).json({ error: 'userId é obrigatório.' });
  }
  if (!creditCard || !creditCardHolderInfo) {
    return res.status(400).json({
      error: 'Dados do cartão são obrigatórios para processar pagamento.',
      message: 'Envie creditCard e creditCardHolderInfo no body da requisição.'
    });
  }
  try {
    if (targetUserId !== req.auth?.uid) {
      const isAdmin = await getRequesterIsAdmin(req);
      if (!isAdmin) return res.status(403).json({ error: 'Acesso negado.' });
    }
    const db = firebaseAdmin.firestore();
    const userSnap = await db.collection('users').doc(targetUserId).get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    const userData = userSnap.data() || {};
    const subscription = userData.subscription || userData.profile?.subscription || {};
    const asaasCustomerId = subscription.asaasCustomerId;
    const payment = await asaasRequest('GET', `/payments/${paymentId}`);
    if (payment?.status && ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(payment.status)) {
      return res.status(409).json({ error: 'Este pagamento já está quitado.' });
    }
    if (payment?.billingType && payment.billingType !== 'CREDIT_CARD') {
      return res.status(409).json({ error: 'Este pagamento não é de cartão de crédito.' });
    }
    if (asaasCustomerId && payment?.customer && payment.customer !== asaasCustomerId) {
      const isAdmin = await getRequesterIsAdmin(req);
      if (!isAdmin) return res.status(403).json({ error: 'Pagamento não pertence ao cliente do usuário.' });
    }
    const sanitizedCardNumber = creditCard.number.replace(/\s/g, '');
    if (firebaseAdmin) {
      const updateData = {
        'subscription.creditCardLast4': sanitizedCardNumber.slice(-4),
        'profile.subscription.creditCardLast4': sanitizedCardNumber.slice(-4)
      };
      await db.collection('users').doc(targetUserId).set(updateData, { merge: true });
    }
    const result = await asaasRequest('POST', `/payments/${paymentId}/payWithCreditCard`, {
      creditCard: {
        holderName: creditCard.holderName,
        number: sanitizedCardNumber,
        expiryMonth: creditCard.expiryMonth,
        expiryYear: creditCard.expiryYear,
        ccv: creditCard.ccv || creditCard.cvv
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
    });
    res.json({ success: true, result });
  } catch (error) {
    const asaasErrors = error.response?.data?.errors;
    const errorMessage = asaasErrors?.length
      ? asaasErrors.map((e) => e.description).join('. ')
      : (error.response?.data?.message || error.message || 'Erro ao cobrar no cartão.');
    res.status(500).json({
      error: errorMessage,
      details: error.response?.data
    });
  }
});
router.post('/asaas/payment/:paymentId/refund', requireFirebaseAuth, async (req, res) => {
  const authUserId = req?.auth?.uid;
  if (!authUserId) {
    return res.status(401).json({ error: 'Usuário não autenticado.' });
  }
  const { paymentId } = req.params;
  const { value, description } = req.body;
  try {
    const payload = {
      value: value || undefined,
      description: description || 'Solicitado pelo cliente (15 dias)'
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
router.get('/asaas/invoices', async (req, res) => {
  try {
    const { customer, payment, status, limit, offset } = req.query;
    const params = new URLSearchParams();
    if (customer) params.append('customer', customer);
    if (payment) params.append('payment', payment);
    if (status) params.append('status', status);
    if (limit) params.append('limit', limit);
    if (offset) params.append('offset', offset);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const result = await asaasRequest('GET', `/invoices${queryString}`);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('>>> /asaas/invoices Error:', error.message);
    res.status(500).json({
      error: 'Erro ao buscar notas fiscais.',
      details: error.response?.data
    });
  }
});
router.get('/asaas/invoice/:invoiceId', async (req, res) => {
  const { invoiceId } = req.params;
  try {
    const invoice = await asaasRequest('GET', `/invoices/${invoiceId}`);
    res.json({ success: true, invoice });
  } catch (error) {
    console.error('>>> /asaas/invoice/:id Error:', error.message);
    res.status(500).json({
      error: 'Erro ao buscar nota fiscal.',
      details: error.response?.data
    });
  }
});
router.post('/asaas/invoice/create', requireFirebaseAuth, async (req, res) => {
  const authUserId = req?.auth?.uid;
  if (!authUserId) {
    return res.status(401).json({ error: 'Usuário não autenticado.' });
  }
  const { paymentId, userId } = req.body;
  if (!paymentId) {
    return res.status(400).json({ error: 'paymentId é obrigatório.' });
  }
  try {
    const invoice = await createInvoice(paymentId);
    if (!invoice) {
      return res.status(500).json({
        error: 'Erro ao criar nota fiscal. Verifique se a configuração fiscal está correta no Asaas.'
      });
    }
    if (userId) {
      await saveInvoiceReference(userId, paymentId, invoice);
    }
    res.json({ success: true, invoice });
  } catch (error) {
    console.error('>>> /asaas/invoice/create Error:', error.message);
    res.status(500).json({
      error: 'Erro ao criar nota fiscal.',
      details: error.response?.data
    });
  }
});
router.post('/admin/apply-coupons', requireFirebaseAuth, getRequesterIsAdmin, async (req, res) => {
  const { userIds, couponId, month } = req.body;
  if (!userIds || !Array.isArray(userIds) || !couponId) {
    return res.status(400).json({ error: 'Dados inválidos. userIds (array) e couponId são obrigatórios.' });
  }
  if (!firebaseAdmin) {
    return res.status(500).json({ error: 'Firebase não inicializado.' });
  }
  try {
    const db = firebaseAdmin.firestore();
    const couponDoc = await db.collection('coupons').doc(couponId).get();
    if (!couponDoc.exists) {
      return res.status(404).json({ error: 'Cupom não encontrado.' });
    }
    const coupon = { id: couponDoc.id, ...couponDoc.data() };
    let successCount = 0;
    let errorCount = 0;
    for (const userId of userIds) {
      try {
        const updatePayload = {
          'subscription.couponUsed': couponId,
          'profile.subscription.couponUsed': couponId
        };
        if (month) {
          updatePayload['subscription.couponStartMonth'] = month;
          updatePayload['profile.subscription.couponStartMonth'] = month;
        } else {
          updatePayload['subscription.couponStartMonth'] = firebaseAdmin.firestore.FieldValue.delete();
          updatePayload['profile.subscription.couponStartMonth'] = firebaseAdmin.firestore.FieldValue.delete();
        }
        await db.collection('users').doc(userId).update(updatePayload);
        if (month) {
          try {
            const userDoc = await db.collection('users').doc(userId).get();
            const user = userDoc.data();
            const subId = user?.subscription?.asaasSubscriptionId;
            if (subId) {
              const paymentsRes = await asaasRequest('GET', `/payments?subscription=${subId}&status=PENDING`);
              const payments = paymentsRes.data || [];
              const targetPayment = payments.find(p => p.dueDate && p.dueDate.startsWith(month));
              if (targetPayment) {
                let discountObj = null;
                if (coupon.type === 'percentage') {
                  discountObj = { value: coupon.value, type: 'PERCENTAGE' };
                } else if (coupon.type === 'fixed') {
                  discountObj = { value: coupon.value, type: 'FIXED' };
                }
                if (discountObj) {
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
router.post('/admin/cancel-plan', requireFirebaseAuth, async (req, res) => {
  const authUserId = req?.auth?.uid;
  if (!authUserId) {
    return res.status(401).json({ error: 'Usuário não autenticado.' });
  }
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
    if (asaasSubId && !asaasSubId.startsWith('manual_')) {
      try {
        await asaasRequest('DELETE', `/subscriptions/${asaasSubId}`);
        console.log(`>>> [ADMIN] Canceled Asaas subscription: ${asaasSubId}`);
      } catch (asaasError) {
        console.warn(`>>> [ADMIN] Failed to cancel Asaas subscription ${asaasSubId}:`, asaasError.message);
      }
    }
    const now = new Date().toISOString();
    let accessUntil = nextBillingDate;
    if (!accessUntil) {
      const fallbackDate = new Date();
      fallbackDate.setMonth(fallbackDate.getMonth() + 1);
      accessUntil = fallbackDate.toISOString().split('T')[0];
    }
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
router.post('/admin/revoke-plan', requireFirebaseAuth, getRequesterIsAdmin, async (req, res) => {
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
router.post('/admin/revoke-plan-by-customer', requireFirebaseAuth, getRequesterIsAdmin, async (req, res) => {
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
    const getPlanValue = (plan, billing) => {
      const prices = {
        pro: { monthly: 35.90, annual: 359.00 },
        premium: { monthly: 79.90, annual: 799.00 }
      };
      const planPrices = prices[plan] || prices.pro;
      return billing === 'annual' || billing === 'YEARLY' ? planPrices.annual : planPrices.monthly;
    };
    const value = req.body.value || getPlanValue(currentPlan, cycle);
    const asaasCycle = cycle === 'annual' || cycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY';
    const subscriptionData = {
      customer: asaasCustomerId,
      billingType: 'CREDIT_CARD',
      value: value,
      nextDueDate: getNextDueDate(),
      cycle: asaasCycle,
      description: `Plano ${currentPlan} - ${asaasCycle === 'YEARLY' ? 'Anual' : 'Mensal'} (Correção Admin)`,
      externalReference: `${userDoc.id}:${currentPlan}_${asaasCycle.toLowerCase()}_fix_${Date.now()}`
    };
    if (cardToken) {
      subscriptionData.creditCardToken = cardToken;
    }
    console.log(`>>> [ADMIN] Creating subscription for user ${userDoc.id}:`, subscriptionData);
    const newSubscription = await asaasRequest('POST', '/subscriptions', subscriptionData);
    console.log(`>>> [ADMIN] Subscription created: ${newSubscription.id}`);
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
    console.log(`>>> [ADMIN] User data keys:`, Object.keys(userData));
    console.log(`>>> [ADMIN] Profile keys:`, Object.keys(profile));
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
    let customerId = subscription.asaasCustomerId;
    if (!customerId) {
      const cleanCpf = cpf.replace(/\D/g, '');
      const searchResult = await asaasRequest('GET', `/customers?cpfCnpj=${cleanCpf}`);
      if (searchResult.data && searchResult.data.length > 0) {
        customerId = searchResult.data[0].id;
        console.log(`>>> Found existing Asaas customer: ${customerId}`);
      } else {
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
    const getNextDueDate = () => {
      if (subscription.nextBillingDate) {
        const existing = new Date(subscription.nextBillingDate);
        const today = new Date();
        if (existing > today) {
          return subscription.nextBillingDate;
        }
      }
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
    const subscriptionData = {
      customer: customerId,
      billingType: billingType,
      value: planValue,
      nextDueDate: nextDueDate,
      cycle: cycle,
      description: `Plano ${subscription.plan || 'pro'} - Mensal`,
      externalReference: `${userId}:${subscription.plan || 'pro'}_monthly_admin_${Date.now()}`
    };
    console.log(`>>> [ADMIN] Creating subscription for user ${userId}:`, subscriptionData);
    const newSubscription = await asaasRequest('POST', '/subscriptions', subscriptionData);
    console.log(`>>> [ADMIN] Subscription created: ${newSubscription.id}`);
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
router.use('/pluggy', pluggyRouter);
router.use('/cron/sync', cronSyncRouter);
router.get('/asaas/admin/stats', async (req, res) => {
  try {
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
        mrrGross += value / 12;
      } else if (sub.cycle === 'WEEKLY') {
        mrrGross += value * 4;
      }
    });
    const mrrNet = calculateNetValue(mrrGross, 1);
    let payments = [];
    offset = 0;
    hasMore = true;
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
    let totalRevenueGross = 0;
    payments.forEach(payment => {
      totalRevenueGross += payment.value || 0;
    });
    const totalRevenueNet = calculateNetValue(totalRevenueGross, 1);
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
router.post('/admin/send-email', requireFirebaseAuth, getRequesterIsAdmin, async (req, res) => {
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
<tr>
<td align="${headerAlign || 'left'}" style="padding: 24px 32px; background-color: #333432; border-bottom: 1px solid #373734;">
<div style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 24px; font-weight: bold; color: #ffffff; letter-spacing: -0.025em;">
Controlar<span style="color: #d97757;">+</span>
</div>
</td>
</tr>
<tr>
<td style="padding: 40px 32px;">
<h1 style="margin: 0 0 24px 0; color: #ffffff; font-size: 24px; font-weight: bold; text-align: ${titleAlign || 'left'};">
${title || 'Notificacao'}
</h1>
<div style="color: #d1d5db; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0; text-align: ${bodyAlign || 'left'}; white-space: pre-line;">
${body}
</div>
${buttonText && buttonLink ? `
<div style="text-align: center; margin: 32px 0;">
<a href="${buttonLink}" style="display: inline-block; background-color: #d97757; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
${buttonText}
</a>
</div>
` : ''}
</td>
</tr>
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
    const promises = recipients.map(email =>
      smtpTransporter.sendMail({
        from: process.env.SMTP_FROM || `"Controlar+" <${process.env.SMTP_USER}>`,
        to: email,
        subject: subject || 'Notificacao Controlar+',
        html: htmlTemplate,
        text: body
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
router.use('/pluggy', pluggyRouter);
router.use('/cron-sync', cronSyncRouter);
export default router;
