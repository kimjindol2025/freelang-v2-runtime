/**
 * Phase 17.1: Cryptographic Functions
 *
 * Implements core cryptographic operations:
 * - Hashing (MD5, SHA1, SHA256, SHA512)
 * - HMAC (Hash-based Message Authentication Code)
 * - AES encryption/decryption
 * - RSA public key operations
 * - Digital signatures
 * - Key derivation (PBKDF2)
 */

import * as crypto from 'crypto';

export type HashAlgorithm = 'md5' | 'sha1' | 'sha256' | 'sha512';
export type CipherAlgorithm = 'aes-128-cbc' | 'aes-256-cbc' | 'aes-256-gcm';
export type KeyFormat = 'pem' | 'der';

export interface HashResult {
  algorithm: HashAlgorithm;
  hash: string;
  digest_length: number;
  timing_safe: boolean;
}

export interface HMACResult {
  algorithm: string;
  key_length: number;
  hash: string;
  verified: boolean;
}

export interface EncryptionResult {
  algorithm: CipherAlgorithm;
  ciphertext: string;
  iv: string;
  auth_tag?: string;
  key_derivation: string;
}

export interface DecryptionResult {
  plaintext: string;
  success: boolean;
  error?: string;
  authentication_verified: boolean;
}

export interface RSAKeyPair {
  public_key: string;
  private_key: string;
  key_size: number;
  created_at: Date;
}

export interface SignatureResult {
  signature: string;
  algorithm: string;
  verified: boolean;
}

/**
 * Cryptographic Module
 * Implements standard cryptographic operations
 */
export class CryptoModule {
  private supported_hashes: Set<HashAlgorithm>;
  private supported_ciphers: Set<CipherAlgorithm>;
  private key_cache: Map<string, Buffer>;
  private operations_count: number;
  private error_log: string[];

  constructor() {
    this.supported_hashes = new Set(['md5', 'sha1', 'sha256', 'sha512']);
    this.supported_ciphers = new Set([
      'aes-128-cbc',
      'aes-256-cbc',
      'aes-256-gcm',
    ]);
    this.key_cache = new Map();
    this.operations_count = 0;
    this.error_log = [];
  }

  // ────────── Hash Functions (6) ──────────

  /**
   * Compute hash of data
   * Supports: MD5, SHA1, SHA256, SHA512
   */
  hash(data: string, algorithm: HashAlgorithm = 'sha256'): HashResult {
    try {
      if (!this.supported_hashes.has(algorithm)) {
        throw new Error(`Unsupported hash algorithm: ${algorithm}`);
      }

      const hash_obj = crypto.createHash(algorithm);
      hash_obj.update(data, 'utf8');
      const digest = hash_obj.digest('hex');

      this.operations_count++;

      return {
        algorithm,
        hash: digest,
        digest_length: digest.length / 2, // Convert hex string to bytes
        timing_safe: true,
      };
    } catch (error) {
      this.logError(`Hash error: ${error}`);
      throw error;
    }
  }

  /**
   * Compute HMAC (Hash-based Message Authentication Code)
   * For message authentication and integrity
   */
  hmac(
    data: string,
    key: string,
    algorithm: HashAlgorithm = 'sha256'
  ): HMACResult {
    try {
      const hmac_obj = crypto.createHmac(algorithm, key);
      hmac_obj.update(data, 'utf8');
      const digest = hmac_obj.digest('hex');

      this.operations_count++;

      return {
        algorithm: `hmac-${algorithm}`,
        key_length: key.length,
        hash: digest,
        verified: false,
      };
    } catch (error) {
      this.logError(`HMAC error: ${error}`);
      throw error;
    }
  }

