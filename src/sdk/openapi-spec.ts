/**
 * Phase 27-1: OpenAPI 3.0 Specification Generator
 * Automatically generates OpenAPI spec from OAuth2 API routes
 */

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    contact: {
      name: string;
      url: string;
      email: string;
    };
    license: {
      name: string;
      url: string;
    };
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, PathItem>;
  components: Components;
  tags: Array<{
    name: string;
    description: string;
  }>;
}

export interface PathItem {
  [method: string]: Operation;
}

export interface Operation {
  tags: string[];
  summary: string;
  description: string;
  operationId: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  security?: Array<Record<string, string[]>>;
}

export interface Parameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  description: string;
  required: boolean;
  schema: Schema;
}

export interface RequestBody {
  description: string;
  required: boolean;
  content: Record<string, MediaType>;
}

export interface Response {
  description: string;
  content?: Record<string, MediaType>;
}

export interface MediaType {
  schema: Schema;
  examples?: Record<string, any>;
}

export interface Schema {
  type?: string;
  format?: string;
  description?: string;
  properties?: Record<string, Schema>;
  items?: Schema;
  required?: string[];
  enum?: any[];
  $ref?: string;
  oneOf?: Schema[];
  allOf?: Schema[];
}

export interface Components {
  securitySchemes: Record<string, SecurityScheme>;
  schemas: Record<string, Schema>;
}

export interface SecurityScheme {
  type: string;
  scheme?: string;
  bearerFormat?: string;
  flows?: {
    authorizationCode?: {
      authorizationUrl: string;
      tokenUrl: string;
      scopes: Record<string, string>;
    };
  };
}

/**
 * Generate OpenAPI 3.0 spec for FreeLang OAuth2 API
 */
