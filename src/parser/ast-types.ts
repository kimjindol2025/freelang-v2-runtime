/**
 * AST Type Definitions
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

export interface VariableDeclaration extends ASTNode {
  name: string;
  type: string;
  value?: any;
}