  /**
   * Verify HMAC
   * Timing-safe comparison to prevent timing attacks
   */
  verifyHMAC(
    data: string,
    hmac_value: string,
    key: string,
    algorithm: HashAlgorithm = 'sha256'
  ): boolean {
    try {
      const expected = this.hmac(data, key, algorithm);
      // Use timing-safe comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(expected.hash, 'hex'),
        Buffer.from(hmac_value, 'hex')
      );
    } catch (error) {
      this.logError(`HMAC verification error: ${error}`);
      return false;
    }
  }

  /**
   * Key derivation using PBKDF2
   * Converts password into encryption key
   */
  deriveKey(
    password: string,
    salt: string,
    iterations: number = 100000,
    key_length: number = 32
  ): Buffer {
    try {
      const cache_key = `${password}:${salt}:${iterations}:${key_length}`;

      // Check cache
      if (this.key_cache.has(cache_key)) {
        return this.key_cache.get(cache_key)!;
      }

      const key = crypto.pbkdf2Sync(
        password,
        salt,
        iterations,
        key_length,
        'sha256'
      );

      // Cache the derived key
      this.key_cache.set(cache_key, key);

      this.operations_count++;

      return key;
    } catch (error) {
      this.logError(`Key derivation error: ${error}`);
      throw error;
    }
  }

  /**
   * Generate random bytes for IV, salt, etc
   */
  randomBytes(length: number = 16): string {
    try {
      const bytes = crypto.randomBytes(length);
      this.operations_count++;
      return bytes.toString('hex');
    } catch (error) {
      this.logError(`Random bytes error: ${error}`);
      throw error;
    }
  }

  /**
   * Generate random string (alphanumeric)
   */
  randomString(length: number = 32): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const bytes = crypto.randomBytes(length);

    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }

    this.operations_count++;
    return result;
  }

  // ────────── AES Encryption (2) ──────────

  /**
   * Encrypt data using AES
   * Supports CBC and GCM modes
   */
  encryptAES(
    plaintext: string,
    password: string,
    algorithm: CipherAlgorithm = 'aes-256-cbc'
  ): EncryptionResult {
    try {
      if (!this.supported_ciphers.has(algorithm)) {
        throw new Error(`Unsupported cipher: ${algorithm}`);
      }

      // Generate salt and IV
      const salt = this.randomBytes(16);
      const iv = this.randomBytes(16);

      // Derive key from password
      const key = this.deriveKey(password, salt, 100000, 32);

      // Create cipher
      const cipher = crypto.createCipheriv(algorithm, key, Buffer.from(iv, 'hex'));

      // Encrypt
      let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
      ciphertext += cipher.final('hex');

      // Get auth tag for GCM
      const auth_tag =
        algorithm.includes('gcm') ? (cipher as any).getAuthTag().toString('hex') : undefined;

      this.operations_count++;

      return {
        algorithm,
        ciphertext,
        iv,
        auth_tag,
        key_derivation: `pbkdf2:100000:sha256`,
      };
    } catch (error) {
      this.logError(`AES encryption error: ${error}`);
      throw error;
    }
  }

  /**
   * Decrypt AES-encrypted data
   */
  decryptAES(
    ciphertext: string,
    password: string,
    iv: string,
    salt: string,
    algorithm: CipherAlgorithm = 'aes-256-cbc',
    auth_tag?: string
  ): DecryptionResult {
    try {
      // Derive key from password using same salt
      const key = this.deriveKey(password, salt, 100000, 32);

      // Create decipher
      const decipher = crypto.createDecipheriv(
        algorithm,
        key,
        Buffer.from(iv, 'hex')
      );

      // Set auth tag for GCM
      if (auth_tag && algorithm.includes('gcm')) {
        (decipher as any).setAuthTag(Buffer.from(auth_tag, 'hex'));
      }

      // Decrypt
      let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
      plaintext += decipher.final('utf8');

      this.operations_count++;

      return {
        plaintext,
        success: true,
        authentication_verified: true,
      };
    } catch (error) {
      this.logError(`AES decryption error: ${error}`);
      return {
        plaintext: '',
        success: false,
        error: String(error),
        authentication_verified: false,
      };
    }
  }

  // ────────── RSA Operations (2) ──────────

  /**
   * Generate RSA key pair
   */
  generateRSAKeyPair(key_size: number = 2048): RSAKeyPair {
    try {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: key_size,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      this.operations_count++;

      return {
        public_key: publicKey,
        private_key: privateKey,
        key_size,
        created_at: new Date(),
      };
    } catch (error) {
      this.logError(`RSA key generation error: ${error}`);
      throw error;
    }
  }

  /**
   * Sign data with RSA private key
   */
  signRSA(data: string, private_key: string): SignatureResult {
    try {
      const sign = crypto.createSign('sha256');
      sign.update(data, 'utf8');
      const signature = sign.sign(private_key, 'hex');

      this.operations_count++;

      return {
        signature,
        algorithm: 'rsa-sha256',
        verified: false,
      };
    } catch (error) {
      this.logError(`RSA signing error: ${error}`);
      throw error;
    }
  }

  /**
   * Verify RSA signature
   */
  verifyRSASignature(
    data: string,
    signature: string,
    public_key: string
  ): boolean {
    try {
      const verify = crypto.createVerify('sha256');
      verify.update(data, 'utf8');
      const verified = verify.verify(public_key, Buffer.from(signature, 'hex'));

      this.operations_count++;

      return verified;
    } catch (error) {
      this.logError(`RSA verification error: ${error}`);
      return false;
    }
  }

  // ────────── Utilities ──────────

  /**
   * Get operation count
   */
  getOperationCount(): number {
    return this.operations_count;
  }

  /**
   * Get errors
   */
  getErrors(): string[] {
    return [...this.error_log];
  }

  /**
   * Clear errors
   */
  clearErrors(): void {
    this.error_log = [];
  }

  /**
   * Clear key cache
   */
  clearKeyCache(): void {
    this.key_cache.clear();
  }

  /**
   * Log error
   */
  private logError(message: string): void {
    this.error_log.push(`[${new Date().toISOString()}] ${message}`);
  }

  /**
   * Get supported algorithms
   */
  getSupportedAlgorithms(): {
    hashes: string[];
    ciphers: string[];
  } {
    return {
      hashes: Array.from(this.supported_hashes),
      ciphers: Array.from(this.supported_ciphers),
    };
  }
}

export default CryptoModule;
