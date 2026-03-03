/**
 * Phase 26: The Gateway Part 1 (OAuth2) - Type Definitions
 * RFC 6749, RFC 7636, RFC 7009 Compliance
 */

// ============================================================================
// OAuth2 Endpoints & Flow
// ============================================================================

export interface OAuth2Config {
  // Internal server
  issuer: string;              // 'https://freelang.dclub.kr'
  authorizationEndpoint: string;
  tokenEndpoint: string;
  revocationEndpoint: string;
  userinfoEndpoint: string;

  // PKCE support
  pkceRequired: boolean;       // true for SPAs
  codeChallengeMethod: 'S256' | 'plain';

  // Token expiration (seconds)
  authorizationCodeTTL: number; // 10 * 60
  accessTokenTTL: number;       // 60 * 60
  refreshTokenTTL: number;      // 30 * 24 * 60 * 60

  // JWT signing
  jwtSecret: string;
  jwtAlgorithm: 'HS256';
}

// ============================================================================
// Authorization Code Flow (RFC 6749 §4.1)
// ============================================================================

/**
 * Step 1: Authorization Request
 */
export interface AuthorizationRequest {
  client_id: string;            // OAuth2 Client ID
  response_type: 'code';        // 'code' for authorization code flow
  redirect_uri: string;         // Registered callback URL
  scope?: string;               // 'openid profile email' (space-separated)
  state: string;                // CSRF protection (recommended 32+ bytes)
  code_challenge?: string;      // PKCE S256 hash
  code_challenge_method?: 'S256' | 'plain';
}

/**
 * Step 2: Authorization Response
 */
export interface AuthorizationResponse {
  code: string;                 // Authorization code (10min TTL, 1-time use)
  state: string;                // Echo client's state
  session_state?: string;       // OpenID Connect session tracking
}

/**
 * Step 3: Token Request (RFC 6749 §4.1.3)
 */
export interface TokenRequest {
  grant_type: 'authorization_code' | 'refresh_token';
  code?: string;                // (required for authorization_code)
  client_id: string;
  client_secret: string;
  redirect_uri?: string;        // (required for authorization_code, not needed for refresh_token)
  code_verifier?: string;       // PKCE: SHA256(code_verifier) == code_challenge
  refresh_token?: string;       // (required for refresh_token grant)
}

/**
 * Step 4: Token Response (RFC 6749 §4.1.4)
 */
export interface TokenResponse {
  access_token: string;         // JWT or opaque token (1h TTL)
  token_type: 'Bearer';
  expires_in: number;           // 3600 seconds
  refresh_token?: string;       // 30-day TTL
  scope?: string;               // Granted scopes
  id_token?: string;            // OpenID Connect ID Token (JWT)
}

// ============================================================================
// Token Management
// ============================================================================

/**
 * Authorization Code Store (in-memory for now, DB in production)
 */
export interface StoredAuthorizationCode {
  code: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  userId?: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'S256' | 'plain';
  expiresAt: number;           // Epoch timestamp (10min)
  used: boolean;                // One-time use enforcement
}

/**
 * Access Token Claims (JWT payload)
 */
export interface AccessTokenClaims {
  sub: string;                  // Subject (user ID)
  client_id: string;
  scope: string;
  iat: number;                  // Issued at
  exp: number;                  // Expiration (1h)
  iss: string;                  // Issuer
}

/**
 * Refresh Token Store
 */
export interface StoredRefreshToken {
  token: string;
  clientId: string;
  userId: string;
  scope: string;
  expiresAt: number;           // Epoch timestamp (30 days)
  rotated: boolean;            // Refresh token rotation
}

// ============================================================================
// Token Revocation (RFC 7009)
// ============================================================================

export interface RevocationRequest {
  token: string;                // Access token or refresh token
  token_type_hint?: 'access_token' | 'refresh_token';
  client_id: string;
  client_secret: string;
}

export interface RevocationResponse {
  success: boolean;
  message?: string;
}

// ============================================================================
// Provider (Google/GitHub) Integration
// ============================================================================

export interface OAuth2Provider {
  name: 'google' | 'github';
  authorizationUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface GoogleOAuth2Config extends OAuth2Provider {
  name: 'google';
}

export interface GitHubOAuth2Config extends OAuth2Provider {
  name: 'github';
}

// ============================================================================
// User Info (after social login)
// ============================================================================

export interface UserInfo {
  sub: string;                  // Unique identifier (email for Google, username for GitHub)
  email?: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
  provider: 'google' | 'github';
  providerUserId: string;       // Google sub or GitHub id
}

export interface SocialAccount {
  provider: 'google' | 'github';
  providerUserId: string;
  email?: string;
  name?: string;
  picture?: string;
  linkedAt: Date;
}

// ============================================================================
// Errors
// ============================================================================

export enum OAuth2ErrorCode {
  // RFC 6749 §4.1.2.1, 5.2
  INVALID_REQUEST = 'invalid_request',
  INVALID_CLIENT = 'invalid_client',
  INVALID_GRANT = 'invalid_grant',
  UNAUTHORIZED_CLIENT = 'unauthorized_client',
  UNSUPPORTED_GRANT_TYPE = 'unsupported_grant_type',
  INVALID_SCOPE = 'invalid_scope',

  // PKCE
  INVALID_CODE_CHALLENGE = 'invalid_code_challenge',
  INVALID_CODE_VERIFIER = 'invalid_code_verifier',

  // Custom
  CODE_EXPIRED = 'code_expired',
  CODE_ALREADY_USED = 'code_already_used',
  STATE_MISMATCH = 'state_mismatch',
}

export interface OAuth2Error {
  error: OAuth2ErrorCode;
  error_description?: string;
  error_uri?: string;
  state?: string;              // Should echo client's state
}

// ============================================================================
// Internal: Authorization Server State
// ============================================================================

export interface AuthorizationServerState {
  authorizationCodes: Map<string, StoredAuthorizationCode>;
  refreshTokens: Map<string, StoredRefreshToken>;
  revokedTokens: Set<string>;  // Token blacklist
}
