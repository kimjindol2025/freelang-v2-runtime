/**
 * Phase 17: Advanced Security - Main Exports
 *
 * Exports all security components:
 * - Cryptographic functions (hash, HMAC, AES, RSA)
 * - Memory safety checks
 * - Input validation (SQL injection, XSS, etc)
 */

// Cryptographic Module
export {
  HashAlgorithm,
  CipherAlgorithm,
  KeyFormat,
  HashResult,
  HMACResult,
  EncryptionResult,
  DecryptionResult,
  RSAKeyPair,
  SignatureResult,
} from './crypto/crypto-module';

export { default as CryptoModule } from './crypto/crypto-module';

// Memory Safety Module
export {
  BufferCheckResult,
  MemoryAllocation,
  UseAfterFreeCheck,
  TypeSafetyCheck,
  MemoryLeakReport,
} from './memory-safety/memory-safety';

export { default as MemorySafetyModule } from './memory-safety/memory-safety';

// Input Validator
export {
  ValidationResult,
  SanitizedData,
} from './input-validation/input-validator';

export { default as InputValidator } from './input-validation/input-validator';

// Import for SecuritySuite
import CryptoModule from './crypto/crypto-module';
import MemorySafetyModule from './memory-safety/memory-safety';
import InputValidator from './input-validation/input-validator';

/**
 * Security Suite
 * Combined security module for convenient access
 */
export class SecuritySuite {
  crypto: CryptoModule;
  memory: MemorySafetyModule;
  input: InputValidator;

  constructor() {
    this.crypto = new CryptoModule();
    this.memory = new MemorySafetyModule();
    this.input = new InputValidator();
  }

  /**
   * Get security stats
   */
  getSecurityStats() {
    return {
      cryptography: {
        operations: this.crypto.getOperationCount(),
        supported_hashes: this.crypto.getSupportedAlgorithms().hashes,
        supported_ciphers: this.crypto.getSupportedAlgorithms().ciphers,
      },
      memory: this.memory.getMemoryReport(),
      input_validation: this.input.getStats(),
    };
  }

  /**
   * Reset all modules
   */
  reset() {
    this.memory.reset();
    this.input.clearErrors();
    this.crypto.clearKeyCache();
    this.crypto.clearErrors();
  }
}

export default SecuritySuite;
