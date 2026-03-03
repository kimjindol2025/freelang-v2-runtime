/**
 * Async State Machine Transformer
 * 
 * async fn을 상태 기반의 재진입 가능한 함수로 변환
 * 
 * 예시:
 * ┌──────────────────────────────────────┐
 * │ 원본 코드:                             │
 * │ async fn fetch() {                   │
 * │   let x = await redis.get("key");    │
 * │   let y = await db.query(x);         │
 * │   return x + y;                      │
 * │ }                                    │
 * └──────────────────────────────────────┘
 *           ↓ 변환
 * ┌──────────────────────────────────────┐
 * │ 생성 코드:                             │
 * │ fn fetch() {                         │
 * │   return new Promise((resolve) => {  │
 * │     let state = 0;                   │
 * │     let x, y;                        │
 * │                                      │
 * │     async fn step() {                │
 * │       switch(state) {                │
 * │         case 0:                      │
 * │           state = 1;                 │
 * │           return redis.get("key");   │
 * │         case 1:                      │
 * │           x = result;                │
 * │           state = 2;                 │
 * │           return db.query(x);        │
 * │         case 2:                      │
 * │           y = result;                │
 * │           return x + y;              │
 * │       }                              │
 * │     }                                │
 * │     step().then(resolve);            │
 * │   });                                │
 * │ }                                    │
 * └──────────────────────────────────────┘
 */

/**
 * Type definitions (generic for compatibility)
 */

export interface ASTNode {
  type: string;
  position?: number;
}

export interface FunctionDeclaration extends ASTNode {
  name: string;
  parameters: string[];
  body: string;
  isAsync: boolean;
  returnType?: string;
}

export interface AwaitExpression extends ASTNode {
  expression: string;
  position: number;
}

export interface AsyncStateInfo {
  stateCount: number;
  variables: Map<string, string>; // 변수명 → 타입
  awaitPoints: Map<number, AwaitExpression>;
}

export interface StateMachineCode {
  originalFn: FunctionDeclaration;
  generatedCode: string;
  stateInfo: AsyncStateInfo;
  isAsync: boolean;
}

/**
 * Await Expression을 State로 변환
 */
class AwaitTransformer {
  private stateCounter = 0;
  private variables = new Map<string, string>();
  private awaitPoints = new Map<number, AwaitExpression>();

  /**
   * async function을 State Machine으로 변환
   */
  transformAsyncFunction(fn: FunctionDeclaration): StateMachineCode {
    if (!fn.isAsync) {
      return {
        originalFn: fn,
        generatedCode: fn.body,
        stateInfo: {
          stateCount: 0,
          variables: new Map(),
          awaitPoints: new Map(),
        },
        isAsync: false,
      };
    }

    // AST를 순회하며 await 포인트 찾기
    const awaitPoints = this.findAwaitPoints(fn.body);

    if (awaitPoints.length === 0) {
      // await가 없으면 일반 함수로 변환
      return {
        originalFn: fn,
        generatedCode: this.wrapInPromise(fn.body),
        stateInfo: {
          stateCount: 1,
          variables: this.variables,
          awaitPoints: new Map(),
        },
        isAsync: true,
      };
    }

    // State Machine 코드 생성
    const generatedCode = this.generateStateMachineCode(
      fn.name,
      fn.parameters,
      fn.body,
      awaitPoints
    );

    return {
      originalFn: fn,
      generatedCode,
      stateInfo: {
        stateCount: this.stateCounter,
        variables: this.variables,
        awaitPoints: new Map(
          awaitPoints.map((point, index) => [index, point])
        ),
      },
      isAsync: true,
    };
  }

  /**
   * AST 순회: await 포인트 찾기
   */
  private findAwaitPoints(body: string): AwaitExpression[] {
    const awaitPoints: AwaitExpression[] = [];
    const awaitRegex = /await\s+([^;,\)]+)/g;
    let match;

    while ((match = awaitRegex.exec(body))) {
      awaitPoints.push({
        expression: match[1].trim(),
        position: match.index,
      } as AwaitExpression);
    }

    return awaitPoints;
  }

  /**
   * State Machine 코드 생성
   */
  private generateStateMachineCode(
    fnName: string,
    parameters: string[],
    body: string,
    awaitPoints: AwaitExpression[]
  ): string {
    const paramStr = parameters.join(', ');
    const caseStatements = this.generateCaseStatements(body, awaitPoints);

    return `
fn ${fnName}(${paramStr}) {
  return new Promise((resolve, reject) => {
    let state = 0;
    let result;
    ${this.generateVariableDeclarations()}

    async fn step() {
      try {
        switch(state) {
          ${caseStatements}
        }
      } catch (error) {
        reject(error);
      }
    }

    step().then(resolve).catch(reject);
  });
}
    `.trim();
  }

  /**
   * Switch 케이스 생성
   */
  private generateCaseStatements(
    body: string,
    awaitPoints: AwaitExpression[]
  ): string {
    const cases: string[] = [];

    // 초기 상태 (state = 0)
    cases.push('case 0:');

    let currentBody = body;
    for (let i = 0; i < awaitPoints.length; i++) {
      const awaitPoint = awaitPoints[i];

      // await 이전까지의 코드
      const beforeAwait = currentBody.substring(
        0,
        currentBody.indexOf(`await ${awaitPoint.expression}`)
      );

      cases.push(`  ${beforeAwait}`);
      cases.push(`  state = ${i + 1};`);
      cases.push(`  return ${awaitPoint.expression};`);

      cases.push(`case ${i + 1}:`);
      cases.push(`  result = arguments[0];`);

      // await 이후의 코드로 이동
      currentBody = currentBody.substring(
        currentBody.indexOf(`await ${awaitPoint.expression}`) +
          `await ${awaitPoint.expression}`.length
      );
    }

    // 마지막 상태
    cases.push(`  return (async () => {`);
    cases.push(`    ${currentBody}`);
    cases.push(`  })();`);

    return cases.join('\n');
  }

  /**
   * 변수 선언 생성
   */
  private generateVariableDeclarations(): string {
    const declarations: string[] = [];

    for (const [varName] of this.variables) {
      declarations.push(`    let ${varName};`);
    }

    return declarations.join('\n');
  }

  /**
   * Promise로 래핑
   */
  private wrapInPromise(body: string): string {
    return `
(async () => {
  ${body}
})()
    `.trim();
  }
}

/**
 * Async State Machine Registry
 */
export class AsyncStateMachineRegistry {
  private registry = new Map<string, StateMachineCode>();

  register(fnName: string, machineCode: StateMachineCode): void {
    this.registry.set(fnName, machineCode);
  }

  get(fnName: string): StateMachineCode | undefined {
    return this.registry.get(fnName);
  }

  getAll(): StateMachineCode[] {
    return Array.from(this.registry.values());
  }

  clear(): void {
    this.registry.clear();
  }
}

// Export transformer instance
export const asyncTransformer = new AwaitTransformer();
export const stateMachineRegistry = new AsyncStateMachineRegistry();
