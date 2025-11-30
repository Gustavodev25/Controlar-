// List of known subscription services for detection
// This list helps standardizing names and identifying potential subscriptions from transaction descriptions

export const SUBSCRIPTION_KEYWORDS = [
  { key: 'netflix', name: 'Netflix', category: 'Lazer' },
  { key: 'spotify', name: 'Spotify', category: 'Lazer' },
  { key: 'amazon prime', name: 'Amazon Prime', category: 'Lazer' },
  { key: 'prime video', name: 'Amazon Prime', category: 'Lazer' },
  { key: 'hbo', name: 'HBO Max', category: 'Lazer' },
  { key: 'max', name: 'HBO Max', category: 'Lazer' },
  { key: 'disney', name: 'Disney+', category: 'Lazer' },
  { key: 'star+', name: 'Star+', category: 'Lazer' },
  { key: 'globoplay', name: 'Globoplay', category: 'Lazer' },
  { key: 'globo', name: 'Globoplay', category: 'Lazer' },
  { key: 'apple', name: 'Apple Services', category: 'Tecnologia' },
  { key: 'icloud', name: 'iCloud', category: 'Tecnologia' },
  { key: 'adobe', name: 'Adobe Creative Cloud', category: 'Trabalho' },
  { key: 'canva', name: 'Canva', category: 'Trabalho' },
  { key: 'chatgpt', name: 'ChatGPT', category: 'Tecnologia' },
  { key: 'openai', name: 'ChatGPT', category: 'Tecnologia' },
  { key: 'midjourney', name: 'Midjourney', category: 'Tecnologia' },
  { key: 'claude', name: 'Claude AI', category: 'Tecnologia' },
  { key: 'anthropic', name: 'Claude AI', category: 'Tecnologia' },
  { key: 'youtube', name: 'YouTube Premium', category: 'Lazer' },
  { key: 'google storage', name: 'Google One', category: 'Tecnologia' },
  { key: 'google one', name: 'Google One', category: 'Tecnologia' },
  { key: 'microsoft', name: 'Microsoft 365', category: 'Trabalho' },
  { key: 'dropbox', name: 'Dropbox', category: 'Tecnologia' },
  { key: 'psn', name: 'PlayStation Plus', category: 'Lazer' },
  { key: 'xbox', name: 'Xbox Game Pass', category: 'Lazer' },
  { key: 'game pass', name: 'Xbox Game Pass', category: 'Lazer' },
  { key: 'nintendo', name: 'Nintendo Switch Online', category: 'Lazer' },
  { key: 'crunchyroll', name: 'Crunchyroll', category: 'Lazer' },
  { key: 'paramount', name: 'Paramount+', category: 'Lazer' },
  { key: 'mubi', name: 'Mubi', category: 'Lazer' },
  { key: 'telecine', name: 'Telecine', category: 'Lazer' },
  { key: 'deezer', name: 'Deezer', category: 'Lazer' },
  { key: 'tidal', name: 'Tidal', category: 'Lazer' },
  { key: 'duolingo', name: 'Duolingo', category: 'Educação' },
  { key: 'alura', name: 'Alura', category: 'Educação' },
  { key: 'udemy', name: 'Udemy', category: 'Educação' },
  { key: 'coursera', name: 'Coursera', category: 'Educação' },
  { key: 'gympass', name: 'Gympass', category: 'Saúde' },
  { key: 'totalpass', name: 'TotalPass', category: 'Saúde' },
  { key: 'smartfit', name: 'Smart Fit', category: 'Saúde' },
  { key: 'bluefit', name: 'Bluefit', category: 'Saúde' }
];

export const detectSubscriptionService = (description: string, originalCategory?: string): { isSubscription: boolean, name?: string, category?: string } => {
  const lowerDesc = description.toLowerCase();
  
  for (const service of SUBSCRIPTION_KEYWORDS) {
    if (lowerDesc.includes(service.key)) {
      return { 
        isSubscription: true, 
        name: service.name,
        category: service.category 
      };
    }
  }

  return { isSubscription: false };
};
