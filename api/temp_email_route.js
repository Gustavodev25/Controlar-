
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
