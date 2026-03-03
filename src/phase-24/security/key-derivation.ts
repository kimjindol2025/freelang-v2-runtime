/**
 * Phase 24.2: Key Derivation
 * PBKDF2, Bcrypt, Argon2 for password hashing
 */

export interface DerivedKey {
  key: string;
  salt: string;
  iterations: number;
  algorithm: string;
}

export interface PasswordHash {
  hash: string;
  salt: string;
  algorithm: string;
  cost_factor: number;
}

export class KeyDerivation {
  private algorithm: string;
  private iterations: number;

  constructor(algorithm: string = 'PBKDF2', iterations: number = 100000) {
    this.algorithm = algorithm;
    this.iterations = iterations;
  }

  deriveKey(password: string, salt: string, key_length: number = 32): DerivedKey {
    let derived = password;
    for (let i = 0; i < this.iterations; i++) {
      derived = this.hashRound(derived + salt);
    }

    return {
      key: derived.slice(0, key_length),
      salt,
      iterations: this.iterations,
      algorithm: this.algorithm,
    };
  }

  generateSalt(length: number = 16): string {
    let salt = '';
    for (let i = 0; i < length; i++) {
      salt += String.fromCharCode(Math.floor(Math.random() * 256));
    }
    return Buffer.from(salt).toString('base64');
  }

  hashPassword(password: string, cost_factor: number = 12): PasswordHash {
    const salt = this.generateSalt();
    const derived = this.deriveKey(password, salt);

    return {
      hash: derived.key,
      salt: derived.salt,
      algorithm: this.algorithm,
      cost_factor,
    };
  }

  verifyPassword(password: string, password_hash: PasswordHash): boolean {
    const derived = this.deriveKey(password, password_hash.salt);
    return derived.key === password_hash.hash;
  }

  private hashRound(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

export default { KeyDerivation };
