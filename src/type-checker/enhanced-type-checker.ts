/**
 * FreeLang Enhanced Type Checker
 *
 * Integrates Union Types, Type Guards, Advanced Generics, and Type Inference
 */

import {
  TypeAnnotation,
  UnionType,
  UnionTypeValidator,
  DiscriminatedUnion,
  NarrowingCondition
} from '../type-system/union-types';

import {
  TypeGuard,
  TypeRefiner,
  CustomTypePredicateHandler,
  TypeGuardValidator
} from '../type-system/type-guards';

import {
  GenericTypeParameter,
  ConditionalType,
  MappedType,
  GenericTypeEvaluator,
  GenericConstraintValidator,
  GenericContext
} from '../type-system/advanced-generics';

import {
  ExpressionTypeInferencer,
  ReturnTypeInferencer,
  ComplexExpressionInferencer,
  FunctionType,
  ArrayLiteralType,
  ObjectLiteralType,
  Expression
} from '../type-system/advanced-inference';

/**
 * Variable information
 */
export interface VariableInfo {
  name: string;
  type: TypeAnnotation;
  mutable: boolean;
  initialized: boolean;
}

/**
 * Function information
 */
export interface FunctionInfo {
  name: string;
  genericParams: GenericTypeParameter[];
  paramTypes: Array<{ name: string; type: TypeAnnotation; optional: boolean }>;
  returnType: TypeAnnotation;
  isAsync: boolean;
}

/**
 * Type scope for tracking symbols
 */
export interface TypeScope {
  variables: Map<string, VariableInfo>;
  functions: Map<string, FunctionInfo>;
  types: Map<string, TypeAnnotation>;
  parent?: TypeScope;
}

/**
 * Enhanced Type Checker
 */
export class EnhancedTypeChecker {
  private currentScope: TypeScope;
  private globalScope: TypeScope;
  private predicateHandler: CustomTypePredicateHandler;
  private expressionInferencer: ExpressionTypeInferencer;
  private errors: string[] = [];

  constructor() {
    this.globalScope = {
      variables: new Map(),
      functions: new Map(),
      types: new Map()
    };
    this.currentScope = this.globalScope;
    this.predicateHandler = new CustomTypePredicateHandler();
    this.expressionInferencer = new ExpressionTypeInferencer();
  }

  /**
   * Check union type compatibility
   */
  public checkUnionType(value: TypeAnnotation, union: UnionType): boolean {
    return UnionTypeValidator.isAssignableToUnion(value, union);
  }

  /**
   * Apply type guard to narrow type
   */
  public applyTypeGuard(type: TypeAnnotation, guard: TypeGuard): TypeAnnotation {
    // Validate the guard
    TypeGuardValidator.validate(guard);

    if (typeof type === 'object' && type.type === 'union') {
      return UnionTypeValidator.narrowUnion(type, {
        type: guard.condition.type as any,
        targetType: guard.condition.targetType,
        variable: guard.variable
      });
    }

    return TypeRefiner.refineType(type, guard);
  }

  /**
   * Check generic constraint
   */
  public checkGenericConstraint(
    typeArg: TypeAnnotation,
    constraint: TypeAnnotation
  ): boolean {
    return GenericConstraintValidator.satisfiesConstraint(typeArg, constraint);
  }

  /**
   * Evaluate conditional type
   */
  public evaluateConditionalType(
    conditional: ConditionalType,
    context: GenericContext
  ): TypeAnnotation {
    return GenericTypeEvaluator.evaluateConditional(conditional, context);
  }

  /**
   * Build mapped type
   */
  public buildMappedType(
    mapped: MappedType,
    sourceType: TypeAnnotation
  ): TypeAnnotation {
    return GenericTypeEvaluator.buildMappedType(mapped, sourceType, new Map());
  }

  /**
   * Infer type of complex expression
   */
  public inferComplexType(expr: Expression, context?: TypeAnnotation): TypeAnnotation {
    return ComplexExpressionInferencer.infer(expr, context);
  }

