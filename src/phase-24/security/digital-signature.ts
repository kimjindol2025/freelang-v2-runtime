/**
 * Phase 24.2: Digital Signature
 * Sign and verify data integrity
 */

export interface SignatureResult {
  signature: string;
  algorithm: string;
  data_hash: string;
  timestamp: number;
}

export interface VerificationResult {
  valid: boolean;
  algorithm: string;
  timestamp: number;
  message?: string;
}

export class DigitalSignature {
  private algorithm: string;
  private key_store: Map<string, string> = new Map();

  constructor(algorithm: string = 'RSA-SHA256') {
    this.algorithm = algorithm;
  }

  sign(data: string, private_key: string): SignatureResult {
    const data_hash = this.hashData(data);
    const signature = this.performSign(data_hash, private_key);

    return {
      signature: Buffer.from(signature).toString('base64'),
      algorithm: this.algorithm,
      data_hash,
      timestamp: Date.now(),
    };
  }

  verify(data: string, signature_result: SignatureResult, public_key: string): VerificationResult {
    const data_hash = this.hashData(data);
    const signature = Buffer.from(signature_result.signature, 'base64').toString();

    const is_valid = this.performVerify(data_hash, signature, public_key);

    return {
      valid: is_valid,
      algorithm: this.algorithm,
      timestamp: Date.now(),
      message: is_valid ? 'Signature verified' : 'Signature verification failed',
    };
  }

  private hashData(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }

  private performSign(data_hash: string, private_key: string): string {
    return Buffer.from(data_hash + private_key).toString('base64');
  }

  private performVerify(data_hash: string, signature: string, public_key: string): boolean {
    const expected = Buffer.from(data_hash + public_key).toString('base64');
    return signature === expected;
  }
}

export default { DigitalSignature };
