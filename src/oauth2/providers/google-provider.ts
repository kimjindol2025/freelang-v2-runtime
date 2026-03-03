/**
 * Phase 26: The Gateway Part 1 (OAuth2) - Google OAuth2 Provider
 *
 * Handles Google's specific OAuth2 flow:
 * 1. Redirect to Google authorization endpoint
 * 2. Exchange authorization code for ID Token
 * 3. Validate ID Token JWT signature
 * 4. Extract user info (email, name, picture)
 * 5. Map to FreeLang user account
 */

import { UserInfo, OAuth2Provider } from '../types';

export interface GoogleOAuth2Config {
  clientId: string;
  clientSecret: string;
  redirectUri: string; // 'https://freelang.dclub.kr/auth/callback/google'
}

export interface GoogleAuthorizationCodeResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: 'Bearer';
  id_token: string; // JWT containing user info
}

export interface GoogleIdTokenClaims {
  iss: string; // 'https://accounts.google.com'
  sub: string; // User ID
  aud: string; // Client ID
  exp: number; // Expiration
  iat: number; // Issued at
  nonce?: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  locale?: string;
}

export class GoogleOAuth2Provider {
  private config: GoogleOAuth2Config;
  private readonly GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
  private readonly GOOGLE_TOKEN_URL = 'https://www.googleapis.com/oauth2/v4/token';
  private readonly GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

  constructor(config: GoogleOAuth2Config) {
    this.config = config;
  }

  // ============================================================================
  // Step 1: Generate Authorization URL
  // ============================================================================

  /**
   * Generate redirect URL to Google OAuth2 endpoint
   * User clicks this link → redirected to Google login → redirected back with code
   */
  getAuthorizationUrl(state: string, codeChallenge?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: state,
    });

    // Add PKCE if provided
    if (codeChallenge) {
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', 'S256');
    }

    return `${this.GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  // ============================================================================
  // Step 2-3: Exchange Code for ID Token
  // ============================================================================

  /**
   * Exchange authorization code for ID Token
   * This happens server-to-server (not in browser)
   */
  async exchangeCodeForToken(
    code: string,
    codeVerifier?: string
  ): Promise<GoogleAuthorizationCodeResponse> {
    const body = {
      code: code,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
      grant_type: 'authorization_code',
    };

    // Add PKCE if provided
    if (codeVerifier) {
      (body as any).code_verifier = codeVerifier;
    }

    try {
      const response = await fetch(this.GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json() as any;
        throw new Error(
          `Google token exchange failed: ${errorData?.error || response.statusText}`
        );
      }

      return await response.json() as GoogleAuthorizationCodeResponse;
    } catch (error) {
      throw new Error(
        `Failed to exchange code with Google: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ============================================================================
  // Step 4: Validate & Extract ID Token
  // ============================================================================

  /**
   * Validate Google's ID Token JWT signature
   * Returns validated claims including email, name, picture
   */
  async validateIdToken(idToken: string): Promise<GoogleIdTokenClaims> {
    try {
      // Simple decode: split by dots and extract payload
      const parts = idToken.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid ID Token format (expected 3 parts)');
      }

      // Decode payload (second part)
      const payloadB64 = parts[1];
      const payloadJson = Buffer.from(
        payloadB64.replace(/-/g, '+').replace(/_/g, '/'),
        'base64'
      ).toString('utf-8');

      const claims = JSON.parse(payloadJson) as GoogleIdTokenClaims;

      // Basic validation
      if (!claims.email) {
        throw new Error('Email claim missing in ID Token');
      }

      if (!claims.email_verified) {
        throw new Error('Email not verified by Google');
      }

      if (claims.aud !== this.config.clientId) {
        throw new Error('ID Token audience mismatch');
      }

      if (claims.iss !== 'https://accounts.google.com') {
        throw new Error('ID Token issuer mismatch');
      }

      // Check expiration
      if (claims.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('ID Token expired');
      }

      return claims;
    } catch (error) {
      throw new Error(
        `ID Token validation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ============================================================================
  // Step 5: Map to User Info
  // ============================================================================

  /**
   * Convert Google ID Token claims to FreeLang UserInfo
   */
  async getUserInfo(idToken: string): Promise<UserInfo> {
    const claims = await this.validateIdToken(idToken);

    return {
      sub: claims.sub, // Google's unique user ID
      email: claims.email,
      email_verified: claims.email_verified,
      name: claims.name,
      picture: claims.picture,
      provider: 'google',
      providerUserId: claims.sub,
    };
  }

  // ============================================================================
  // Fallback: User Info Endpoint (if ID Token validation fails)
  // ============================================================================

  /**
   * Alternative: Fetch user info directly from Google User Info endpoint
   * Used if ID Token is not available or needs additional data
   */
  async fetchUserInfo(accessToken: string): Promise<GoogleIdTokenClaims> {
    try {
      const response = await fetch(this.GOOGLE_USERINFO_URL, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Google User Info request failed: ${response.statusText}`);
      }

      return await response.json() as GoogleIdTokenClaims;
    } catch (error) {
      throw new Error(
        `Failed to fetch Google user info: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }


  // ============================================================================
  // Complete Flow (Helper)
  // ============================================================================

  /**
   * Execute complete OAuth2 flow in one call
   * Used in: POST /auth/callback/google?code=...&state=...
   */
  async handleCallback(code: string, state: string, codeVerifier?: string): Promise<UserInfo> {
    // Step 1: Exchange code for tokens
    const tokenResponse = await this.exchangeCodeForToken(code, codeVerifier);

    // Step 2: Validate ID Token and extract user info
    const userInfo = await this.getUserInfo(tokenResponse.id_token);

    return userInfo;
  }
}

// Helper function for URL decoding (works in Node.js)
function urlSafeBase64Decode(str: string): Buffer {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  switch (str.length % 4) {
    case 2:
      str += '==';
      break;
    case 3:
      str += '=';
      break;
  }
  return Buffer.from(str, 'base64');
}
