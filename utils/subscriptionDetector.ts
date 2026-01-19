// List of known subscription services for detection
// This list helps standardizing names and identifying potential subscriptions from transaction descriptions

export const SUBSCRIPTION_KEYWORDS = [
  { key: 'netflix', name: 'Netflix', category: 'Lazer' },
  { key: 'amazon prime', name: 'Amazon Prime', category: 'Lazer' },
  { key: 'prime video', name: 'Amazon Prime', category: 'Lazer' },
  { key: 'hbo', name: 'HBO Max', category: 'Lazer' },
  { key: 'max', name: 'HBO Max', category: 'Lazer' },
  { key: 'disney', name: 'Disney+', category: 'Lazer' },
  { key: 'star+', name: 'Star+', category: 'Lazer' },
  { key: 'globoplay', name: 'Globoplay', category: 'Lazer' },
  { key: 'globo', name: 'Globoplay', category: 'Lazer' },
  { key: 'paramount', name: 'Paramount+', category: 'Lazer' },
  { key: 'mubi', name: 'Mubi', category: 'Lazer' },
  { key: 'telecine', name: 'Telecine', category: 'Lazer' },
  { key: 'discovery', name: 'Discovery+', category: 'Lazer' },
  { key: 'crunchyroll', name: 'Crunchyroll', category: 'Lazer' },
  { key: 'apple tv', name: 'Apple TV+', category: 'Lazer' },
  { key: 'starz', name: 'Starzplay', category: 'Lazer' },

  { key: 'spotify', name: 'Spotify', category: 'Lazer' },
  { key: 'deezer', name: 'Deezer', category: 'Lazer' },
  { key: 'tidal', name: 'Tidal', category: 'Lazer' },
  { key: 'apple music', name: 'Apple Music', category: 'Lazer' },
  { key: 'youtube music', name: 'YouTube Music', category: 'Lazer' },
  { key: 'amazon music', name: 'Amazon Music', category: 'Lazer' },
  { key: 'youtube', name: 'YouTube Premium', category: 'Lazer' },

  { key: 'icloud', name: 'iCloud', category: 'Tecnologia' },
  { key: 'google one', name: 'Google One', category: 'Tecnologia' },
  { key: 'google storage', name: 'Google One', category: 'Tecnologia' },
  { key: 'dropbox', name: 'Dropbox', category: 'Tecnologia' },
  { key: 'onedrive', name: 'OneDrive', category: 'Tecnologia' },

  { key: 'chatgpt', name: 'ChatGPT', category: 'Tecnologia' },
  { key: 'openai', name: 'ChatGPT Plus', category: 'Tecnologia' },
  { key: 'claude', name: 'Claude AI', category: 'Tecnologia' },
  { key: 'anthropic', name: 'Claude AI', category: 'Tecnologia' },
  { key: 'midjourney', name: 'Midjourney', category: 'Tecnologia' },
  { key: 'copilot', name: 'GitHub Copilot', category: 'Tecnologia' },
  { key: 'notion', name: 'Notion', category: 'Tecnologia' },
  { key: 'figma', name: 'Figma', category: 'Trabalho' },

  { key: 'adobe', name: 'Adobe Creative Cloud', category: 'Trabalho' },
  { key: 'canva', name: 'Canva Pro', category: 'Trabalho' },
  { key: 'microsoft 365', name: 'Microsoft 365', category: 'Trabalho' },
  { key: 'microsoft', name: 'Microsoft 365', category: 'Trabalho' },
  { key: 'zoom', name: 'Zoom', category: 'Trabalho' },
  { key: 'slack', name: 'Slack', category: 'Trabalho' },
  { key: 'trello', name: 'Trello', category: 'Trabalho' },
  { key: 'asana', name: 'Asana', category: 'Trabalho' },
  { key: 'monday', name: 'Monday.com', category: 'Trabalho' },

  { key: 'psn', name: 'PlayStation Plus', category: 'Lazer' },
  { key: 'playstation', name: 'PlayStation Plus', category: 'Lazer' },
  { key: 'xbox', name: 'Xbox Game Pass', category: 'Lazer' },
  { key: 'game pass', name: 'Xbox Game Pass', category: 'Lazer' },
  { key: 'nintendo', name: 'Nintendo Switch Online', category: 'Lazer' },
  { key: 'ea play', name: 'EA Play', category: 'Lazer' },
  { key: 'ubisoft', name: 'Ubisoft+', category: 'Lazer' },
  { key: 'steam', name: 'Steam', category: 'Lazer' },

  { key: 'duolingo', name: 'Duolingo', category: 'Educação' },
  { key: 'alura', name: 'Alura', category: 'Educação' },
  { key: 'udemy', name: 'Udemy', category: 'Educação' },
  { key: 'coursera', name: 'Coursera', category: 'Educação' },
  { key: 'skillshare', name: 'Skillshare', category: 'Educação' },
  { key: 'linkedin learning', name: 'LinkedIn Learning', category: 'Educação' },
  { key: 'masterclass', name: 'MasterClass', category: 'Educação' },
  { key: 'domestika', name: 'Domestika', category: 'Educação' },
  { key: 'platzi', name: 'Platzi', category: 'Educação' },
  { key: 'rocketseat', name: 'Rocketseat', category: 'Educação' },

  { key: 'gympass', name: 'Gympass', category: 'Saúde' },
  { key: 'wellhub', name: 'Wellhub (Gympass)', category: 'Saúde' },
  { key: 'totalpass', name: 'TotalPass', category: 'Saúde' },
  { key: 'smartfit', name: 'Smart Fit', category: 'Saúde' },
  { key: 'bluefit', name: 'Bluefit', category: 'Saúde' },
  { key: 'bodytech', name: 'Bodytech', category: 'Saúde' },
  { key: 'strava', name: 'Strava', category: 'Saúde' },
  { key: 'calm', name: 'Calm', category: 'Saúde' },
  { key: 'headspace', name: 'Headspace', category: 'Saúde' },
  { key: 'meditopia', name: 'Meditopia', category: 'Saúde' },

  { key: 'kindle', name: 'Kindle Unlimited', category: 'Lazer' },
  { key: 'audible', name: 'Audible', category: 'Lazer' },
  { key: 'scribd', name: 'Scribd', category: 'Lazer' },

  { key: 'nordvpn', name: 'NordVPN', category: 'Tecnologia' },
  { key: 'expressvpn', name: 'ExpressVPN', category: 'Tecnologia' },
  { key: 'surfshark', name: 'Surfshark', category: 'Tecnologia' },
  { key: '1password', name: '1Password', category: 'Tecnologia' },
  { key: 'lastpass', name: 'LastPass', category: 'Tecnologia' },
  { key: 'bitwarden', name: 'Bitwarden', category: 'Tecnologia' },

  { key: 'ifood', name: 'iFood Club', category: 'Alimentação' },
  { key: 'rappi', name: 'Rappi Prime', category: 'Alimentação' },

  { key: 'tinder', name: 'Tinder', category: 'Lazer' },
  { key: 'bumble', name: 'Bumble', category: 'Lazer' },
  { key: 'twitter', name: 'Twitter/X Premium', category: 'Lazer' },
  { key: 'patreon', name: 'Patreon', category: 'Lazer' },
  { key: 'twitch', name: 'Twitch', category: 'Lazer' },
  { key: 'discord', name: 'Discord Nitro', category: 'Lazer' },

  { key: 'apple', name: 'Apple Services', category: 'Tecnologia' },
  { key: 'google play', name: 'Google Play', category: 'Tecnologia' },
];

