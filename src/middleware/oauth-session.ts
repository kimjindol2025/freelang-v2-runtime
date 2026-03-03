/**
 * Phase 26-2: OAuth2 Session Management Middleware
 * Handles PKCE state, session storage, and user context
 */

import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Session {
      userId?: string;
      accessToken?: string;
      pkceCodeVerifier?: string;
      oauthProvider?: string;
      oauthState?: string;
      linkedAt?: number;
    }
  }
}

/**
 * Middleware: Validate OAuth2 session state
 * Used before OAuth2 routes to ensure proper session setup
 */
export function validateOAuth2Session(req: Request, res: Response, next: NextFunction): void {
  if (!req.session) {
    req.session = {} as any;
  }
  next();
}

/**
 * Middleware: Require authenticated user (JWT token in session)
 * Protects routes that need user context
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const session = (req.session as any) || {};

  if (!session.userId) {
    return res.status(401).json({
      error: 'unauthorized',
      error_description: 'User not authenticated',
    });
  }

  // Attach user context to request
  (req as any).userId = session.userId;
  (req as any).accessToken = session.accessToken;

  next();
}

/**
 * Middleware: Optional auth (does not fail if no token)
 * Attaches user context if available
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const session = (req.session as any) || {};

  if (session.userId) {
    (req as any).userId = session.userId;
    (req as any).accessToken = session.accessToken;
  }

  next();
}

/**
 * Middleware: Clean up OAuth2 session after successful authentication
 */
export function cleanupOAuth2Session(req: Request, res: Response, next: NextFunction): void {
  const session = (req.session as any) || {};

  // Clear temporary OAuth2 state
  delete session.pkceCodeVerifier;
  delete session.oauthProvider;
  delete session.oauthState;

  next();
}

/**
 * Middleware: CSRF protection for OAuth2
 * Validates state parameter in callbacks
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const { state } = req.query as { state?: string };
  const session = (req.session as any) || {};

  if (!state) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'State parameter required',
    });
  }

  if (state !== session.oauthState) {
    return res.status(400).json({
      error: 'state_mismatch',
      error_description: 'CSRF validation failed',
    });
  }

  next();
}

/**
 * Middleware: Rate limiting for OAuth2 endpoints
 * Prevent brute force attacks on authorization endpoints
 */
export function oAuth2RateLimit() {
  const attempts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();

    let record = attempts.get(ip);

    if (!record) {
      record = { count: 1, resetTime: now + 60000 }; // 1-minute window
      attempts.set(ip, record);
      return next();
    }

    if (now > record.resetTime) {
      // Reset window
      record.count = 1;
      record.resetTime = now + 60000;
      return next();
    }

    record.count++;

    if (record.count > 10) {
      return res.status(429).json({
        error: 'too_many_requests',
        error_description: 'Rate limit exceeded for OAuth2 endpoints',
      });
    }

    next();
  };
}

/**
 * Middleware: Log OAuth2 activities for monitoring
 */
export function logOAuth2Activity(req: Request, res: Response, next: NextFunction): void {
  const session = (req.session as any) || {};
  const timestamp = new Date().toISOString();

  const activity = {
    timestamp,
    method: req.method,
    path: req.path,
    provider: session.oauthProvider || 'unknown',
    userId: session.userId || 'anonymous',
    ip: req.ip,
  };

  console.log('[OAuth2]', JSON.stringify(activity));

  next();
}

/**
 * Middleware: Handle OAuth2 errors gracefully
 */
export function handleOAuth2Error(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('[OAuth2 Error]', error);

  if (error.status === 401) {
    return res.status(401).json({
      error: 'unauthorized',
      error_description: 'OAuth2 authorization failed',
    });
  }

  if (error.status === 400) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: error.message || 'Invalid OAuth2 request',
    });
  }

  res.status(500).json({
    error: 'server_error',
    error_description: 'OAuth2 server error',
  });
}
