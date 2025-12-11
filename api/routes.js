import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import twilio from 'twilio';
import { GoogleGenAI } from '@google/genai';
import axios from 'axios';
import geminiHandler from './gemini.js';
import path from 'path';


// Explicitly load .env from root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const router = express.Router();

router.use(cors());
router.use(express.urlencoded({ extended: false, limit: '50mb' }));
router.use(express.json({ limit: '50mb' }));



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
  console.error("Twilio init error:", e);
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL_NAME = "gemini-1.5-flash";

async function generateResponse(text) {
  if (!ai) return "Erro: API do Gemini nao configurada.";

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
    console.error("Gemini Error:", e);
    return "Opa, tive um problema aqui. Pode repetir?";
  }
}

// WhatsApp webhook
router.post('/whatsapp', async (req, res) => {
  const { Body, From } = req.body;
  console.log(`Mensagem de ${From}: ${Body}`);

  if (Body?.toLowerCase().includes('join')) {
    const welcomeMsg = "Conectado ao Coinzinha! Pode falar comigo. Ex: 'Gastei 50 reais no mercado'.";

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
    const replyText = await generateResponse(Body);
    console.log(`Gemini Reply: ${replyText}`);

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

// Gemini proxy endpoint
router.post('/gemini', geminiHandler);

// Email Sending Endpoint (Nodemailer)
import nodemailer from 'nodemailer';

// Remove spaces from password if present (common when copying from Google)
const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

const smtpConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: smtpPass,
  },
  // Disable debug logs
  logger: false,
  debug: false,
};

const smtpTransporter = nodemailer.createTransport(smtpConfig);

// Verify connection configuration
smtpTransporter.verify(function (error, success) {
  if (error) {
    console.error('>>> SMTP Connection Error:', error);
  }
});

router.post('/admin/send-email', async (req, res) => {
  const { recipients, subject, title, body, buttonText, buttonLink, headerAlign, titleAlign, bodyAlign } = req.body;

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'Nenhum destinatário selecionado.' });
  }

  // HTML Template - Pixel Perfect Match with AdminEmailMessage.tsx
  // Theme: Dark Mode (Custom Colors)
  // Header/Footer: #363735
  // Content: #262624
  // Text: White (#ffffff) & Gray-300 (#d1d5db)

  // Alignment Defaults
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
        /* Reset for email clients */
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table,td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; }
      </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #111827; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #d1d5db;">
      
      <!-- Outer Page Background (Dark) -->
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #111827; padding: 40px 0;">
        <tr>
          <td align="center">
            
            <!-- Main Card Container -->
            <!-- Width: 600px, rounded-lg (8px), border-gray-700 (#374151) -->
            <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #262624; border: 1px solid #374151; border-radius: 8px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); border-collapse: separate; mso-border-radius-alt: 8px;">
              
              <!-- Header -->
              <!-- bg-[#363735], p-6 (24px), border-b-gray-700 -->
              <tr>
                <td align="${hAlign === 'justify' ? 'center' : hAlign}" style="padding: 24px; background-color: #363735; border-bottom: 1px solid #374151; text-align: ${hAlign === 'justify' ? 'center' : hAlign};">
                  <!-- Logo Text Replication -->
                  <div style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 24px; font-weight: bold; color: #ffffff; letter-spacing: -0.025em; line-height: 1; display: inline-block;">
                    Controlar<span style="color: #d97757;">+</span>
                  </div>
                </td>
              </tr>

              <!-- Content -->
              <!-- bg-[#262624], p-8 (32px) -->
              <tr>
                <td style="padding: 32px; background-color: #262624;">
                  
                  <!-- Title -->
                  <!-- text-2xl (24px), font-bold, text-white, mb-6 (24px) -->
                  <h1 style="margin: 0 0 24px 0; color: #ffffff; font-size: 24px; font-weight: bold; line-height: 1.25; text-align: ${tAlign};">
                    ${title || 'Novidades do Controlar+'}
                  </h1>
                  
                  <!-- Body -->
                  <!-- text-gray-300 (#d1d5db), leading-relaxed (1.625) -->
                  <div style="color: #d1d5db; font-size: 16px; line-height: 1.625; white-space: pre-wrap; text-align: ${bAlign};">
                    ${(body || '').replace(/\n/g, '<br/>')}
                  </div>

                  <!-- CTA Button -->
                  <!-- mt-8 (32px), center -->
                  <div style="margin-top: 32px; text-align: center;">
                    <!-- bg-[#d97757], text-white, font-bold, py-3 (12px) px-8 (32px), rounded-full -->
                    <a href="${buttonLink}" target="_blank" style="display: inline-block; background-color: #d97757; color: #ffffff; font-weight: bold; padding: 12px 32px; border-radius: 9999px; text-decoration: none; box-shadow: 0 4px 6px -1px rgba(217, 119, 87, 0.2);">
                      ${buttonText || 'Ver Agora'}
                    </a>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <!-- bg-[#363735], p-6 (24px), border-t-gray-700 -->
              <tr>
                <td align="center" style="padding: 24px; background-color: #363735; border-top: 1px solid #374151; color: #6b7280; font-size: 12px;">
                  <p style="margin: 0;">© ${new Date().getFullYear()} Controlar+. Todos os direitos reservados.</p>
                  <p style="margin: 8px 0 0 0;">
                    <a href="#" style="color: #9ca3af; text-decoration: underline;">Descadastrar</a> • 
                    <a href="#" style="color: #9ca3af; text-decoration: underline; margin-left: 8px;">Política de Privacidade</a>
                  </p>
                </td>
              </tr>

            </table>
            <!-- End Card -->

          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    const sendPromises = recipients.map(email => {
      return smtpTransporter.sendMail({
        from: process.env.SMTP_FROM || `"Controlar+" <${process.env.SMTP_USER}>`,
        to: email,
        subject: subject,
        html: htmlTemplate,
        text: body
      });
    });

    const results = await Promise.allSettled(sendPromises);

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failures = results.filter(r => r.status === 'rejected');
    const failCount = failures.length;

    console.log(`>>> Email Campaign Sent: ${successCount} success, ${failCount} failed.`);

    if (failCount > 0) {
      console.error(">>> First failure reason:", failures[0].reason);
    }

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
const ASAAS_API_URL = 'https://sandbox.asaas.com/api/v3';

// Helper: Make Asaas API request
const asaasRequest = async (method, endpoint, data = null) => {
  const config = {
    method,
    url: `${ASAAS_API_URL}${endpoint}`,
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    },
  };

  if (data) {
    config.data = data;
  }

  console.log(`>>> ASAAS ${method.toUpperCase()} ${endpoint}`);

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error('>>> ASAAS Error:', error.response?.data || error.message);
    throw error;
  }
};

// 1. Create or Update Customer in Asaas
router.post('/asaas/customer', async (req, res) => {
  const { name, email, cpfCnpj, phone, postalCode, addressNumber } = req.body;

  if (!name || !email || !cpfCnpj) {
    return res.status(400).json({ error: 'Nome, email e CPF/CNPJ são obrigatórios.' });
  }

  try {
    const searchResult = await asaasRequest('GET', `/customers?cpfCnpj=${cpfCnpj.replace(/\D/g, '')}`);

    let customer;

    if (searchResult.data && searchResult.data.length > 0) {
      customer = searchResult.data[0];
      console.log(`>>> Found existing customer: ${customer.id}`);

      const updateData = {
        name,
        email,
        phone: phone?.replace(/\D/g, '') || undefined,
        postalCode: postalCode?.replace(/\D/g, '') || undefined,
        addressNumber: addressNumber || undefined,
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
        notificationDisabled: false,
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

// 2. Create Subscription with Credit Card
router.post('/asaas/subscription', async (req, res) => {
  const {
    customerId,
    planId,
    billingCycle,
    value,
    creditCard,
    creditCardHolderInfo,
    installmentCount,
    couponId
  } = req.body;

  if (!customerId || !value || !creditCard || !creditCardHolderInfo) {
    return res.status(400).json({ error: 'Dados incompletos para criar assinatura.' });
  }

  try {
    const cycle = billingCycle === 'annual' ? 'YEARLY' : 'MONTHLY';
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1);
    const dueDateStr = nextDueDate.toISOString().split('T')[0];

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
          ccv: creditCard.ccv,
        },
        creditCardHolderInfo: {
          name: creditCardHolderInfo.name,
          email: creditCardHolderInfo.email,
          cpfCnpj: creditCardHolderInfo.cpfCnpj.replace(/\D/g, ''),
          postalCode: creditCardHolderInfo.postalCode.replace(/\D/g, ''),
          addressNumber: creditCardHolderInfo.addressNumber,
          phone: creditCardHolderInfo.phone?.replace(/\D/g, '') || undefined,
        },
        remoteIp: req.ip,
        externalReference: `${planId}_annual_${Date.now()}`,
      };

      console.log('>>> Creating installment payment:', JSON.stringify(paymentData, null, 2));

      const payment = await asaasRequest('POST', '/payments', paymentData);

      console.log('>>> Payment created:', payment.id, payment.status);

      if (payment.status === 'CONFIRMED' || payment.status === 'RECEIVED') {
        return res.json({
          success: true,
          payment,
          status: 'CONFIRMED',
          message: 'Pagamento confirmado com sucesso!'
        });
      } else if (payment.status === 'PENDING') {
        return res.json({
          success: true,
          payment,
          status: 'PENDING',
          message: 'Pagamento em processamento. Aguarde a confirmação.'
        });
      } else {
        return res.status(400).json({
          success: false,
          payment,
          status: payment.status,
          error: 'Pagamento não foi aprovado. Verifique os dados do cartão.'
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
          ccv: creditCard.ccv,
        },
        creditCardHolderInfo: {
          name: creditCardHolderInfo.name,
          email: creditCardHolderInfo.email,
          cpfCnpj: creditCardHolderInfo.cpfCnpj.replace(/\D/g, ''),
          postalCode: creditCardHolderInfo.postalCode.replace(/\D/g, ''),
          addressNumber: creditCardHolderInfo.addressNumber,
          phone: creditCardHolderInfo.phone?.replace(/\D/g, '') || undefined,
        },
        remoteIp: req.ip,
        externalReference: `${planId}_${cycle.toLowerCase()}_${Date.now()}`,
      };

      console.log('>>> Creating subscription:', JSON.stringify(subscriptionData, null, 2));

      const subscription = await asaasRequest('POST', '/subscriptions', subscriptionData);

      console.log('>>> Subscription created:', subscription.id, subscription.status);

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
      } else if (subscription.status === 'ACTIVE' || firstPayment?.status === 'PENDING') {
        return res.json({
          success: true,
          subscription,
          payment: firstPayment,
          status: 'PENDING',
          message: 'Assinatura criada. Pagamento em processamento.'
        });
      } else {
        return res.status(400).json({
          success: false,
          subscription,
          status: subscription.status,
          error: 'Não foi possível processar o pagamento. Verifique os dados do cartão.'
        });
      }
    }
  } catch (error) {
    console.error('>>> Subscription error:', error.response?.data || error.message);

    const asaasErrors = error.response?.data?.errors;
    let errorMessage = 'Erro ao processar pagamento.';

    if (asaasErrors && asaasErrors.length > 0) {
      errorMessage = asaasErrors.map(e => e.description).join('. ');
    }

    res.status(500).json({
      error: errorMessage,
      details: error.response?.data
    });
  }
});

// 3. Webhook to receive payment confirmations
router.post('/asaas/webhook', async (req, res) => {
  const event = req.body;

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

// 4. Cancel Subscription
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

// 5. Get Payment Status
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

const PLUGGY_CLIENT_ID = 'd93b0176-0cd8-4563-b9c1-bcb9c6e510bd';
const PLUGGY_CLIENT_SECRET = '2b45852a-9638-4677-8232-6b2da7c54967';
const PLUGGY_API_URL = 'https://api.pluggy.ai';
const NGROK_URL = 'https://toney-nonreversing-cedrick.ngrok-free.dev';

// Helper: Get Pluggy API Key (valid 2 hours)
const getPluggyApiKey = async () => {
  console.log('>>> Pluggy Auth - ClientID:', PLUGGY_CLIENT_ID);
  console.log('>>> Pluggy Auth - Secret:', PLUGGY_CLIENT_SECRET?.substring(0, 8) + '...');
  try {
    const response = await axios.post(`${PLUGGY_API_URL}/auth`, {
      clientId: PLUGGY_CLIENT_ID,
      clientSecret: PLUGGY_CLIENT_SECRET
    });
    console.log('>>> Pluggy Auth Success - API Key obtained');
    return response.data.apiKey;
  } catch (error) {
    console.error('>>> Pluggy Auth Error:', error.response?.data || error.message);
    throw error;
  }
};

// Helper: Make Pluggy API request
const pluggyRequest = async (method, endpoint, apiKey, data = null) => {
  const config = {
    method,
    url: `${PLUGGY_API_URL}${endpoint}`,
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    },
  };

  if (data) {
    config.data = data;
  }

  console.log(`>>> PLUGGY ${method.toUpperCase()} ${endpoint}`);

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error('>>> Pluggy Request Error:', error.response?.data || error.message);
    throw error;
  }
};

// Helper: Fetch Pluggy items, optionally filtered by clientUserId
const getPluggyItems = async (apiKey, userId = null) => {
  const endpoint = userId
    ? `/items?clientUserId=${encodeURIComponent(userId)}&pageSize=200`
    : '/items';

  const response = await pluggyRequest('GET', endpoint, apiKey);
  const results = response.results || [];

  // Defensive filter in case Pluggy ignores query param
  if (userId) {
    return results.filter(item => item.clientUserId === userId);
  }

  return results;
};

// Helper: Normalize Pluggy item for frontend consumption
const mapPluggyItem = (item) => ({
  id: item.id,
  clientUserId: item.clientUserId,
  connector: item.connector
    ? { name: item.connector.name, imageUrl: item.connector.imageUrl }
    : null,
  status: item.status,
  executionStatus: item.executionStatus,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

// Helper: Map Pluggy category to app category
const mapPluggyCategory = (pluggyCategory, description) => {
  const categoryMap = {
    'Transfer': 'Transferência',
    'Shopping': 'Compras',
    'Food': 'Alimentação',
    'Transport': 'Transporte',
    'Health': 'Saúde',
    'Education': 'Educação',
    'Entertainment': 'Lazer',
    'Bills': 'Contas',
    'Other': 'Outros',
    'Income': 'Salário',
    'Investment': 'Investimentos',
  };

  // Try to match by Pluggy category
  for (const [key, value] of Object.entries(categoryMap)) {
    if (pluggyCategory?.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  // Fallback based on description keywords
  const desc = (description || '').toLowerCase();
  if (desc.includes('salario') || desc.includes('salário') || desc.includes('pagamento')) return 'Salário';
  if (desc.includes('pix') || desc.includes('ted') || desc.includes('transferencia')) return 'Transferência';
  if (desc.includes('supermercado') || desc.includes('mercado') || desc.includes('ifood')) return 'Alimentação';
  if (desc.includes('uber') || desc.includes('99') || desc.includes('combustivel')) return 'Transporte';
  if (desc.includes('netflix') || desc.includes('spotify') || desc.includes('cinema')) return 'Lazer';

  return 'Outros';
};

// 1. Create Connect Token for frontend widget
router.post('/pluggy/create-token', async (req, res) => {
  const { userId } = req.body;

  if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Pluggy credentials not configured.' });
  }

  try {
    // Get API Key first
    const apiKey = await getPluggyApiKey();
    console.log('>>> Pluggy API Key obtained');

    // Fetch existing items for this user to help frontend avoid duplicate attempts
    let existingItems = [];
    if (userId) {
      try {
        const userItems = await getPluggyItems(apiKey, userId);
        existingItems = userItems.map(mapPluggyItem);

        if (existingItems.length > 0) {
          console.log(`>>> Found ${existingItems.length} existing Pluggy item(s) for user ${userId}`);
        }
      } catch (err) {
        console.error('>>> Pluggy existing items lookup failed:', err.response?.data || err.message);
      }
    }

    // Create Connect Token
    const connectTokenResponse = await pluggyRequest('POST', '/connect_token', apiKey, {
      clientUserId: userId || 'anonymous',
      webhookUrl: `${NGROK_URL}/api/pluggy/webhook`,
      options: {
        avoidDuplicates: true
      }
    });

    console.log('>>> Connect Token created:', connectTokenResponse.accessToken?.substring(0, 20) + '...');

    res.json({
      success: true,
      accessToken: connectTokenResponse.accessToken,
      existingItems
    });
  } catch (error) {
    console.error('>>> Create Token Error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Erro ao criar token de conexão.',
      details: error.response?.data?.message || error.message
    });
  }
});

// 2. Sync transactions from connected item
router.post('/pluggy/sync', async (req, res) => {
  const { itemId, userId } = req.body;

  if (!itemId || !userId) {
    return res.status(400).json({ error: 'itemId e userId são obrigatórios.' });
  }

  try {
    const apiKey = await getPluggyApiKey();
    console.log(`>>> Starting sync for item ${itemId}, user ${userId}`);

    // Get item details
    const item = await pluggyRequest('GET', `/items/${itemId}`, apiKey);
    const connectorName = item.connector?.name || 'Banco';
    console.log(`>>> Item connector: ${connectorName}`);

    // Get accounts for this item
    const accountsResponse = await pluggyRequest('GET', `/accounts?itemId=${itemId}`, apiKey);
    const accounts = accountsResponse.results || [];
    console.log(`>>> Found ${accounts.length} accounts`);

    const syncResults = {
      accounts: [],
      transactions: {
        checking: [],
        creditCard: [],
        counts: {
          checking: 0,
          creditCard: 0,
          total: 0
        }
      }
    };

    // Process each account
    for (const account of accounts) {
      const accountType = account.type; // BANK or CREDIT
      const accountSubtype = account.subtype; // CHECKING_ACCOUNT, SAVINGS_ACCOUNT, CREDIT_CARD
      const isCreditCard = accountType === 'CREDIT' || accountSubtype === 'CREDIT_CARD';

      console.log(`>>> Processing account: ${account.name} (${accountType}/${accountSubtype})`);

      // Build account data for Firebase
      const connectedAccount = {
        id: account.id,
        itemId: itemId,
        name: account.name || account.marketingName || 'Conta',
        type: accountType,
        subtype: accountSubtype,
        institution: connectorName,
        balance: account.balance || 0,
        currency: account.currencyCode || 'BRL',
        lastUpdated: new Date().toISOString(),
        connectionMode: 'AUTO'
      };

      // Add credit card specific data
      if (isCreditCard && account.creditData) {
        connectedAccount.creditLimit = account.creditData.creditLimit || 0;
        connectedAccount.availableCreditLimit = account.creditData.availableCreditLimit || 0;
        connectedAccount.brand = account.creditData.brand || '';
        connectedAccount.balanceCloseDate = account.creditData.balanceCloseDate || null;
        connectedAccount.balanceDueDate = account.creditData.balanceDueDate || null;
        connectedAccount.minimumPayment = account.creditData.minimumPayment || 0;
      }

      syncResults.accounts.push(connectedAccount);

      // Fetch transactions for this account (last 90 days)
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 90);
      const fromDateStr = fromDate.toISOString().split('T')[0];

      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const txResponse = await pluggyRequest(
          'GET',
          `/transactions?accountId=${account.id}&from=${fromDateStr}&pageSize=500&page=${page}`,
          apiKey
        );

        const transactions = txResponse.results || [];
        console.log(`>>> Fetched ${transactions.length} transactions (page ${page})`);

        for (const tx of transactions) {
          // Map transaction to our format
          const mappedTx = {
            date: tx.date?.split('T')[0] || new Date().toISOString().split('T')[0],
            description: tx.description || tx.descriptionRaw || 'Sem descrição',
            amount: Math.abs(tx.amount || 0),
            category: mapPluggyCategory(tx.category, tx.description),
            type: tx.type === 'CREDIT' ? 'income' : 'expense',
            status: tx.status === 'PENDING' ? 'pending' : 'completed',
            importSource: 'pluggy',
            providerId: tx.id,
            providerItemId: itemId,
            accountId: account.id,
            accountType: accountSubtype
          };

          // For credit cards: positive = expense, negative = payment/credit
          if (isCreditCard) {
            if (tx.amount > 0) {
              mappedTx.type = 'expense';
            } else {
              mappedTx.type = 'income'; // Payment or credit
              mappedTx.category = 'Pagamento de Fatura';
            }

            // Add credit card metadata
            if (tx.creditCardMetadata) {
              mappedTx.installmentNumber = tx.creditCardMetadata.installmentNumber;
              mappedTx.totalInstallments = tx.creditCardMetadata.totalInstallments;
            }

            // Add card info for credit card transactions
            mappedTx.cardId = account.id;
            mappedTx.cardName = account.name || 'Cartão';

            syncResults.transactions.creditCard.push(mappedTx);
            syncResults.transactions.counts.creditCard++;
          } else {
            syncResults.transactions.checking.push(mappedTx);
            syncResults.transactions.counts.checking++;
          }

          syncResults.transactions.counts.total++;
        }

        hasMore = txResponse.page < txResponse.totalPages;
        page++;
      }
    }

    console.log(`>>> Sync complete. Accounts: ${syncResults.accounts.length}, Transactions: ${syncResults.transactions.counts.total}`);

    res.json({
      success: true,
      connector: connectorName,
      accounts: syncResults.accounts,
      transactions: {
        checking: syncResults.transactions.checking,
        creditCard: syncResults.transactions.creditCard
      },
      transactionCounts: syncResults.transactions.counts
    });

  } catch (error) {
    console.error('>>> Sync Error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Erro ao sincronizar dados.',
      details: error.response?.data?.message || error.message
    });
  }
});

// 3. Webhook to receive Pluggy events
router.post('/pluggy/webhook', async (req, res) => {
  const event = req.body;

  console.log('>>> PLUGGY WEBHOOK RECEIVED:', JSON.stringify(event, null, 2));

  try {
    const eventType = event.event;

    switch (eventType) {
      case 'item/created':
        console.log(`>>> Item created: ${event.id}`);
        break;

      case 'item/updated':
        console.log(`>>> Item updated: ${event.id}, status: ${event.status}`);
        // If status is UPDATED, data is ready to be fetched
        if (event.status === 'UPDATED') {
          console.log('>>> Item data is ready for sync');
        }
        break;

      case 'item/error':
        console.log(`>>> Item error: ${event.id}, error: ${event.error?.message}`);
        break;

      case 'item/deleted':
        console.log(`>>> Item deleted: ${event.id}`);
        break;

      default:
        console.log(`>>> Unknown event type: ${eventType}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('>>> Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// 4. Get item status
router.get('/pluggy/item/:itemId', async (req, res) => {
  const { itemId } = req.params;

  try {
    const apiKey = await getPluggyApiKey();
    const item = await pluggyRequest('GET', `/items/${itemId}`, apiKey);

    res.json({
      success: true,
      item: {
        id: item.id,
        status: item.status,
        executionStatus: item.executionStatus,
        connector: item.connector?.name,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Erro ao buscar item.',
      details: error.response?.data?.message || error.message
    });
  }
});

// 5. Delete item (disconnect bank)
router.delete('/pluggy/item/:itemId', async (req, res) => {
  const { itemId } = req.params;

  try {
    const apiKey = await getPluggyApiKey();
    await pluggyRequest('DELETE', `/items/${itemId}`, apiKey);

    res.json({ success: true, message: 'Conexão removida com sucesso.' });
  } catch (error) {
    res.status(500).json({
      error: 'Erro ao remover conexão.',
      details: error.response?.data?.message || error.message
    });
  }
});

// 6. List all items (for debugging/management)
router.get('/pluggy/items', async (req, res) => {
  try {
    const { userId } = req.query;
    const apiKey = await getPluggyApiKey();
    const itemsRaw = await getPluggyItems(apiKey, userId);
    const items = itemsRaw.map(mapPluggyItem);

    console.log(`>>> Found ${items.length} existing Pluggy items${userId ? ` for user ${userId}` : ''}`);

    res.json({
      success: true,
      items
    });
  } catch (error) {
    res.status(500).json({
      error: 'Erro ao listar items.',
      details: error.response?.data?.message || error.message
    });
  }
});

// 7. Delete all items (clean up for testing)
router.delete('/pluggy/items/all', async (req, res) => {
  try {
    const apiKey = await getPluggyApiKey();
    const response = await pluggyRequest('GET', '/items', apiKey);
    const items = response.results || [];

    console.log(`>>> Deleting ${items.length} Pluggy items...`);

    for (const item of items) {
      try {
        await pluggyRequest('DELETE', `/items/${item.id}`, apiKey);
        console.log(`>>> Deleted item ${item.id}`);
      } catch (err) {
        console.error(`>>> Failed to delete item ${item.id}:`, err.message);
      }
    }

    res.json({ success: true, message: `${items.length} conexões removidas.` });
  } catch (error) {
    res.status(500).json({
      error: 'Erro ao remover conexões.',
      details: error.response?.data?.message || error.message
    });
  }
});

export default router;
