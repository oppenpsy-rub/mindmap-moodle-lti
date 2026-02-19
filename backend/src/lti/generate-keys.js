/**
 * Generate RSA Key Pair for LTI 1.3 Tool
 * 
 * Run this once:  node src/lti/generate-keys.js
 * 
 * It will output the values you need to add to your .env file.
 * The private key is used to sign service requests (grades, roster) to Moodle.
 * The public key is served via /lti/jwks for Moodle to verify.
 */

import crypto from 'crypto';

console.log('🔑 Generating RSA 2048-bit key pair for LTI 1.3...\n');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// Escape newlines for .env file (single line)
const privateKeyOneLine = privateKey.replace(/\n/g, '\\n');
const publicKeyOneLine = publicKey.replace(/\n/g, '\\n');

console.log('Add these lines to your backend/.env file:\n');
console.log('# ─── LTI Tool RSA Keys ───');
console.log(`TOOL_PRIVATE_KEY="${privateKeyOneLine}"`);
console.log('');
console.log(`TOOL_PUBLIC_KEY="${publicKeyOneLine}"`);
console.log('');
console.log('TOOL_KEY_ID=tool-key-1');
console.log('');
console.log('─'.repeat(50));
console.log('');
console.log('The public key (for manual registration in Moodle):');
console.log(publicKey);
