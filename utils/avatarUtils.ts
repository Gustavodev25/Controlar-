export const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const getAvatarColors = (name: string) => {
  // Beautiful pastel color palette
  const colorPalettes = [
    { bg: 'bg-gradient-to-br from-amber-300 to-orange-400', text: 'text-amber-900' },      // Warm amber
    { bg: 'bg-gradient-to-br from-sky-300 to-blue-400', text: 'text-blue-900' },           // Sky blue
    { bg: 'bg-gradient-to-br from-emerald-300 to-teal-400', text: 'text-teal-900' },       // Emerald
    { bg: 'bg-gradient-to-br from-violet-300 to-purple-400', text: 'text-purple-900' },    // Violet
    { bg: 'bg-gradient-to-br from-rose-300 to-pink-400', text: 'text-rose-900' },          // Rose
    { bg: 'bg-gradient-to-br from-lime-300 to-green-400', text: 'text-green-900' },        // Lime
    { bg: 'bg-gradient-to-br from-cyan-300 to-teal-400', text: 'text-teal-900' },          // Cyan
    { bg: 'bg-gradient-to-br from-fuchsia-300 to-pink-400', text: 'text-pink-900' },       // Fuchsia
    { bg: 'bg-gradient-to-br from-yellow-200 to-amber-300', text: 'text-amber-900' },      // Soft yellow
    { bg: 'bg-gradient-to-br from-indigo-300 to-blue-400', text: 'text-indigo-900' },      // Indigo
    { bg: 'bg-gradient-to-br from-teal-200 to-cyan-300', text: 'text-teal-900' },          // Soft teal
    { bg: 'bg-gradient-to-br from-orange-200 to-red-300', text: 'text-red-900' },          // Coral
  ];

  // Create a simple hash from the name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % colorPalettes.length;
  return colorPalettes[index];
};
