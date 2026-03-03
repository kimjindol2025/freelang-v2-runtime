/**
 * Phase 17.3: Input Validation
 *
 * Implements security input validation:
 * - SQL injection prevention
 * - Cross-Site Scripting (XSS) prevention
 * - Command injection prevention
 * - Path traversal prevention
 * - Email validation
 * - URL validation
 */

export interface ValidationResult {
  valid: boolean;
  cleaned?: string;
  reason?: string;
  risk_level: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  violations: string[];
}

export interface SanitizedData {
  input: string;
  output: string;
  removed_characters: number;
  risk_detected: boolean;
}

/**
 * Input Validation Module
 * Validates and sanitizes user input
 */
export class InputValidator {
  private sql_patterns: RegExp[];
  private xss_patterns: RegExp[];
  private command_patterns: RegExp[];
  private validation_count: number;
  private violations_found: number;
  private error_log: string[];

  constructor() {
    this.validation_count = 0;
    this.violations_found = 0;
    this.error_log = [];

    // SQL injection patterns
    this.sql_patterns = [
      /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|SCRIPT|JAVASCRIPT|ONERROR)\b)/gi,
      /('|"|`|;|\-\-|\/\*|\*\/|xp_|sp_)/i,
      /(\*|;|'|\"|\/\*|\*\/|--|#)/,
    ];

    // XSS patterns
    this.xss_patterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi, // onerror=, onclick=, etc
      /<iframe[^>]*>/gi,
      /<object[^>]*>/gi,
      /<embed[^>]*>/gi,
      /eval\(/gi,
      /expression\(/gi,
    ];

    // Command injection patterns
    this.command_patterns = [
      /[;&|`$(){}[\]\\]/g, // Shell metacharacters
      /\$\{.*\}/g, // Template injection
    ];
  }

  // ────────── SQL Injection Prevention (2) ──────────

  /**
   * Check for SQL injection attempts
   */
  validateSQLInput(input: string): ValidationResult {
    try {
      const violations: string[] = [];
      let risk_level: ValidationResult['risk_level'] = 'safe';

      this.validation_count++;

      // Check for SQL keywords and dangerous patterns
      for (const pattern of this.sql_patterns) {
        if (pattern.test(input)) {
          violations.push(`SQL pattern detected: ${pattern.source}`);
          risk_level = 'critical';
          this.violations_found++;
        }
      }

      // Check for suspicious character sequences
      if (/(-{2}|\/\*|\*\/|xp_|sp_)/i.test(input)) {
        violations.push('SQL comment or extended stored procedure detected');
        risk_level = 'high';
        this.violations_found++;
      }

      return {
        valid: violations.length === 0,
        cleaned: this.escapeSQLString(input),
        reason: violations.length > 0 ? 'SQL injection detected' : undefined,
        risk_level,
        violations,
      };
    } catch (error) {
      this.logError(`SQL validation error: ${error}`);
      return {
        valid: false,
        reason: String(error),
        risk_level: 'critical',
        violations: [String(error)],
      };
    }
  }

  /**
   * Escape SQL string
   */
  private escapeSQLString(input: string): string {
    return input
      .replace(/'/g, "''")
      .replace(/"/g, '\\"')
      .replace(/\\/g, '\\\\');
  }

  // ────────── XSS Prevention (2) ──────────

  /**
   * Check for XSS (Cross-Site Scripting) attacks
   */
  validateXSSInput(input: string): ValidationResult {
    try {
      const violations: string[] = [];
      let risk_level: ValidationResult['risk_level'] = 'safe';

      this.validation_count++;

      // Check for script tags and JavaScript
      for (const pattern of this.xss_patterns) {
        if (pattern.test(input)) {
          violations.push(`XSS pattern detected: ${pattern.source}`);
          if (risk_level === 'safe') {
            risk_level = 'high';
          }
          this.violations_found++;
        }
      }

      // Check for HTML tags
      if (/<[^>]*>/g.test(input)) {
        violations.push('HTML tags detected');
        risk_level = 'high';
        this.violations_found++;
      }

      return {
        valid: violations.length === 0,
        cleaned: this.sanitizeXSS(input),
        reason: violations.length > 0 ? 'XSS detected' : undefined,
        risk_level,
        violations,
      };
    } catch (error) {
      this.logError(`XSS validation error: ${error}`);
      return {
        valid: false,
        reason: String(error),
        risk_level: 'critical',
        violations: [String(error)],
      };
    }
  }

  /**
   * Sanitize XSS payload
   */
  private sanitizeXSS(input: string): string {
    return input
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<[^>]*>/g, '') // Remove all HTML tags
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/eval\(/gi, '');
  }

  // ────────── Command Injection Prevention (1) ──────────

  /**
   * Check for command injection
   */
  validateCommandInput(input: string): ValidationResult {
    try {
      const violations: string[] = [];
      let risk_level: ValidationResult['risk_level'] = 'safe';

      this.validation_count++;

      // Check for shell metacharacters
      if (/[;&|`$(){}[\]\\]/g.test(input)) {
        violations.push('Shell metacharacters detected');
        risk_level = 'high';
        this.violations_found++;
      }

      // Check for command substitution
      if (/\$\{.*\}/g.test(input)) {
        violations.push('Template injection detected');
        risk_level = 'critical';
        this.violations_found++;
      }

      // Check for path traversal
      if (/\.\.\/|\.\.\\|\.\.%/g.test(input)) {
        violations.push('Path traversal detected');
        risk_level = 'high';
        this.violations_found++;
      }

      return {
        valid: violations.length === 0,
        cleaned: input,
        reason: violations.length > 0 ? 'Command injection detected' : undefined,
        risk_level,
        violations,
      };
    } catch (error) {
      this.logError(`Command validation error: ${error}`);
      return {
        valid: false,
        reason: String(error),
        risk_level: 'critical',
        violations: [String(error)],
      };
    }
  }

