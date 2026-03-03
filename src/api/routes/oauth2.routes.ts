/**
 * Phase 26-2: The Gateway Part 1 (Express Routes Integration)
 * OAuth2 Endpoints for Google/GitHub Social Login
 */

import { Router, Request, Response, NextFunction } from 'express';
import { AuthorizationServer } from '../../oauth2/authorization-server';
import { GoogleOAuth2Provider } from '../../oauth2/providers/google-provider';
import { GitHubOAuth2Provider } from '../../oauth2/providers/github-provider';
import { AccountLinker } from '../../oauth2/account-linker';
import { OAuth2Config } from '../../oauth2/types';

export class OAuth2Routes {
  private router: Router;
  private authServer: AuthorizationServer;
  private googleProvider: GoogleOAuth2Provider;
  private githubProvider: GitHubOAuth2Provider;
  private accountLinker: AccountLinker;

  constructor(
    authServerConfig: OAuth2Config,
    googleConfig: any,
    githubConfig: any
  ) {
    this.router = Router();
    this.authServer = new AuthorizationServer(authServerConfig);
    this.googleProvider = new GoogleOAuth2Provider(googleConfig);
    this.githubProvider = new GitHubOAuth2Provider(githubConfig);
    this.accountLinker = new AccountLinker();

    this.setupRoutes();
  }

  private setupRoutes(): void {
    // =========================================================================
    // Step 1: Authorization Endpoint (Redirect to Google/GitHub)
    // =========================================================================

    /**
     * POST /oauth2/authorize?provider=google
     * Generates authorization URL and redirects user to Google OAuth2 endpoint
     */
    this.router.get('/authorize', (req: Request, res: Response) => {
      const { provider } = req.query as { provider?: string };

      if (!provider || !['google', 'github'].includes(provider)) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'provider must be "google" or "github"',
        });
      }

      // Generate PKCE
      const { codeVerifier, codeChallenge } = AuthorizationServer.generatePKCE();

      // Store code_verifier in session for later validation
      if (!req.session) req.session = {};
      (req.session as any).pkceCodeVerifier = codeVerifier;
      (req.session as any).oauthProvider = provider;

      // Generate state for CSRF protection
      const state = Math.random().toString(36).substring(2, 15) +
                   Math.random().toString(36).substring(2, 15);
      (req.session as any).oauthState = state;

      let authorizationUrl: string;

      if (provider === 'google') {
        authorizationUrl = this.googleProvider.getAuthorizationUrl(state, codeChallenge);
      } else {
        authorizationUrl = this.githubProvider.getAuthorizationUrl(state, codeChallenge);
      }