export function generateOpenAPISpec(): OpenAPISpec {
  return {
    openapi: '3.0.0',
    info: {
      title: 'FreeLang OAuth2 Gateway API',
      version: '2.1.0',
      description: 'Social login API for Google and GitHub authentication with auto-provisioning',
      contact: {
        name: 'FreeLang Team',
        url: 'https://freelang.dclub.kr',
        email: 'support@freelang.dclub.kr',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'https://api.freelang.dclub.kr',
        description: 'Production server',
      },
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    paths: {
      '/oauth2/authorize': {
        get: {
          tags: ['Authorization'],
          summary: 'Get authorization URL',
          description: 'Initiates OAuth2 flow by redirecting to Google or GitHub',
          operationId: 'authorize',
          parameters: [
            {
              name: 'provider',
              in: 'query',
              description: 'OAuth2 provider (google or github)',
              required: true,
              schema: {
                type: 'string',
                enum: ['google', 'github'],
              },
            },
          ],
          responses: {
            '302': {
              description: 'Redirect to provider authorization endpoint',
            },
            '400': {
              description: 'Invalid provider',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/auth/callback/google': {
        get: {
          tags: ['Callback'],
          summary: 'Google OAuth2 callback',
          description: 'Handles Google authorization code and redirects with JWT',
          operationId: 'googleCallback',
          parameters: [
            {
              name: 'code',
              in: 'query',
              description: 'Authorization code from Google',
              required: true,
              schema: { type: 'string' },
            },
            {
              name: 'state',
              in: 'query',
              description: 'CSRF protection state parameter',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '302': {
              description: 'Redirect to frontend with access token',
            },
            '400': {
              description: 'Invalid code or state',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/auth/callback/github': {
        get: {
          tags: ['Callback'],
          summary: 'GitHub OAuth2 callback',
          description: 'Handles GitHub authorization code and redirects with JWT',
          operationId: 'githubCallback',
          parameters: [
            {
              name: 'code',
              in: 'query',
              description: 'Authorization code from GitHub',
              required: true,
              schema: { type: 'string' },
            },
            {
              name: 'state',
              in: 'query',
              description: 'CSRF protection state parameter',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '302': {
              description: 'Redirect to frontend with access token',
            },
            '400': {
              description: 'Invalid code or state',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/oauth2/token': {
        post: {
          tags: ['Token'],
          summary: 'Issue or refresh tokens',
          description: 'Exchange authorization code or refresh token for access token',
          operationId: 'token',
          requestBody: {
            description: 'Token request',
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TokenRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Token issued successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/TokenResponse' },
                },
              },
            },
            '400': {
              description: 'Invalid request',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/oauth2/revoke': {
        post: {
          tags: ['Token'],
          summary: 'Revoke access token',
          description: 'Invalidates an access or refresh token',
          operationId: 'revoke',
          requestBody: {
            description: 'Revocation request',
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RevokeRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Token revoked successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Invalid token',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/api/me': {
        get: {
          tags: ['User'],
          summary: 'Get current user profile',
          description: 'Returns authenticated user information',
          operationId: 'getMe',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'User profile',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/UserProfile' },
                },
              },
            },
            '401': {
              description: 'Unauthorized - missing or invalid token',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/api/account/unlink': {
        post: {
          tags: ['User'],
          summary: 'Unlink social account',
          description: 'Removes a linked social provider from user account',
          operationId: 'unlinkAccount',
          security: [{ bearerAuth: [] }],
          requestBody: {
            description: 'Unlink request',
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UnlinkRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Account unlinked successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/UnlinkResponse' },
                },
              },
            },
            '400': {
              description: 'Invalid provider',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
            '401': {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/oauth2/health': {
        get: {
          tags: ['Health'],
          summary: 'OAuth2 server health check',
          description: 'Returns server status and metrics',
          operationId: 'health',
          responses: {
            '200': {
              description: 'Server is healthy',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/HealthResponse' },
                },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error code',
            },
            error_description: {
              type: 'string',
              description: 'Human-readable error message',
            },
          },
          required: ['error'],
        },
        TokenRequest: {
          type: 'object',
          properties: {
            grant_type: {
              type: 'string',
              enum: ['authorization_code', 'refresh_token'],
              description: 'Grant type',
            },
            code: {
              type: 'string',
              description: 'Authorization code (for authorization_code grant)',
            },
            refresh_token: {
              type: 'string',
              description: 'Refresh token (for refresh_token grant)',
            },
            client_id: {
              type: 'string',
              description: 'Client ID',
            },
            client_secret: {
              type: 'string',
              description: 'Client secret',
            },
            redirect_uri: {
              type: 'string',
              description: 'Redirect URI',
            },
            code_verifier: {
              type: 'string',
              description: 'PKCE code verifier',
            },
          },
          required: ['grant_type', 'client_id'],
        },
        TokenResponse: {
          type: 'object',
          properties: {
            access_token: {
              type: 'string',
              description: 'JWT access token',
            },
            refresh_token: {
              type: 'string',
              description: 'Refresh token',
            },
            token_type: {
              type: 'string',
              enum: ['Bearer'],
            },
            expires_in: {
              type: 'integer',
              description: 'Token expiration in seconds',
            },
          },
          required: ['access_token', 'token_type'],
        },
        RevokeRequest: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'Token to revoke',
            },
            client_id: {
              type: 'string',
              description: 'Client ID',
            },
            client_secret: {
              type: 'string',
              description: 'Client secret',
            },
          },
          required: ['token', 'client_id'],
        },
        UserProfile: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'User ID',
            },
            username: {
              type: 'string',
              description: 'Username',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email address',
            },
            name: {
              type: 'string',
              description: 'Full name',
            },
            picture: {
              type: 'string',
              format: 'uri',
              description: 'Profile picture URL',
            },
            socialAccounts: {
              type: 'array',
              items: { $ref: '#/components/schemas/SocialAccount' },
            },
          },
          required: ['id', 'email', 'socialAccounts'],
        },
        SocialAccount: {
          type: 'object',
          properties: {
            provider: {
              type: 'string',
              enum: ['google', 'github'],
              description: 'Provider name',
            },
            providerUserId: {
              type: 'string',
              description: 'User ID from provider',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email from provider',
            },
            name: {
              type: 'string',
              description: 'Name from provider',
            },
            picture: {
              type: 'string',
              format: 'uri',
              description: 'Profile picture from provider',
            },
            linkedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp when linked',
            },
          },
          required: ['provider', 'providerUserId'],
        },
        UnlinkRequest: {
          type: 'object',
          properties: {
            provider: {
              type: 'string',
              enum: ['google', 'github'],
              description: 'Provider to unlink',
            },
          },
          required: ['provider'],
        },
        UnlinkResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
            },
            message: {
              type: 'string',
            },
            socialAccounts: {
              type: 'array',
              items: { $ref: '#/components/schemas/SocialAccount' },
            },
          },
          required: ['success', 'socialAccounts'],
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['ok'],
            },
            version: {
              type: 'string',
            },
            metrics: {
              type: 'object',
              properties: {
                uptime: { type: 'number' },
                requestCount: { type: 'integer' },
                errorCount: { type: 'integer' },
              },
            },
          },
          required: ['status'],
        },
      },
    },
    tags: [
      {
        name: 'Authorization',
        description: 'OAuth2 authorization flow',
      },
      {
        name: 'Callback',
        description: 'Provider callback handlers',
      },
      {
        name: 'Token',
        description: 'Token management (issuance, refresh, revocation)',
      },
      {
        name: 'User',
        description: 'User profile and account management',
      },
      {
        name: 'Health',
        description: 'Server health and status',
      },
    ],
  };
}