  // ────────── Email Validation (1) ──────────

  /**
   * Validate email address
   */
  validateEmail(email: string): ValidationResult {
    try {
      this.validation_count++;

      const email_regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!email_regex.test(email)) {
        this.violations_found++;
        return {
          valid: false,
          reason: 'Invalid email format',
          risk_level: 'low',
          violations: ['Email does not match valid format'],
        };
      }

      // Check for common injection patterns in email
      if (this.validateSQLInput(email).violations.length > 0) {
        return {
          valid: false,
          reason: 'Email contains suspicious content',
          risk_level: 'medium',
          violations: ['Potential injection attack detected'],
        };
      }

      return {
        valid: true,
        risk_level: 'safe',
        violations: [],
      };
    } catch (error) {
      this.logError(`Email validation error: ${error}`);
      return {
        valid: false,
        reason: String(error),
        risk_level: 'medium',
        violations: [String(error)],
      };
    }
  }

  // ────────── URL Validation (1) ──────────

  /**
   * Validate URL
   */
  validateURL(url: string): ValidationResult {
    try {
      this.validation_count++;

      // Basic URL regex
      const url_regex = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

      if (!url_regex.test(url)) {
        this.violations_found++;
        return {
          valid: false,
          reason: 'Invalid URL format',
          risk_level: 'low',
          violations: ['URL does not match valid format'],
        };
      }

      // Check for javascript: protocol
      if (/javascript:/i.test(url)) {
        this.violations_found++;
        return {
          valid: false,
          reason: 'JavaScript protocol detected',
          risk_level: 'high',
          violations: ['JavaScript protocol not allowed'],
        };
      }

      return {
        valid: true,
        risk_level: 'safe',
        violations: [],
      };
    } catch (error) {
      this.logError(`URL validation error: ${error}`);
      return {
        valid: false,
        reason: String(error),
        risk_level: 'medium',
        violations: [String(error)],
      };
    }
  }

  // ────────── General Sanitization (1) ──────────

  /**
   * General input sanitization
   */
  sanitize(input: string, strict: boolean = false): SanitizedData {
    try {
      let output = input;
      let removed = 0;

      // Remove dangerous characters
      const dangerous_chars = strict ? /[<>\"'`;&|$(){}\\[\]]/g : /[<>]/g;
      const matches = output.match(dangerous_chars) || [];
      removed = matches.length;

      output = output.replace(dangerous_chars, '');

      // Trim whitespace
      output = output.trim();

      this.validation_count++;

      return {
        input,
        output,
        removed_characters: removed,
        risk_detected: removed > 0,
      };
    } catch (error) {
      this.logError(`Sanitization error: ${error}`);
      return {
        input,
        output: input,
        removed_characters: 0,
        risk_detected: true,
      };
    }
  }

  // ────────── Utilities ──────────

  /**
   * Get validation statistics
   */
  getStats(): {
    total_validations: number;
    violations_found: number;
    violation_rate: number;
  } {
    return {
      total_validations: this.validation_count,
      violations_found: this.violations_found,
      violation_rate:
        this.validation_count > 0
          ? (this.violations_found / this.validation_count) * 100
          : 0,
    };
  }

  /**
   * Get error log
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
   * Log error
   */
  private logError(message: string): void {
    this.error_log.push(`[${new Date().toISOString()}] ${message}`);
  }
}

export default InputValidator;
