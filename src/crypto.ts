import * as bip39 from 'bip39';
import * as forge from 'node-forge';
import {default as base58} from 'bs58';
import { Buffer } from 'buffer';

/**
 * Converts a mnemonic phrase (array of words) to an RSA private key
 * @param words - Array of BIP39 mnemonic words
 * @param keySize - Size of the RSA key (e.g., 512, 1024, 2048)
 * @returns The generated RSA private key
 */
function wordsToPrivKey(words: string[], keySize: number): forge.pki.rsa.PrivateKey {
  // Validate key size
  if (![512, 1024, 2048, 4096].includes(keySize)) {
    throw new Error('Invalid key size. Must be 512, 1024, 2048, or 4096 bits.');
  }

  const mnemonic = words.join(' ');
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  console.log(seed.length)
  const rng = forge.random.createInstance();
  rng.seedFileSync = function (needed: number) {
    
    return seed.toString('binary')
  };
  const keys = forge.pki.rsa.generateKeyPair({
    bits: 1024,
    e: 65537,
    prng: rng,
    algorithm: 'PRIMEINC'
  });
  const sha256 = forge.md.sha256.create();
  sha256.update(keys.publicKey.n.toString(10));
  const hash = sha256.digest();
  const base58Encoded = base58.encode(Buffer.from(hash.getBytes(), 'binary'));
  console.log(base58Encoded);
  return keys.privateKey
//   const primeData = seed.slice(0, 64);
//   const v1 = primeData.slice(0, 32);
//   const v2 = primeData.slice(32, 64);
//   console.log(v1, v2)
  
  // Validate the mnemonic
//   if (!bip39.validateMnemonic(mnemonic)) {
//     throw new Error('Invalid mnemonic phrase');
//   }
  
  // Await the prime generation
//   const p = await derivePrime(v1, keySize / 2);
//   const q = await derivePrime(v2, keySize / 2);
//   console.log(p, q)
//   // Calculate RSA key components
//   const n = new forge.jsbn.BigInteger(p.multiply(q).toString(16), 16);
//   const e = new forge.jsbn.BigInteger('65537');
//   const phi = p.subtract(forge.jsbn.BigInteger.ONE).multiply(q.subtract(forge.jsbn.BigInteger.ONE));
//   const d = calculatePrivateExponent(e, phi);
  
//   // Create the RSA private key
//   const privateKey = forge.pki.rsa.setPrivateKey(
//     n,
//     e,
//     d,
//     p,
//     q,
//     d.mod(p.subtract(forge.jsbn.BigInteger.ONE)),
//     d.mod(q.subtract(forge.jsbn.BigInteger.ONE)),
//     q.modInverse(p)
//   );
  
//   return privateKey;
}

/**
 * Derives a prime number of specified bit length from seed data
 */
function derivePrime(seed: Buffer, bitLength: number): Promise<forge.jsbn.BigInteger> {
  return new Promise((resolve, reject) => {
    const md = forge.md.sha256.create();
    const buf = forge.util.createBuffer(seed);
    md.update(buf.data);
    const seedHex = md.digest().toHex();

    const rng = forge.random.createInstance();
    rng.seedFileSync = () => seedHex;

    const prime = require('node-forge/lib/prime');
    prime.generateProbablePrime(bitLength, (err: Error, n: forge.jsbn.BigInteger) => {
      if (err) {
        reject(err);
      } else {
        resolve(n);
      }
    });
  });
}

/**
 * Calculates the private exponent d where d*e ≡ 1 (mod phi)
 */
function calculatePrivateExponent(
  e: forge.jsbn.BigInteger, 
  phi: forge.jsbn.BigInteger
): forge.jsbn.BigInteger {
  // Typically e = 65537, but we'll use the provided e
  return e.modInverse(phi);
}

/**
 * Example usage
 */
// async function example(words: string[]) {  
// //   try {
//     // Generate a 2048-bit RSA key from the mnemonic
//     const privateKey = await wordsToPrivKey(words, 512);
//     // Convert to PEM format for display/storage
//     const pemPrivateKey = forge.pki.privateKeyToPem(privateKey);
//     console.log(pemPrivateKey);
    
//     // Generate the corresponding public key
//     const publicKey = forge.pki.setRsaPublicKey(privateKey.n, privateKey.e);
//     const pemPublicKey = forge.pki.publicKeyToPem(publicKey);
//     console.log(pemPublicKey);

//     const publicKeyPem = forge.pki.publicKeyToPem(publicKey);
//     const md = forge.md.sha256.create();
//     md.update(publicKeyPem);
//     const publicKeySha256 = md.digest().toHex()
//     const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
//     function encodeBase58(buffer: Buffer): string {
//       let carry;
//       const digits = [0];
//       for (let i = 0; i < buffer.length; ++i) {
//         carry = buffer[i];
//         for (let j = 0; j < digits.length; ++j) {
//           carry += digits[j] << 8;
//           digits[j] = carry % 58;
//           carry = (carry / 58) | 0;
//         }
//         while (carry) {
//           digits.push(carry % 58);
//           carry = (carry / 58) | 0;
//         }
//       }
//       let result = '';
//       for (let k = 0; buffer[k] === 0 && k < buffer.length - 1; ++k) {
//         result += '1';
//       }
//       for (let q = digits.length - 1; q >= 0; --q) {
//         result += ALPHABET[digits[q]];
//       }
//       return result;
//     }

//     const publicKeySha256Buffer = Buffer.from(publicKeySha256, 'hex');
//     const publicKeySha256Base58 = encodeBase58(publicKeySha256Buffer);
//     console.log("Base58 of Public Key SHA-256:", publicKeySha256Base58);
//     console.log("SHA-256 of Public Key:", publicKeySha256);
    
//     // Test encryption/decryption
//     const message = "Hello, RSA encryption from mnemonic!";
//     const encrypted = publicKey.encrypt(message);
//     const decrypted = privateKey.decrypt(encrypted);
    
//     console.log("Original:", message);
//     console.log("Decrypted:", decrypted);
// //   } catch (error) {
// //     const err = error as Error;
// //     console.error("Error:", err.message);
// //   }
// }

// CDt7XzseKpVm8rHCu48r7HQvsez99qTjz6T8FZyU3DTo
const words = 'bicycle income legal nice clutch age actor spatial begin inquiry room explain tip wheel shrimp fluid time winner wire hotel tower news poem leaf machine reopen impose enjoy quit resource coffee random horror year observe outside beef order upgrade inner oval jewel behind double shrimp connect endless'.split(' ');
wordsToPrivKey(words, 512)