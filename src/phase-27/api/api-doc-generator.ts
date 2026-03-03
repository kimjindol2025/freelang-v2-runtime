/**
 * 📚 Phase 27: API Documentation Generator
 *
 * Swagger/OpenAPI 3.0 자동 생성
 */

export interface APIEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  summary: string;
  description: string;
  tags: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  examples?: Example[];
}

export interface Parameter {
  name: string;
  in: 'path' | 'query' | 'header';
  required: boolean;
  schema: Schema;
  description: string;
}

export interface RequestBody {
  required: boolean;
  content: {
    'application/json': {
      schema: Schema;
    };
  };
}

export interface Response {
  description: string;
  content?: {
    'application/json': {
      schema: Schema;
    };
  };
}

export interface Schema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  items?: Schema;
}

export interface Example {
  name: string;
  description: string;
  request: any;
  response: any;
}

/**
 * API 문서 생성기
 */
export class APIDocGenerator {
  private endpoints: APIEndpoint[] = [];
  private schemas: Map<string, Schema> = new Map();

  constructor() {
    this.initializeDefaultSchemas();
    this.initializeDefaultEndpoints();
  }

  /**
   * 기본 스키마 초기화
   */
  private initializeDefaultSchemas(): void {
    this.schemas.set('Error', {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' }
      },
      required: ['code', 'message']
    });

    this.schemas.set('CompileResult', {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        bytecode: {
          type: 'array',
          items: { type: 'object' }
        },
        errors: {
          type: 'array',
          items: { type: 'string' }
        },
        executionTime: { type: 'number' }
      },
      required: ['success', 'executionTime']
    });
  }

  /**
   * 기본 엔드포인트 초기화
   */
  private initializeDefaultEndpoints(): void {
    this.addEndpoint({
      path: '/api/compile',
      method: 'POST',
      summary: 'Compile FreeLang code',
      description: 'Compile FreeLang source code to bytecode',
      tags: ['compilation'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                code: { type: 'string' }
              },
              required: ['code']
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Successful compilation',
          content: {
            'application/json': {
              schema: this.schemas.get('CompileResult')!
            }
          }
        },
        '400': {
          description: 'Compilation error',
          content: {
            'application/json': {
              schema: this.schemas.get('Error')!
            }
          }
        }
      },
      examples: [
        {
          name: 'Hello World',
          description: 'Compile a simple hello world program',
          request: { code: 'fn main { "Hello" }' },
          response: { success: true, bytecode: [], executionTime: 5.2 }
        }
      ]
    });

    this.addEndpoint({
      path: '/api/examples',
      method: 'GET',
      summary: 'List all examples',
      description: 'Get all available code examples',
      tags: ['examples'],
      responses: {
        '200': {
          description: 'Success',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    code: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    });

    this.addEndpoint({
      path: '/api/docs',
      method: 'GET',
      summary: 'Get OpenAPI specification',
      description: 'Get the OpenAPI 3.0 specification',
      tags: ['documentation'],
      responses: {
        '200': {
          description: 'OpenAPI specification'
        }
      }
    });
  }

  /**
   * 엔드포인트 추가
   */
  addEndpoint(endpoint: APIEndpoint): void {
    this.endpoints.push(endpoint);
  }

  /**
   * 엔드포인트 조회
   */
  getEndpoint(path: string, method: string): APIEndpoint | undefined {
    return this.endpoints.find(ep => ep.path === path && ep.method === method);
  }

  /**
   * 모든 엔드포인트
   */
  getAllEndpoints(): APIEndpoint[] {
    return this.endpoints;
  }

  /**
   * 태그별 엔드포인트
   */
  getEndpointsByTag(tag: string): APIEndpoint[] {
    return this.endpoints.filter(ep => ep.tags.includes(tag));
  }

  /**
   * 스키마 추가
   */
  addSchema(name: string, schema: Schema): void {
    this.schemas.set(name, schema);
  }

  /**
   * OpenAPI 3.0 스펙 생성
   */
  generateOpenAPISpec(): {
    openapi: string;
    info: {
      title: string;
      version: string;
      description: string;
    };
    servers: Array<{ url: string }>;
    paths: Record<string, any>;
    components: {
      schemas: Record<string, Schema>;
    };
  } {
    const paths: Record<string, any> = {};

    this.endpoints.forEach(endpoint => {
      if (!paths[endpoint.path]) {
        paths[endpoint.path] = {};
      }

      const operation: Record<string, any> = {
        summary: endpoint.summary,
        description: endpoint.description,
        tags: endpoint.tags,
        responses: endpoint.responses
      };

      if (endpoint.parameters) {
        operation.parameters = endpoint.parameters;
      }
      if (endpoint.requestBody) {
        operation.requestBody = endpoint.requestBody;
      }
      if (endpoint.examples) {
        operation['x-codeSamples'] = endpoint.examples.map(ex => ({
          lang: 'javascript',
          source: JSON.stringify(ex.request, null, 2)
        }));
      }

      paths[endpoint.path][endpoint.method.toLowerCase()] = operation;
    });

    return {
      openapi: '3.0.0',
      info: {
        title: 'FreeLang API',
        version: '1.0.0',
        description: 'FreeLang IDE and Compilation API'
      },
      servers: [
        { url: 'http://localhost:3000/api' },
        { url: 'https://api.freelang.io' }
      ],
      paths,
      components: {
        schemas: Object.fromEntries(this.schemas)
      }
    };
  }

  /**
   * HTML 문서 생성
   */
  generateHTMLDocs(): string {
    const spec = this.generateOpenAPISpec();

    return `
<!DOCTYPE html>
<html>
<head>
  <title>${spec.info.title} - ${spec.info.version}</title>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3"></script>
  <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui.css" />
  <style>
    body { margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script>
    const spec = ${JSON.stringify(spec)};
    SwaggerUIBundle({
      spec: spec,
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "BaseLayout"
    });
  </script>
</body>
</html>
    `;
  }

  /**
   * 마크다운 문서 생성
   */
  generateMarkdownDocs(): string {
    const spec = this.generateOpenAPISpec();
    let md = `# ${spec.info.title}\n\n`;
    md += `**Version**: ${spec.info.version}\n\n`;
    md += `${spec.info.description}\n\n`;

    md += '## Endpoints\n\n';

    this.endpoints.forEach(ep => {
      md += `### ${ep.method} ${ep.path}\n\n`;
      md += `**Summary**: ${ep.summary}\n\n`;
      md += `**Tags**: ${ep.tags.join(', ')}\n\n`;

      if (ep.examples && ep.examples.length > 0) {
        md += '**Examples**:\n';
        ep.examples.forEach(ex => {
          md += `- ${ex.name}: ${ex.description}\n`;
        });
        md += '\n';
      }
    });

    return md;
  }

  /**
   * 통계
   */
  getStats(): {
    totalEndpoints: number;
    totalSchemas: number;
    totalExamples: number;
    methodDistribution: Record<string, number>;
    tagDistribution: Record<string, number>;
  } {
    const methodDist: Record<string, number> = {};
    const tagDist: Record<string, number> = {};
    let totalExamples = 0;

    this.endpoints.forEach(ep => {
      methodDist[ep.method] = (methodDist[ep.method] || 0) + 1;
      ep.tags.forEach(tag => {
        tagDist[tag] = (tagDist[tag] || 0) + 1;
      });
      if (ep.examples) {
        totalExamples += ep.examples.length;
      }
    });

    return {
      totalEndpoints: this.endpoints.length,
      totalSchemas: this.schemas.size,
      totalExamples,
      methodDistribution: methodDist,
      tagDistribution: tagDist
    };
  }
}
