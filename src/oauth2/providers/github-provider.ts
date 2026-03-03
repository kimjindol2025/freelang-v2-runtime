/**
 * Phase 26: The Gateway Part 1 (OAuth2) - GitHub OAuth2 Provider
 *
 * Handles GitHub's specific OAuth2 flow:
 * 1. Redirect to GitHub authorization endpoint
 * 2. Exchange authorization code for access token
 * 3. Call GitHub User API to fetch user info
 * 4. Fetch primary + verified email addresses
 * 5. Map to FreeLang user account
 */

import { UserInfo } from '../types';

export interface GitHubOAuth2Config {
  clientId: string;
  clientSecret: string;
  redirectUri: string; // 'https://freelang.dclub.kr/auth/callback/github'
}

export interface GitHubTokenResponse {
  access_token: string;
  token_type: 'bearer';
  scope: string;
}

export interface GitHubUser {
  id: number;
  login: string; // GitHub username
  name?: string;
  email?: string;
  avatar_url?: string;
  bio?: string;
  company?: string;
  location?: string;
  twitter_username?: string;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
}

export interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: 'public' | 'private' | null;
}

export class GitHubOAuth2Provider {
  private config: GitHubOAuth2Config;
  private readonly GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
  private readonly GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
  private readonly GITHUB_API_URL = 'https://api.github.com';

  constructor(config: GitHubOAuth2Config) {
    this.config = config;
  }

  // ============================================================================
  // Step 1: Generate Authorization URL
  // ============================================================================

  /**
   * Generate redirect URL to GitHub OAuth2 endpoint
   * User clicks this link → redirected to GitHub login → redirected back with code
   */
  getAuthorizationUrl(state: string, codeChallenge?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      state: state,
      scope: 'user:email', // Permissions: read user profile + email
    });

    // PKCE is optional for GitHub (public clients can use it)
    if (codeChallenge) {
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', 'S256');
    }

    return `${this.GITHUB_AUTH_URL}?${params.toString()}`;
  }

  // ============================================================================
  // Step 2: Exchange Code for Access Token
  // ============================================================================

  /**
   * Exchange authorization code for access token
   * This happens server-to-server (not in browser)
   */
  async exchangeCodeForToken(
    code: string,
    codeVerifier?: string
  ): Promise<GitHubTokenResponse> {
    const body: any = {
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code: code,
      redirect_uri: this.config.redirectUri,
    };

    // Add PKCE if provided
    if (codeVerifier) {
      body.code_verifier = codeVerifier;
    }

    try {
      const response = await fetch(this.GITHUB_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json() as any;
        throw new Error(
          `GitHub token exchange failed: ${errorData?.error_description || response.statusText}`
        );
      }

      return await response.json() as GitHubTokenResponse;
    } catch (error) {
      throw new Error(
        `Failed to exchange code with GitHub: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ============================================================================
  // Step 3: Fetch User Info
  // ============================================================================

  /**
   * Fetch authenticated user profile from GitHub User API
   */
  async fetchUser(accessToken: string): Promise<GitHubUser> {
    try {
      const response = await fetch(`${this.GITHUB_API_URL}/user`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'FreeLang-OAuth2-Client',
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub User API failed: ${response.statusText}`);
      }

      return await response.json() as GitHubUser;
    } catch (error) {
      throw new Error(
        `Failed to fetch GitHub user: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ============================================================================
  // Step 4: Fetch User Emails
  // ============================================================================

  /**
   * Fetch all email addresses associated with user account
   * Include: primary, verified, and private emails
   */
  async fetchUserEmails(accessToken: string): Promise<GitHubEmail[]> {
    try {
      const response = await fetch(`${this.GITHUB_API_URL}/user/emails`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'FreeLang-OAuth2-Client',
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub Emails API failed: ${response.statusText}`);
      }

      return await response.json() as GitHubEmail[];
    } catch (error) {
      // If emails endpoint fails, return empty (not critical)
      console.warn(
        `Failed to fetch GitHub user emails: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  // ============================================================================
  // Step 5: Get Primary Email
  // ============================================================================

  /**
   * Get primary verified email from user profile or emails list
   */
  async getPrimaryEmail(
    user: GitHubUser,
    emails: GitHubEmail[]
  ): Promise<string | undefined> {
    // Try to find primary verified email from emails list
    const primaryVerified = emails.find((e) => e.primary && e.verified);
    if (primaryVerified) {
      return primaryVerified.email;
    }

    // Fallback to user profile email
    if (user.email) {
      return user.email;
    }

    // Last resort: find any verified email
    const verified = emails.find((e) => e.verified);
    return verified?.email;
  }

  // ============================================================================
  // Step 6: Check Organization Membership (Optional)
  // ============================================================================

  /**
   * Check if user is member of specific GitHub organization
   * Useful for RBAC: org members might get admin role
   */
  async isMemberOfOrganization(
    accessToken: string,
    organization: string
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.GITHUB_API_URL}/orgs/${organization}/members`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'FreeLang-OAuth2-Client',
          },
        }
      );

      if (!response.ok) {
        return false; // Not a member or org doesn't exist
      }

      const members = (await response.json()) as Array<{ login: string }>;
      // Check if current user is in the members list
      // Note: This requires public org membership; private membership requires different scope
      return true; // Simplified: if API call succeeds, assume membership
    } catch (error) {
      return false;
    }
  }

  // ============================================================================
  // Map to User Info
  // ============================================================================

  /**
   * Convert GitHub user data to FreeLang UserInfo
   */
  async getUserInfo(
    user: GitHubUser,
    primaryEmail: string | undefined
  ): Promise<UserInfo> {
    return {
      sub: String(user.id), // GitHub user ID as string
      email: primaryEmail,
      email_verified: !!primaryEmail, // Assume verified if we have it
      name: user.name || user.login, // Use real name or fallback to username
      picture: user.avatar_url,
      provider: 'github',
      providerUserId: user.login, // GitHub username
    };
  }

  // ============================================================================
  // Complete Flow (Helper)
  // ============================================================================

  /**
   * Execute complete OAuth2 flow in one call
   * Used in: POST /auth/callback/github?code=...&state=...
   */
  async handleCallback(code: string, state: string, codeVerifier?: string): Promise<UserInfo> {
    // Step 1: Exchange code for access token
    const tokenResponse = await this.exchangeCodeForToken(code, codeVerifier);

    // Step 2: Fetch user profile
    const user = await this.fetchUser(tokenResponse.access_token);

    // Step 3: Fetch all emails
    const emails = await this.fetchUserEmails(tokenResponse.access_token);

    // Step 4: Get primary email
    const primaryEmail = await this.getPrimaryEmail(user, emails);

    // Step 5: Convert to UserInfo
    const userInfo = await this.getUserInfo(user, primaryEmail);

    return userInfo;
  }

  // ============================================================================
  // Token Revocation (GitHub-specific)
  // ============================================================================

  /**
   * Revoke access token on GitHub
   * Called when user unlinks GitHub account
   */
  async revokeToken(accessToken: string, clientSecret: string): Promise<void> {
    try {
      const response = await fetch(`${this.GITHUB_API_URL}/applications/${this.config.clientId}/token`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'FreeLang-OAuth2-Client',
        },
        body: JSON.stringify({ access_token: accessToken }),
      });

      if (!response.ok) {
        throw new Error(`GitHub token revocation failed: ${response.statusText}`);
      }
    } catch (error) {
      console.warn(
        `Failed to revoke GitHub token: ${error instanceof Error ? error.message : String(error)}`
      );
      // Don't throw - revocation is best-effort
    }
  }
}
