O cartão é **tokenizado e armazenado exclusivamente pelo Asaas**.

**Como funciona a segurança no seu sistema:**

1.  **Envio Seguro:** Quando o usuário digita os dados do cartão, eles são enviados para o seu backend, que repassa **imediatamente** para a API do Asaas para processar o pagamento e criar a assinatura.
2.  **O que fica no seu banco:** O sistema salva apenas dados públicos/seguros para exibição na interface (como "Cartão final 1234", nome do titular e validade).
3.  **Dados Sensíveis:** O número completo do cartão (PAN) e o código de segurança (CVV) **nunca** são salvos no seu banco de dados (Firestore), garantindo conformidade com padrões de segurança (PCI-DSS).

Pode ficar tranquilo que a responsabilidade pela guarda dos dados sensíveis é inteira do gateway de pagamento (Asaas).