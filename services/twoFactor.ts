const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const getCrypto = () => {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    return globalThis.crypto;
  }
  throw new Error("Crypto API indisponível para gerar/validar TOTP.");
};

const base32ToBytes = (secret: string) => {
  const cleaned = secret.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = "";

  for (const char of cleaned) {
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }

  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  return new Uint8Array(bytes);
};

const intToBuffer = (counter: number) => {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  const high = Math.floor(counter / 2 ** 32);
  const low = counter >>> 0;
  view.setUint32(0, high);
  view.setUint32(4, low);
  return buffer;
};

const generateTOTP = async (secret: string, timestamp = Date.now(), digits = 6) => {
  const crypto = getCrypto();
  const counter = Math.floor(timestamp / 1000 / 30);
  const key = await crypto.subtle.importKey(
    "raw",
    base32ToBytes(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  const hmac = await crypto.subtle.sign("HMAC", key, intToBuffer(counter));
  const hmacBytes = new Uint8Array(hmac);
  const offset = hmacBytes[hmacBytes.length - 1] & 0x0f;
  const binary =
    ((hmacBytes[offset] & 0x7f) << 24) |
    ((hmacBytes[offset + 1] & 0xff) << 16) |
    ((hmacBytes[offset + 2] & 0xff) << 8) |
    (hmacBytes[offset + 3] & 0xff);

  const otp = binary % 10 ** digits;
  return otp.toString().padStart(digits, "0");
};

export const verifyTOTP = async (secret: string, token: string, window = 2) => {
  const sanitized = (token || "").replace(/\s+/g, "");
  if (sanitized.length !== 6) return false;

  const now = Date.now();
  for (let offset = -window; offset <= window; offset++) {
    const time = now + offset * 30_000;
    const expected = await generateTOTP(secret, time, 6);
    if (expected === sanitized) return true;
  }
  return false;
};

export const generateBase32Secret = (length = 32) => {
  const crypto = getCrypto();
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  let secret = "";
  randomBytes.forEach((byte) => {
    secret += BASE32_ALPHABET[byte % 32];
  });
  return secret;
};

export const buildOtpAuthUrl = (secret: string, label: string, issuer: string) => {
  const encodedLabel = encodeURIComponent(label);
  const encodedIssuer = encodeURIComponent(issuer);
  return `otpauth://totp/${encodedLabel}?secret=${secret}&issuer=${encodedIssuer}&digits=6&period=30`;
};