      // Redirect to provider
      res.redirect(authorizationUrl);
    });

    // =========================================================================
    // Step 2: Callback Handler (Receive authorization code from provider)
    // =========================================================================

    /**
     * GET /auth/callback/google?code=...&state=...
     * Processes Google's callback with authorization code
     */
    this.router.get('/auth/callback/google', async (req: Request, res: Response) => {
      await this.handleOAuth2Callback(req, res, 'google');
    });

    /**
     * GET /auth/callback/github?code=...&state=...
     * Processes GitHub's callback with authorization code
     */
    this.router.get('/auth/callback/github', async (req: Request, res: Response) => {
      await this.handleOAuth2Callback(req, res, 'github');
    });

    // =========================================================================
    // Step 3: Token Endpoint (Issue JWT after account linking)
    // =========================================================================

    /**
     * POST /oauth2/token
     * Issues FreeLang JWT token after successful social login
     * Used by client to get access token for API calls
     */
    this.router.post('/token', (req: Request, res: Response) => {
      const { grant_type, code, client_id, client_secret, redirect_uri, code_verifier } =
        req.body;

      // Delegate to authorization server
      const tokenResponse = this.authServer.token({
        grant_type: grant_type as any,
        code,
        client_id,
        client_secret,
        redirect_uri,
        code_verifier,
      });

      if ('error' in tokenResponse) {
        return res.status(400).json(tokenResponse);
      }

      res.json(tokenResponse);
    });

    // =========================================================================
    // Step 4: Revocation Endpoint
    // =========================================================================

    /**
     * POST /oauth2/revoke
     * Revokes an access token or refresh token
     */
    this.router.post('/revoke', (req: Request, res: Response) => {
      const { token, client_id, client_secret } = req.body;

      const revokeResponse = this.authServer.revoke({
        token,
        client_id,
        client_secret,
      });

      if ('error' in revokeResponse) {
        return res.status(400).json(revokeResponse);
      }

      res.json(revokeResponse);
    });

    // =========================================================================
    // User Info & Account Management
    // =========================================================================

    /**
     * GET /api/me
     * Get current authenticated user info
     * Requires: Bearer token in Authorization header
     */
    this.router.get('/api/me', (req: Request, res: Response) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'unauthorized' });
      }

      const token = authHeader.substring(7);
      const claims = this.authServer.verifyAccessToken(token);

      if (!claims) {
        return res.status(401).json({ error: 'invalid_token' });
      }

      // Fetch user from account linker
      const user = this.accountLinker.getUser(claims.sub);

      if (!user) {
        return res.status(404).json({ error: 'user_not_found' });
      }

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        picture: user.picture,
        socialAccounts: user.socialAccounts,
      });
    });

    /**
     * POST /api/account/unlink
     * Unlink a social account from the user
     * Requires: Bearer token + { provider: "google" | "github" }
     */
    this.router.post('/api/account/unlink', async (req: Request, res: Response) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'unauthorized' });
      }

      const token = authHeader.substring(7);
      const claims = this.authServer.verifyAccessToken(token);

      if (!claims) {
        return res.status(401).json({ error: 'invalid_token' });
      }

      const { provider } = req.body;

      if (!['google', 'github'].includes(provider)) {
        return res.status(400).json({ error: 'invalid_provider' });
      }

      // Unlink account
      const user = await this.accountLinker.unlinkAccount(claims.sub, provider);

      if (!user) {
        return res.status(404).json({ error: 'user_not_found' });
      }

      res.json({
        success: true,
        message: `${provider} account unlinked`,
        socialAccounts: user.socialAccounts,
      });
    });

    // =========================================================================
    // Health & Metrics
    // =========================================================================

    /**
     * GET /oauth2/health
     * OAuth2 server health check
     */
    this.router.get('/health', (req: Request, res: Response) => {
      const metrics = this.authServer.getMetrics();

      res.json({
        status: 'ok',
        version: 'v2.1.0-phase26',
        metrics,
      });
    });
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async handleOAuth2Callback(
    req: Request,
    res: Response,
    provider: 'google' | 'github'
  ): Promise<void> {
    const { code, state } = req.query as { code?: string; state?: string };
    const session = (req.session as any) || {};

    // Validate state (CSRF protection)
    if (!state || state !== session.oauthState) {
      return res.status(400).json({
        error: 'invalid_state',
        error_description: 'State parameter mismatch',
      });
    }

    // Validate provider consistency
    if (provider !== session.oauthProvider) {
      return res.status(400).json({
        error: 'provider_mismatch',
        error_description: 'OAuth provider mismatch',
      });
    }

    if (!code) {
      return res.status(400).json({
        error: 'missing_code',
        error_description: 'Authorization code not provided by provider',
      });
    }

    try {
      const codeVerifier = session.pkceCodeVerifier;

      let userInfo;

      if (provider === 'google') {
        userInfo = await this.googleProvider.handleCallback(code, state, codeVerifier);
      } else {
        userInfo = await this.githubProvider.handleCallback(code, state, codeVerifier);
      }

      // Link or create account
      const result = await this.accountLinker.linkAccount(userInfo);

      // Issue JWT token
      const accessToken = (this.authServer as any).generateAccessToken(
        'freelang-web',
        'openid profile email',
        result.user.id
      );

      // Store user in session
      session.userId = result.user.id;
      session.accessToken = accessToken;

      // Redirect to success page with token
      const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/success?token=${accessToken}&user=${result.user.id}&isNewUser=${result.isNewUser}`;

      res.redirect(redirectUrl);
    } catch (error) {
      console.error(`OAuth2 callback error (${provider}):`, error);

      res.status(500).json({
        error: 'oauth2_error',
        error_description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  getRouter(): Router {
    return this.router;
  }
}

export default OAuth2Routes;
