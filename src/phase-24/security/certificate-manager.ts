/**
 * Phase 24.2: Certificate Manager
 * Manage X.509 certificates and PKI
 */

export interface Certificate {
  subject: string;
  issuer: string;
  valid_from: number;
  valid_to: number;
  serial_number: string;
  thumbprint: string;
  public_key: string;
  signature: string;
}

export interface CertificateInfo {
  is_valid: boolean;
  is_expired: boolean;
  days_until_expiry: number;
  subject: string;
  issuer: string;
}

export class CertificateManager {
  private certificates: Map<string, Certificate> = new Map();
  private revoked: Set<string> = new Set();

  constructor() {}

  generateCertificate(
    subject: string,
    issuer: string,
    validity_days: number = 365
  ): Certificate {
    const now = Date.now();
    const serial = this.generateSerialNumber();

    const cert: Certificate = {
      subject,
      issuer,
      valid_from: now,
      valid_to: now + validity_days * 24 * 60 * 60 * 1000,
      serial_number: serial,
      thumbprint: this.generateThumbprint(subject + serial),
      public_key: this.generatePublicKey(),
      signature: this.generateSignature(subject + issuer + serial),
    };

    this.certificates.set(serial, cert);
    return cert;
  }

  getCertificateInfo(serial_number: string): CertificateInfo {
    const cert = this.certificates.get(serial_number);
    if (!cert) {
      return {
        is_valid: false,
        is_expired: true,
        days_until_expiry: -1,
        subject: '',
        issuer: '',
      };
    }

    const now = Date.now();
    const is_expired = now > cert.valid_to;
    const days_until = Math.ceil((cert.valid_to - now) / (24 * 60 * 60 * 1000));

    return {
      is_valid: !is_expired && !this.revoked.has(serial_number),
      is_expired,
      days_until_expiry: days_until,
      subject: cert.subject,
      issuer: cert.issuer,
    };
  }

  revokeCertificate(serial_number: string): void {
    this.revoked.add(serial_number);
  }

  isCertificateValid(serial_number: string): boolean {
    const info = this.getCertificateInfo(serial_number);
    return info.is_valid;
  }

  validateChain(chain: string[]): boolean {
    for (const serial of chain) {
      if (!this.isCertificateValid(serial)) {
        return false;
      }
    }
    return true;
  }

  private generateSerialNumber(): string {
    return Math.random().toString(16).slice(2).padStart(32, '0');
  }

  private generateThumbprint(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data.charCodeAt(i);
    }
    return Math.abs(hash).toString(16).padStart(40, '0');
  }

  private generatePublicKey(): string {
    return '-----BEGIN PUBLIC KEY-----\n' +
      Buffer.from(Math.random().toString()).toString('base64').slice(0, 76) +
      '\n-----END PUBLIC KEY-----';
  }

  private generateSignature(data: string): string {
    return Buffer.from(data).toString('base64');
  }
}

export default { CertificateManager };
