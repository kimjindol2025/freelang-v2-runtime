/**
 * Phase 26: The Gateway Part 1 (OAuth2) - Authorization Server
 * RFC 6749 + RFC 7636 (PKCE) Implementation
 *
 * Responsibilities:
 * 1. Authorization endpoint (step 1-2: code generation)
 * 2. Token endpoint (step 3-4: code exchange → access token)
 * 3. Refresh token flow (RFC 6749 §6)
 * 4. Token revocation (RFC 7009)
 * 5. PKCE support (RFC 7636): S256 code challenge verification
 */

import { createHash, createHmac, randomBytes } from 'crypto';
import {
  OAuth2Config,
  AuthorizationRequest,
  AuthorizationResponse,
  TokenRequest,
  TokenResponse,
  RevocationRequest,
  RevocationResponse,
  OAuth2Error,
  OAuth2ErrorCode,
  AccessTokenClaims,
  StoredAuthorizationCode,
  StoredRefreshToken,
  AuthorizationServerState,
} from './types';

export class AuthorizationServer {
  private config: OAuth2Config;
  private state: AuthorizationServerState;

  constructor(config: OAuth2Config) {
    this.config = config;
    this.state = {
      authorizationCodes: new Map(),
      refreshTokens: new Map(),
      revokedTokens: new Set(),
    };
  }

  // ============================================================================
  // Step 1-2: Authorization Endpoint (RFC 6749 §4.1.1)
  // ============================================================================

  /**
   * Generate authorization code
   * Input: AuthorizationRequest (client_id, redirect_uri, state, code_challenge)
   * Output: AuthorizationResponse (code, state)
   */
  authorize(request: AuthorizationRequest): AuthorizationResponse | OAuth2Error {
    // Validate required parameters
    if (!request.client_id) {
      return {
        error: OAuth2ErrorCode.INVALID_REQUEST,
        error_description: 'client_id is required',
      };
    }

    if (!request.redirect_uri) {
      return {
        error: OAuth2ErrorCode.INVALID_REQUEST,
        error_description: 'redirect_uri is required',
      };
    }

    if (!request.state) {
      return {
        error: OAuth2ErrorCode.INVALID_REQUEST,
        error_description: 'state is required for CSRF protection',
      };
    }

    if (request.response_type !== 'code') {
      return {
        error: OAuth2ErrorCode.INVALID_REQUEST,
        error_description: 'response_type must be "code"',
        state: request.state,
      };
    }

    // Validate PKCE (RFC 7636)
    if (this.config.pkceRequired && !request.code_challenge) {
      return {
        error: OAuth2ErrorCode.INVALID_REQUEST,
        error_description: 'code_challenge is required (PKCE)',
        state: request.state,
      };
    }

    if (request.code_challenge) {
      if (request.code_challenge.length < 43 || request.code_challenge.length > 128) {
        return {
          error: OAuth2ErrorCode.INVALID_CODE_CHALLENGE,
          error_description: 'code_challenge must be 43-128 characters',
          state: request.state,
        };
      }
    }

    // Generate authorization code (10-digit alphanumeric)
    const code = randomBytes(6).toString('hex').toUpperCase().substring(0, 12);

    // Store authorization code (10-minute TTL)
    const expiresAt = Date.now() + this.config.authorizationCodeTTL * 1000;
    this.state.authorizationCodes.set(code, {
      code,
      clientId: request.client_id,
      redirectUri: request.redirect_uri,
      scope: request.scope || 'openid profile email',
      codeChallenge: request.code_challenge,
      codeChallengeMethod: request.code_challenge_method || 'S256',
      expiresAt,
      used: false,
    });

    return {
      code,
      state: request.state,
    };
  }

  // ============================================================================
  // Step 3-4: Token Endpoint (RFC 6749 §4.1.3)
  // ============================================================================

  /**
   * Exchange authorization code for tokens
   * Input: TokenRequest (code, client_id, client_secret, code_verifier)
   * Output: TokenResponse (access_token, refresh_token, expires_in)
   */
  token(request: TokenRequest): TokenResponse | OAuth2Error {
    // Route by grant_type
    if (request.grant_type === 'authorization_code') {
      return this.handleAuthorizationCodeGrant(request);
    } else if (request.grant_type === 'refresh_token') {
      return this.handleRefreshTokenGrant(request);
    } else {
      return {
        error: OAuth2ErrorCode.UNSUPPORTED_GRANT_TYPE,
        error_description: `grant_type "${request.grant_type}" is not supported`,
      };
    }
  }

