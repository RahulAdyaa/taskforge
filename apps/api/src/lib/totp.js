const crypto = require('crypto');

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Generates a valid Base32 secret string.
 * @param {number} length Default 16 characters (80 bits)
 * @returns {string} Base32 encoded secret
 */
function generateBase32Secret(length = 16) {
  let secret = '';
  for (let i = 0; i < length; i++) {
    const rand = crypto.randomInt(0, 32);
    secret += BASE32_CHARS[rand];
  }
  return secret;
}

/**
 * Decodes a Base32 string into a Buffer.
 * @param {string} str Base32 encoded string
 * @returns {Buffer}
 */
function base32Decode(str) {
  str = str.replace(/=+$/, '').toUpperCase();
  let byteLen = Math.floor((str.length * 5) / 8);
  let bytes = Buffer.alloc(byteLen);
  let buffer = 0;
  let count = 0;
  let offset = 0;
  
  for (let i = 0; i < str.length; i++) {
    const val = BASE32_CHARS.indexOf(str[i]);
    if (val === -1) throw new Error('Invalid base32 character');
    buffer = (buffer << 5) | val;
    count += 5;
    if (count >= 8) {
      bytes[offset++] = (buffer >> (count - 8)) & 0xff;
      count -= 8;
    }
  }
  return bytes;
}

/**
 * Generates an HOTP code given a secret buffer and a counter.
 * @param {Buffer} secretBuffer 
 * @param {number} counter 
 * @returns {string} 6-digit code
 */
function generateHOTP(secretBuffer, counter) {
  const buf = Buffer.alloc(8);
  let tmp = counter;
  for (let i = 7; i >= 0; i--) {
    buf[i] = tmp % 256;
    tmp = Math.floor(tmp / 256);
  }
  
  const hmac = crypto.createHmac('sha1', secretBuffer);
  hmac.update(buf);
  const hmacResult = hmac.digest();
  
  const offset = hmacResult[hmacResult.length - 1] & 0xf;
  const code = (
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff)
  ) % 1000000;
  
  return code.toString().padStart(6, '0');
}

/**
 * Verifies a TOTP token against a Base32 secret.
 * Allows a time window of ±1 step (usually 30 seconds) to account for clock drift.
 * @param {string} secretBase32 
 * @param {string} token 
 * @param {number} window Default 1 step before/after
 * @returns {boolean}
 */
function verifyTOTP(secretBase32, token, window = 1) {
  try {
    const secretBuffer = base32Decode(secretBase32);
    const epoch = Math.floor(Date.now() / 1000);
    const currentCounter = Math.floor(epoch / 30);
    
    for (let i = -window; i <= window; i++) {
      const calculated = generateHOTP(secretBuffer, currentCounter + i);
      if (calculated === token) {
        return true;
      }
    }
    return false;
  } catch (e) {
    return false;
  }
}

module.exports = {
  generateBase32Secret,
  verifyTOTP,
};