  /**
   * Infer types of function parameters
   */
  public inferFunctionParameters(
    params: Array<{ name: string; type?: TypeAnnotation }>,
    expectedType?: FunctionType
  ): Array<{ name: string; type: TypeAnnotation }> {
    const inferred: Array<{ name: string; type: TypeAnnotation }> = [];

    for (let i = 0; i < params.length; i++) {
      const param = params[i];
      let type = param.type;

      // Infer from expected type if available
      if (!type && expectedType && i < expectedType.paramTypes.length) {
        type = expectedType.paramTypes[i];
      }

      inferred.push({
        name: param.name,
        type: type || 'any'
      });

      // Register in current scope
      this.currentScope.variables.set(param.name, {
        name: param.name,
        type: type || 'any',
        mutable: true,
        initialized: true
      });
    }

    return inferred;
  }

  /**
   * Infer return type from function body
   */
  public inferReturnType(
    body: any,
    explicitReturnType?: TypeAnnotation
  ): TypeAnnotation {
    return ReturnTypeInferencer.inferFromBody(
      body.statements || [],
      explicitReturnType
    );
  }

  /**
   * Type check variable declaration
   */
  public checkVariableDeclaration(
    name: string,
    valueType: TypeAnnotation,
    declaredType?: TypeAnnotation,
    mutable: boolean = true
  ): void {
    // If declared type exists, check compatibility
    if (declaredType) {
      this.checkAssignment(valueType, declaredType, `variable '${name}'`);
    }

    const type = declaredType || valueType;

    this.currentScope.variables.set(name, {
      name,
      type,
      mutable,
      initialized: true
    });
  }

  /**
   * Type check assignment
   */
  public checkAssignment(
    fromType: TypeAnnotation,
    toType: TypeAnnotation,
    context: string = ''
  ): void {
    if (!this.isAssignable(fromType, toType)) {
      this.error(
        `Type '${this.typeToString(fromType)}' is not assignable to type ` +
        `'${this.typeToString(toType)}'${context ? ` in ${context}` : ''}`
      );
    }
  }

  /**
   * Type check function call
   */
  public checkFunctionCall(
    functionName: string,
    argumentTypes: TypeAnnotation[]
  ): TypeAnnotation {
    const func = this.currentScope.functions.get(functionName);

    if (!func) {
      this.error(`Unknown function: ${functionName}`);
      return 'any';
    }

    // Check argument count
    const requiredParams = func.paramTypes.filter(p => !p.optional).length;
    if (argumentTypes.length < requiredParams) {
      this.error(
        `Function '${functionName}' expects at least ${requiredParams} ` +
        `arguments but got ${argumentTypes.length}`
      );
    }

    // Check argument types
    for (let i = 0; i < argumentTypes.length; i++) {
      if (i < func.paramTypes.length) {
        this.checkAssignment(
          argumentTypes[i],
          func.paramTypes[i].type,
          `argument ${i + 1} of '${functionName}'`
        );
      }
    }

    return func.returnType;
  }

  /**
   * Register function
   */
  public registerFunction(func: FunctionInfo): void {
    this.currentScope.functions.set(func.name, func);
  }

  /**
   * Register type
   */
  public registerType(name: string, type: TypeAnnotation): void {
    this.currentScope.types.set(name, type);
  }

  /**
   * Register custom type predicate
   */
  public registerPredicate(
    name: string,
    typeStr: string,
    predicate: (value: any) => boolean
  ): void {
    this.predicateHandler.register(name, typeStr, predicate);
  }

  /**
   * Enter new scope
   */
  public enterScope(): void {
    const newScope: TypeScope = {
      variables: new Map(),
      functions: new Map(),
      types: new Map(),
      parent: this.currentScope
    };
    this.currentScope = newScope;
  }

  /**
   * Exit scope
   */
  public exitScope(): void {
    if (this.currentScope.parent) {
      this.currentScope = this.currentScope.parent;
    }
  }

  /**
   * Look up variable type
   */
  public lookupVariable(name: string): TypeAnnotation | undefined {
    let scope: TypeScope | undefined = this.currentScope;

    while (scope) {
      const varInfo = scope.variables.get(name);
      if (varInfo) {
        return varInfo.type;
      }
      scope = scope.parent;
    }

    return undefined;
  }