  private handleAuthorizationCodeGrant(request: TokenRequest): TokenResponse | OAuth2Error {
    // Validate required parameters
    if (!request.code) {
      return {
        error: OAuth2ErrorCode.INVALID_REQUEST,
        error_description: 'code is required',
      };
    }

    if (!request.client_id || !request.client_secret) {
      return {
        error: OAuth2ErrorCode.INVALID_CLIENT,
        error_description: 'client_id and client_secret are required',
      };
    }

    if (!request.redirect_uri) {
      return {
        error: OAuth2ErrorCode.INVALID_REQUEST,
        error_description: 'redirect_uri is required',
      };
    }

    // Retrieve authorization code
    const authCode = this.state.authorizationCodes.get(request.code);
    if (!authCode) {
      return {
        error: OAuth2ErrorCode.INVALID_GRANT,
        error_description: 'authorization code not found or expired',
      };
    }

    // Validate: not expired
    if (Date.now() > authCode.expiresAt) {
      this.state.authorizationCodes.delete(request.code);
      return {
        error: OAuth2ErrorCode.INVALID_GRANT,
        error_description: 'authorization code has expired',
      };
    }

    // Validate: not already used (one-time use)
    if (authCode.used) {
      this.state.authorizationCodes.delete(request.code);
      return {
        error: OAuth2ErrorCode.INVALID_GRANT,
        error_description: 'authorization code has already been used',
      };
    }

    // Validate: client_id matches
    if (authCode.clientId !== request.client_id) {
      return {
        error: OAuth2ErrorCode.INVALID_CLIENT,
        error_description: 'client_id does not match authorization request',
      };
    }

    // Validate: redirect_uri matches
    if (authCode.redirectUri !== request.redirect_uri) {
      return {
        error: OAuth2ErrorCode.INVALID_GRANT,
        error_description: 'redirect_uri does not match authorization request',
      };
    }

    // Validate PKCE (RFC 7636 §4.5)
    if (authCode.codeChallenge) {
      if (!request.code_verifier) {
        return {
          error: OAuth2ErrorCode.INVALID_REQUEST,
          error_description: 'code_verifier is required for PKCE',
        };
      }

      const verified = this.verifyChallengeAndVerifier(
        authCode.codeChallenge,
        request.code_verifier,
        authCode.codeChallengeMethod || 'S256'
      );

      if (!verified) {
        return {
          error: OAuth2ErrorCode.INVALID_CODE_VERIFIER,
          error_description: 'code_verifier does not match code_challenge',
        };
      }
    }

    // Mark as used (one-time use enforcement)
    authCode.used = true;

    // Generate access token (1-hour TTL)
    const accessToken = this.generateAccessToken(
      request.client_id,
      authCode.scope,
      authCode.userId || request.client_id
    );

    // Generate refresh token (30-day TTL)
    const refreshToken = randomBytes(32).toString('hex');
    const refreshTokenExpiresAt = Date.now() + this.config.refreshTokenTTL * 1000;
    this.state.refreshTokens.set(refreshToken, {
      token: refreshToken,
      clientId: request.client_id,
      userId: authCode.userId || request.client_id,
      scope: authCode.scope,
      expiresAt: refreshTokenExpiresAt,
      rotated: false,
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.config.accessTokenTTL,
      refresh_token: refreshToken,
      scope: authCode.scope,
    };
  }

  private handleRefreshTokenGrant(request: TokenRequest): TokenResponse | OAuth2Error {
    // Validate required parameters
    if (!request.refresh_token) {
      return {
        error: OAuth2ErrorCode.INVALID_REQUEST,
        error_description: 'refresh_token is required',
      };
    }

    if (!request.client_id || !request.client_secret) {
      return {
        error: OAuth2ErrorCode.INVALID_CLIENT,
        error_description: 'client_id and client_secret are required',
      };
    }

    // Retrieve refresh token
    const refreshTokenRecord = this.state.refreshTokens.get(request.refresh_token);
    if (!refreshTokenRecord) {
      return {
        error: OAuth2ErrorCode.INVALID_GRANT,
        error_description: 'refresh token not found or revoked',
      };
    }

    // Validate: not expired
    if (Date.now() > refreshTokenRecord.expiresAt) {
      this.state.refreshTokens.delete(request.refresh_token);
      return {
        error: OAuth2ErrorCode.INVALID_GRANT,
        error_description: 'refresh token has expired',
      };
    }

    // Validate: client_id matches
    if (refreshTokenRecord.clientId !== request.client_id) {
      return {
        error: OAuth2ErrorCode.INVALID_CLIENT,
        error_description: 'client_id does not match refresh token',
      };
    }

    // Generate new access token
    const newAccessToken = this.generateAccessToken(
      request.client_id,
      refreshTokenRecord.scope,
      refreshTokenRecord.userId
    );

    // Optionally rotate refresh token (RFC 6749 §6)
    // For now, keep the same refresh token
    const response: TokenResponse = {
      access_token: newAccessToken,
      token_type: 'Bearer',
      expires_in: this.config.accessTokenTTL,
      scope: refreshTokenRecord.scope,
    };

    // Include new refresh token if rotation is enabled
    if (this.config.refreshTokenTTL > 0) {
      const newRefreshToken = randomBytes(32).toString('hex');
      const newExpiresAt = Date.now() + this.config.refreshTokenTTL * 1000;

      this.state.refreshTokens.delete(request.refresh_token);
      this.state.refreshTokens.set(newRefreshToken, {
        token: newRefreshToken,
        clientId: request.client_id,
        userId: refreshTokenRecord.userId,
        scope: refreshTokenRecord.scope,
        expiresAt: newExpiresAt,
        rotated: true,
      });

      response.refresh_token = newRefreshToken;
    }

    return response;
  }

  // ============================================================================
  // Token Revocation (RFC 7009)
  // ============================================================================

  /**
   * Revoke an access token or refresh token
   */
  revoke(request: RevocationRequest): RevocationResponse | OAuth2Error {
    if (!request.token) {
      return {
        error: OAuth2ErrorCode.INVALID_REQUEST,
        error_description: 'token is required',
      };
    }

    // Add to blacklist
    this.state.revokedTokens.add(request.token);

    // Also remove from stores if possible
    this.state.refreshTokens.delete(request.token);

    return {
      success: true,
      message: 'Token revoked successfully',
    };
  }

  // ============================================================================
  // PKCE Validation (RFC 7636)
  // ============================================================================

  private verifyChallengeAndVerifier(
    challenge: string,
    verifier: string,
    method: 'S256' | 'plain'
  ): boolean {
    if (method === 'plain') {
      return challenge === verifier;
    } else if (method === 'S256') {
      // S256 = BASE64URL(SHA256(code_verifier))
      const hash = createHash('sha256').update(verifier).digest();
      const base64url = hash.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      return challenge === base64url;
    }
    return false;
  }

  // ============================================================================
  // Token Generation
  // ============================================================================

  private generateAccessToken(clientId: string, scope: string, userId: string): string {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + this.config.accessTokenTTL;

    const claims: AccessTokenClaims = {
      sub: userId,
      client_id: clientId,
      scope,
      iat: now,
      exp,
      iss: this.config.issuer,
    };

    // Simple token format: base64(JSON).signature
    const claimsJson = JSON.stringify(claims);
    const claimsB64 = Buffer.from(claimsJson).toString('base64url');

    const signature = createHmac('sha256', this.config.jwtSecret)
      .update(claimsB64)
      .digest('base64url');

    return `${claimsB64}.${signature}`;
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Verify access token (called by resource servers)
   */
  verifyAccessToken(token: string): AccessTokenClaims | null {
    try {
      if (this.state.revokedTokens.has(token)) {
        return null; // Token is revoked
      }

      const parts = token.split('.');
      if (parts.length !== 2) return null;

      const [claimsB64, signature] = parts;

      // Verify signature
      const expectedSignature = createHmac('sha256', this.config.jwtSecret)
        .update(claimsB64)
        .digest('base64url');

      if (signature !== expectedSignature) {
        return null; // Signature mismatch
      }

      // Decode claims
      const claimsJson = Buffer.from(claimsB64, 'base64url').toString('utf-8');
      const claims = JSON.parse(claimsJson) as AccessTokenClaims;

      // Check expiration
      if (claims.exp < Math.floor(Date.now() / 1000)) {
        return null; // Token expired
      }

      return claims;
    } catch (error) {
      return null; // Invalid, expired, or tampered token
    }
  }

  /**
   * Generate PKCE code challenge for SPAs
   */
  static generatePKCE(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = randomBytes(32).toString('base64url').substring(0, 128);
    const hash = createHash('sha256').update(codeVerifier).digest();
    const codeChallenge = hash
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    return { codeVerifier, codeChallenge };
  }

  /**
   * Get server metrics for monitoring
   */
  getMetrics() {
    return {
      pendingAuthorizationCodes: this.state.authorizationCodes.size,
      activeRefreshTokens: this.state.refreshTokens.size,
      revokedTokens: this.state.revokedTokens.size,
    };
  }
}