// Palavras-chave genéricas que indicam assinatura
const GENERIC_SUBSCRIPTION_KEYWORDS = [
  'assinatura', 'subscription', 'mensal', 'monthly', 'recorrente',
  'recorrencia', 'plano', 'premium', 'plus', 'pro', 'annual', 'anual',
  'renovacao', 'renewal', 'membership', 'mensalidade'
];

export const detectSubscriptionService = (description: string, originalCategory?: string): { isSubscription: boolean, name?: string, category?: string } => {
  const lowerDesc = description.toLowerCase();

  // MÉTODO 1: Lista de serviços conhecidos
  for (const service of SUBSCRIPTION_KEYWORDS) {
    if (lowerDesc.includes(service.key)) {
      return {
        isSubscription: true,
        name: service.name,
        category: service.category
      };
    }
  }

  // MÉTODO 2: Palavras-chave genéricas
  for (const keyword of GENERIC_SUBSCRIPTION_KEYWORDS) {
    if (lowerDesc.includes(keyword)) {
      // Extrair nome do serviço
      const cleanedName = extractServiceName(description);
      return {
        isSubscription: true,
        name: cleanedName || description.slice(0, 50),
        category: originalCategory || 'Outros'
      };
    }
  }

  return { isSubscription: false };
};

/**
 * Extrai o nome do serviço de uma descrição de transação
 */
const extractServiceName = (description: string): string => {
  if (!description) return '';

  // Remover prefixos comuns de cartão
  let cleaned = description
    .replace(/^(pag\*|pagseguro\*|mp\*|mercadopago\*|paypal\*|stripe\*|pix\s)/i, '')
    .replace(/\s*(assinatura|subscription|mensal|monthly|plano)\s*/gi, ' ')
    .trim();

  // Pegar as primeiras palavras significativas (máx 3)
  const words = cleaned.split(/[\s\-\_\*\/]+/).filter(w => w.length > 2);
  const nameWords = words.slice(0, 3).join(' ');

  return nameWords || cleaned.slice(0, 30);
};
