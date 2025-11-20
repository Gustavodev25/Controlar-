# Como Configurar o Gmail para Enviar E-mails de Redefinição de Senha

O seu aplicativo usa o **Firebase Authentication**, que já vem configurado para enviar e-mails de redefinição de senha automaticamente através do endereço `noreply@seu-projeto.firebaseapp.com`.

**Você NÃO precisa configurar o Gmail se estiver satisfeito com o remetente padrão.**

No entanto, se você quiser que os e-mails cheguem como `seu-email@gmail.com`, siga os passos abaixo:

## 1. Gerar uma Senha de App no Gmail

Para usar o Gmail como servidor de e-mail (SMTP), você não pode usar sua senha normal. Você precisa de uma "Senha de App".

1.  Acesse sua conta do Google: [https://myaccount.google.com/](https://myaccount.google.com/)
2.  Vá em **Segurança** no menu lateral.
3.  Em "Como você faz login no Google", certifique-se de que a **Verificação em duas etapas** está **ATIVADA**. (É obrigatório).
4.  Após ativar, procure por **Senhas de app** (ou pesquise na barra de busca do topo por "Senhas de app").
5.  Dê um nome para o app (ex: "Finance App") e clique em **Criar**.
6.  O Google vai gerar um código de 16 letras (ex: `abcd efgh ijkl mnop`). **Copie esse código**. Ele é a sua senha para o envio de e-mails.

## 2. Configurar no Firebase

1.  Acesse o [Console do Firebase](https://console.firebase.google.com/).
2.  Selecione o seu projeto.
3.  No menu lateral, vá em **Authentication** (Autenticação).
4.  Clique na aba **Templates** (Modelos).
5.  Selecione **Password reset** (Redefinição de senha).
6.  Clique no ícone de lápis (Editar).
7.  Clique em **Customize sender domain** (Personalizar domínio do remetente) ou procure por configurações de **SMTP**.
    *   *Nota: O Firebase pode pedir para você verificar o domínio se for um domínio personalizado. Se for Gmail gratuito, a opção de SMTP direto pode estar em "SMTP Settings" ou você pode precisar usar uma extensão do Firebase ou Cloud Function se a opção nativa não estiver visível para contas gratuitas.*

**Alternativa Recomendada (Mais Simples):**
O Firebase recomenda usar o remetente padrão (`noreply`) para evitar cair no SPAM. Se você realmente precisa de um e-mail personalizado, o ideal é usar um serviço como SendGrid ou Mailgun, ou verificar um domínio próprio (ex: `contato@suaempresa.com`). O Gmail gratuito tem limites de envio diário (aprox. 500 e-mails) e pode bloquear envios suspeitos.

## Resumo
O código que implementamos no botão "Esqueceu a senha?" usa a função nativa do Firebase:
```javascript
sendPasswordResetEmail(auth, email)
```
Isso funciona automaticamente. Teste primeiro antes de tentar configurar o SMTP do Gmail!
