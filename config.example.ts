// Configuration file for API keys and environment variables
// NOTE: In production, these should be stored securely on a backend server

export const config = {
  GEMINI_API_KEY:
    (typeof process !== "undefined" ? process.env.GEMINI_API_KEY : "") ||
    "",
  // Add other configuration variables here
};