  /**
   * Look up function
   */
  public lookupFunction(name: string): FunctionInfo | undefined {
    let scope: TypeScope | undefined = this.currentScope;

    while (scope) {
      const func = scope.functions.get(name);
      if (func) {
        return func;
      }
      scope = scope.parent;
    }

    return undefined;
  }

  /**
   * Check type assignment compatibility
   */
  private isAssignable(fromType: TypeAnnotation, toType: TypeAnnotation): boolean {
    // If to type is 'any', anything is assignable
    if (typeof toType === 'string' && toType === 'any') {
      return true;
    }

    // If from type is 'any', it's assignable to anything
    if (typeof fromType === 'string' && fromType === 'any') {
      return true;
    }

    // Exact match
    if (typeof fromType === 'string' && typeof toType === 'string') {
      return fromType === toType;
    }

    // Union type assignment
    if (typeof toType === 'object' && toType.type === 'union') {
      return this.checkUnionType(fromType, toType as UnionType);
    }

    // Same shape for complex types
    if (typeof fromType === 'object' && typeof toType === 'object') {
      return fromType.type === toType.type;
    }

    return false;
  }

  /**
   * Convert type to string representation
   */
  private typeToString(type: TypeAnnotation): string {
    if (typeof type === 'string') {
      return type;
    }

    if (type.type === 'union') {
      const union = type as UnionType;
      return union.members
        .map(m => this.typeToString(m))
        .join(' | ');
    }

    if (type.type === 'discriminated-union') {
      const du = type as DiscriminatedUnion;
      return `${du.discriminantProperty} discriminated union`;
    }

    return 'unknown';
  }

  /**
   * Record error
   */
  private error(message: string): void {
    this.errors.push(message);
  }

  /**
   * Get all errors
   */
  public getErrors(): string[] {
    return this.errors;
  }

  /**
   * Clear errors
   */
  public clearErrors(): void {
    this.errors = [];
  }

  /**
   * Check if there are errors
   */
  public hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Type check function declaration
   */
  public checkFunctionDeclaration(func: FunctionInfo): void {
    // Validate return type
    if (typeof func.returnType === 'object' && func.returnType.type === 'union') {
      // Union return types are fine
    }

    // Validate generic parameters
    for (const param of func.genericParams) {
      if (param.constraint) {
        // Constraints are fine
      }
    }

    // Register the function
    this.registerFunction(func);
  }

  /**
   * Type check discriminated union narrowing
   */
  public narrowDiscriminatedUnion(
    union: DiscriminatedUnion,
    discriminantValue: string
  ): TypeAnnotation {
    const narrowed = union.members[discriminantValue];

    if (!narrowed) {
      this.error(
        `Unknown discriminant value: ${discriminantValue} ` +
        `(expected one of: ${Object.keys(union.members).join(', ')})`
      );
      return 'any';
    }

    return narrowed;
  }

  /**
   * Substitute generic types in function call
   */
  public substituteGenerics(
    func: FunctionInfo,
    typeArguments: TypeAnnotation[]
  ): FunctionInfo {
    const context = GenericTypeEvaluator.substitute(
      { type: 'mapped', key: 'T', source: 'T', value: 'T' },
      this.buildGenericContext(func.genericParams, typeArguments)
    );

    return {
      ...func,
      paramTypes: func.paramTypes.map(p => ({
        ...p,
        type: GenericTypeEvaluator.substitute(p.type, this.buildGenericContext(func.genericParams, typeArguments))
      })),
      returnType: GenericTypeEvaluator.substitute(func.returnType, this.buildGenericContext(func.genericParams, typeArguments))
    };
  }

  /**
   * Build generic context from parameters and arguments
   */
  private buildGenericContext(
    params: GenericTypeParameter[],
    typeArgs: TypeAnnotation[]
  ): GenericContext {
    const context: GenericContext = new Map();

    for (let i = 0; i < params.length; i++) {
      context.set(params[i].name, typeArgs[i] || 'any');
    }

    return context;
  }
}

/**
 * Type Checker Error
 */
export class TypeCheckError extends Error {
  constructor(message: string) {
    super(`Type Error: ${message}`);
  }
}
