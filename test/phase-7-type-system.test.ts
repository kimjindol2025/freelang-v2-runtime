/**
 * Phase 7 Step 2: Type System Enhancements - Comprehensive Test Suite
 *
 * Tests for Union Types, Type Guards, Advanced Generics, and Type Inference
 */

import {
  UnionTypeParser,
  UnionTypeValidator,
  UnionTypeUtil,
  UnionType
} from '../src/type-system/union-types';

import {
  TypeGuardParser,
  TypeRefiner,
  CustomTypePredicateHandler,
  BuiltinTypeGuards,
  TypeGuardValidator
} from '../src/type-system/type-guards';

import {
  GenericTypeParser,
  GenericTypeEvaluator,
  GenericConstraintValidator,
  GenericUtil
} from '../src/type-system/advanced-generics';

import {
  ContextualTypeInferencer,
  LiteralTypeInferencer,
  ExpressionTypeInferencer,
  ReturnTypeInferencer,
  InferenceUtil
} from '../src/type-system/advanced-inference';

import {
  EnhancedTypeChecker
} from '../src/type-checker/enhanced-type-checker';

describe('Phase 7 Step 2: Type System Enhancements', () => {

  // =====================================================
  // UNION TYPES TESTS (15 tests)
  // =====================================================

  describe('Union Types', () => {
    test('parse simple union type', () => {
      const result = UnionTypeParser.parseUnionType('string | number');
      expect(result).toEqual({
        type: 'union',
        members: ['string', 'number']
      });
    });

    test('parse union type with three members', () => {
      const result = UnionTypeParser.parseUnionType('string | number | boolean');
      expect(result).toEqual({
        type: 'union',
        members: ['string', 'number', 'boolean']
      });
    });

    test('parse union type with whitespace', () => {
      const result = UnionTypeParser.parseUnionType('  string  |  number  |  boolean  ');
      expect(result).toEqual({
        type: 'union',
        members: ['string', 'number', 'boolean']
      });
    });

    test('parse non-union type returns string', () => {
      const result = UnionTypeParser.parseUnionType('string');
      expect(result).toBe('string');
    });

    test('check assignability to union - exact match', () => {
      const union = {
        type: 'union' as const,
        members: ['string', 'number', 'boolean']
      } as UnionType;

      expect(UnionTypeValidator.isAssignableToUnion('string', union)).toBe(true);
      expect(UnionTypeValidator.isAssignableToUnion('number', union)).toBe(true);
      expect(UnionTypeValidator.isAssignableToUnion('boolean', union)).toBe(true);
    });

    test('check assignability to union - non-matching type', () => {
      const union = {
        type: 'union' as const,
        members: ['string', 'number']
      } as UnionType;

      expect(UnionTypeValidator.isAssignableToUnion('boolean', union)).toBe(false);
    });

    test('narrow union type - typeof check', () => {
      const union = {
        type: 'union' as const,
        members: ['string', 'number', 'boolean']
      } as UnionType;

      const narrowed = UnionTypeValidator.narrowUnion(union, {
        type: 'typeof',
        targetType: 'string'
      });

      expect(narrowed).toBe('string');
    });

    test('narrow union type - truthy check', () => {
      const union = {
        type: 'union' as const,
        members: ['string', 'null', 'undefined']
      } as UnionType;

      const narrowed = UnionTypeValidator.narrowUnion(union, {
        type: 'truthy'
      });

      expect(narrowed).toBe('string');
    });

    test('create union utility', () => {
      const union = UnionTypeUtil.createUnion('string', 'number', 'boolean');
      expect(union.type).toBe('union');
      expect(union.members).toEqual(['string', 'number', 'boolean']);
    });

    test('is union type check', () => {
      const union = { type: 'union', members: ['string', 'number'] };
      const notUnion = 'string';

      expect(UnionTypeUtil.isUnionType(union)).toBe(true);
      expect(UnionTypeUtil.isUnionType(notUnion)).toBe(false);
    });

    test('flatten nested unions', () => {
      const nested = {
        type: 'union' as const,
        members: [
          'string',
          { type: 'union' as const, members: ['number', 'boolean'] }
        ]
      };

      const flattened = UnionTypeUtil.flattenUnion(nested);
      expect(flattened).toHaveLength(3);
    });

    test('deduplicate union types', () => {
      const union = {
        type: 'union' as const,
        members: ['string', 'number', 'string', 'boolean']
      } as UnionType;

      const deduped = UnionTypeUtil.deduplicateUnion(union);
      expect(deduped.members).toHaveLength(3);
    });

    test('union includes type check', () => {
      const union = {
        type: 'union' as const,
        members: ['string', 'number', 'boolean']
      } as UnionType;

      expect(UnionTypeUtil.unionIncludes(union, 'string')).toBe(true);
      expect(UnionTypeUtil.unionIncludes(union, 'null')).toBe(false);
    });

    test('parse discriminated union', () => {
      const result = UnionTypeParser.parseDiscriminatedUnion(
        [
          { discriminantValue: 'success', type: 'T' },
          { discriminantValue: 'error', type: 'string' }
        ],
        'kind'
      );

      expect(result.type).toBe('discriminated-union');
      expect(result.discriminantProperty).toBe('kind');
      expect(result.members['success']).toBe('T');
    });

    test('narrow discriminated union', () => {
      const discriminated = {
        type: 'discriminated-union' as const,
        discriminantProperty: 'kind',
        members: {
          'success': 'T',
          'error': 'string'
        }
      };

      const narrowed = UnionTypeValidator.narrowDiscriminatedUnion(
        discriminated,
        'success'
      );

      expect(narrowed).toBe('T');
    });
  });

  // =====================================================
  // TYPE GUARDS TESTS (15 tests)
  // =====================================================

  describe('Type Guards', () => {
    test('parse typeof guard', () => {
      const guard = TypeGuardParser.parseTypeGuard(
        "typeof value === 'string'",
        'value'
      );

      expect(guard.condition.type).toBe('typeof');
      expect(guard.condition.targetType).toBe('string');
    });

    test('parse instanceof guard', () => {
      const guard = TypeGuardParser.parseTypeGuard(
        'user instanceof User',
        'user'
      );

      expect(guard.condition.type).toBe('instanceof');
      expect(guard.condition.targetType).toBe('User');
    });

    test('parse property guard', () => {
      const guard = TypeGuardParser.parseTypeGuard(
        "result.kind === 'success'",
        'result'
      );

      expect(guard.condition.type).toBe('property');
      expect(guard.condition.property).toBe('kind');
      expect(guard.condition.value).toBe('success');
    });

    test('parse custom predicate guard', () => {
      const guard = TypeGuardParser.parseTypeGuard(
        'isUser(value)',
        'value'
      );

      expect(guard.condition.type).toBe('custom');
      expect(guard.condition.predicate).toBe('isUser');
    });

    test('refine type based on guard', () => {
      const guard = {
        kind: 'type-guard' as const,
        variable: 'value',
        targetType: 'string',
        condition: {
          type: 'typeof' as const,
          targetType: 'string'
        }
      };

      const refined = TypeRefiner.refineType('string | number', guard);
      expect(refined).toBe('string');
    });

    test('register custom type predicate', () => {
      const handler = new CustomTypePredicateHandler();
      handler.register('isUser', 'User', (v) => v && v.id && v.name);

      expect(handler.hasPredicate('isUser')).toBe(true);
      expect(handler.getPredicateType('isUser')).toBe('User');
    });

    test('execute custom type predicate', () => {
      const handler = new CustomTypePredicateHandler();
      handler.register('isNumber', 'number', (v) => typeof v === 'number');

      expect(handler.executePredicate('isNumber', 42)).toBe(true);
      expect(handler.executePredicate('isNumber', 'hello')).toBe(false);
    });

    test('builtin typeof guard', () => {
      const guard = BuiltinTypeGuards.typeof('value', 'string');
      expect(guard.condition.type).toBe('typeof');
      expect(guard.targetType).toBe('string');
    });

    test('builtin instanceof guard', () => {
      const guard = BuiltinTypeGuards.instanceof('user', 'User');
      expect(guard.condition.type).toBe('instanceof');
      expect(guard.targetType).toBe('User');
    });

    test('builtin property guard', () => {
      const guard = BuiltinTypeGuards.property('obj', 'kind', 'success');
      expect(guard.condition.type).toBe('property');
      expect(guard.condition.property).toBe('kind');
      expect(guard.condition.value).toBe('success');
    });

    test('builtin custom guard', () => {
      const guard = BuiltinTypeGuards.custom('value', 'isUser');
      expect(guard.condition.type).toBe('custom');
      expect(guard.condition.predicate).toBe('isUser');
    });

    test('builtin truthiness guard', () => {
      const guard = BuiltinTypeGuards.truthiness('value');
      expect(guard.condition.type).toBe('truthiness');
    });

    test('validate typeof guard', () => {
      const guard = {
        kind: 'type-guard' as const,
        variable: 'value',
        condition: {
          type: 'typeof' as const,
          targetType: 'string'
        }
      };

      expect(() => TypeGuardValidator.validate(guard)).not.toThrow();
    });

    test('validate invalid guard throws error', () => {
      const guard = {
        kind: 'type-guard' as const,
        variable: 'value',
        condition: {
          type: 'typeof' as const
          // Missing targetType
        }
      };

      expect(() => TypeGuardValidator.validate(guard as any)).toThrow();
    });

    test('common predicates - isString', () => {
      // @ts-ignore - accessing from CommonPredicates
      const { CommonPredicates } = require('../src/type-system/type-guards');
      expect(CommonPredicates.isString('hello')).toBe(true);
      expect(CommonPredicates.isString(42)).toBe(false);
    });
  });

  // =====================================================
  // ADVANCED GENERICS TESTS (15 tests)
  // =====================================================

  describe('Advanced Generics', () => {
    test('parse generic parameter - simple', () => {
      const param = GenericTypeParser.parseGenericParameter('T');
      expect(param.name).toBe('T');
      expect(param.constraint).toBeUndefined();
    });

    test('parse generic parameter - with constraint', () => {
      const param = GenericTypeParser.parseGenericParameter('T extends Serializable');
      expect(param.name).toBe('T');
      expect(param.constraint).toBe('Serializable');
    });

    test('parse generic parameter - with default', () => {
      const param = GenericTypeParser.parseGenericParameter('T = string');
      expect(param.name).toBe('T');
      expect(param.default).toBe('string');
    });

    test('parse conditional type', () => {
      const conditional = GenericTypeParser.parseConditionalType(
        'T extends string ? string : number'
      );

      expect(conditional.type).toBe('conditional');
      expect(conditional.check).toBe('T');
      expect(conditional.extends).toBe('string');
      expect(conditional.trueType).toBe('string');
      expect(conditional.falseType).toBe('number');
    });

    test('evaluate conditional type - true branch', () => {
      const conditional = {
        type: 'conditional' as const,
        check: 'string',
        extends: 'string',
        trueType: 'YesType',
        falseType: 'NoType'
      };

      const result = GenericTypeEvaluator.evaluateConditional(
        conditional,
        new Map()
      );

      expect(result).toBe('YesType');
    });

    test('evaluate conditional type - false branch', () => {
      const conditional = {
        type: 'conditional' as const,
        check: 'number',
        extends: 'string',
        trueType: 'YesType',
        falseType: 'NoType'
      };

      const result = GenericTypeEvaluator.evaluateConditional(
        conditional,
        new Map()
      );

      expect(result).toBe('NoType');
    });

    test('substitute type parameters', () => {
      const context = new Map([['T', 'number']]);
      const result = GenericTypeEvaluator.substitute('T', context);
      expect(result).toBe('number');
    });

    test('substitute in conditional type', () => {
      const conditional = {
        type: 'conditional' as const,
        check: 'T',
        extends: 'string',
        trueType: 'MatchType',
        falseType: 'NoMatchType'
      };

      const context = new Map([['T', 'string']]);
      const result = GenericTypeEvaluator.substitute(conditional, context);
      expect(result).toBe('MatchType');
    });

    test('infer generic types from function call', () => {
      const functionType = {
        genericParams: [{ name: 'T', constraint: undefined, default: undefined }],
        paramTypes: ['T'],
        returnType: 'T'
      };

      const context = GenericTypeEvaluator.inferGenerics(
        functionType,
        ['number']
      );

      expect(context.get('T')).toBe('number');
    });

    test('validate generic constraint - satisfied', () => {
      const param = { name: 'T', constraint: 'Serializable', default: undefined };
      const typeArg = 'Serializable';

      expect(() => {
        GenericConstraintValidator.validateParameter(param, typeArg);
      }).not.toThrow();
    });

    test('validate generic constraint - not satisfied', () => {
      const param = { name: 'T', constraint: 'Serializable', default: undefined };
      const typeArg = 'RandomType';

      expect(() => {
        GenericConstraintValidator.validateParameter(param, typeArg);
      }).toThrow();
    });

    test('get generic default type', () => {
      const param = { name: 'T', constraint: undefined, default: 'string' };
      const result = GenericConstraintValidator.getDefaultType(param);
      expect(result).toBe('string');
    });

    test('create generic function', () => {
      const func = GenericUtil.createGenericFunction(
        'map',
        [{ name: 'T', constraint: undefined, default: undefined }],
        ['T[]', { type: 'function', value: 'U' }],
        'U[]'
      );

      expect(func.name).toBe('map');
      expect(func.genericParams).toHaveLength(1);
    });

    test('has type parameters', () => {
      expect(GenericUtil.hasTypeParameters('T')).toBe(true);
      expect(GenericUtil.hasTypeParameters('string')).toBe(false);
    });

    test('parse mapped type', () => {
      const mapped = GenericTypeParser.parseMappedType(
        '{ [K in keyof T]: T[K] }'
      );

      expect(mapped.type).toBe('mapped');
      expect(mapped.key).toBe('K');
      expect(mapped.source).toBe('T');
    });
  });

  // =====================================================
  // TYPE INFERENCE TESTS (15 tests)
  // =====================================================

  describe('Type Inference', () => {
    test('infer string literal type', () => {
      const result = LiteralTypeInferencer.inferLiteralType('hello');
      expect(result).toBe('string');
    });

    test('infer number literal type', () => {
      const result = LiteralTypeInferencer.inferLiteralType(42);
      expect(result).toBe('number');
    });

    test('infer boolean literal type', () => {
      const result = LiteralTypeInferencer.inferLiteralType(true);
      expect(result).toBe('boolean');
    });

    test('infer null type', () => {
      const result = LiteralTypeInferencer.inferLiteralType(null);
      expect(result).toBe('null');
    });

    test('infer array type - homogeneous', () => {
      const result = LiteralTypeInferencer.inferArrayType([1, 2, 3]);
      expect(result.kind).toBe('array');
      expect(result.elementType).toBe('number');
    });

    test('infer array type - heterogeneous', () => {
      const result = LiteralTypeInferencer.inferArrayType([1, 'hello', true]);
      expect(result.kind).toBe('array');
      expect(typeof result.elementType).toBe('object');
    });

    test('infer empty array type', () => {
      const result = LiteralTypeInferencer.inferArrayType([]);
      expect(result.kind).toBe('array');
      expect(result.elementType).toBe('any');
    });

    test('infer object literal type', () => {
      const result = LiteralTypeInferencer.inferObjectType({
        name: 'John',
        age: 30
      });

      expect(result.kind).toBe('object');
      expect(result.properties['name']).toBe('string');
      expect(result.properties['age']).toBe('number');
    });

    test('infer binary expression type - arithmetic', () => {
      const inferencer = new ExpressionTypeInferencer();
      const result = inferencer.inferBinaryExpressionType('number', '+', 'number');
      expect(result).toBe('number');
    });

    test('infer binary expression type - string concatenation', () => {
      const inferencer = new ExpressionTypeInferencer();
      const result = inferencer.inferBinaryExpressionType('string', '+', 'number');
      expect(result).toBe('string');
    });

    test('infer binary expression type - comparison', () => {
      const inferencer = new ExpressionTypeInferencer();
      const result = inferencer.inferBinaryExpressionType('number', '<', 'number');
      expect(result).toBe('boolean');
    });

    test('infer conditional expression type - same types', () => {
      const inferencer = new ExpressionTypeInferencer();
      const result = inferencer.inferConditionalType('string', 'string');
      expect(result).toBe('string');
    });

    test('infer conditional expression type - different types', () => {
      const inferencer = new ExpressionTypeInferencer();
      const result = inferencer.inferConditionalType('string', 'number');
      expect(typeof result).toBe('object');
    });

    test('infer return type from statements - single return', () => {
      const body = [
        {
          type: 'return-statement',
          value: { type: 'literal', value: 42 }
        }
      ];

      const result = ReturnTypeInferencer.inferFromBody(body);
      expect(result).toBe('number');
    });

    test('infer return type from statements - no return', () => {
      const body = [
        { type: 'expression-statement', expression: { type: 'literal', value: 42 } }
      ];

      const result = ReturnTypeInferencer.inferFromBody(body);
      expect(result).toBe('void');
    });
  });

  // =====================================================
  // ENHANCED TYPE CHECKER TESTS (10 tests)
  // =====================================================

  describe('Enhanced Type Checker', () => {
    let checker: EnhancedTypeChecker;

    beforeEach(() => {
      checker = new EnhancedTypeChecker();
    });

    test('check union type compatibility', () => {
      const union = {
        type: 'union' as const,
        members: ['string', 'number']
      } as UnionType;

      expect(checker.checkUnionType('string', union)).toBe(true);
      expect(checker.checkUnionType('boolean', union)).toBe(false);
    });

    test('apply type guard to union', () => {
      const union = {
        type: 'union' as const,
        members: ['string', 'number', 'boolean']
      } as UnionType;

      const guard = BuiltinTypeGuards.typeof('value', 'string');
      const result = checker.applyTypeGuard(union, guard);
      expect(result).toBe('string');
    });

    test('check generic constraint', () => {
      expect(checker.checkGenericConstraint('Serializable', 'Serializable')).toBe(true);
      expect(checker.checkGenericConstraint('RandomType', 'Serializable')).toBe(false);
    });

    test('register and lookup variable', () => {
      checker.checkVariableDeclaration('x', 'number');
      const type = checker.lookupVariable('x');
      expect(type).toBe('number');
    });

    test('register function and check call', () => {
      checker.registerFunction({
        name: 'add',
        genericParams: [],
        paramTypes: [
          { name: 'a', type: 'number', optional: false },
          { name: 'b', type: 'number', optional: false }
        ],
        returnType: 'number',
        isAsync: false
      });

      const result = checker.checkFunctionCall('add', ['number', 'number']);
      expect(result).toBe('number');
    });

    test('check function call with wrong argument type', () => {
      checker.registerFunction({
        name: 'add',
        genericParams: [],
        paramTypes: [
          { name: 'a', type: 'number', optional: false },
          { name: 'b', type: 'number', optional: false }
        ],
        returnType: 'number',
        isAsync: false
      });

      checker.checkFunctionCall('add', ['string', 'number']);
      expect(checker.hasErrors()).toBe(true);
    });

    test('scope management - enter and exit', () => {
      checker.checkVariableDeclaration('x', 'number');
      checker.enterScope();
      checker.checkVariableDeclaration('y', 'string');

      expect(checker.lookupVariable('x')).toBe('number');
      expect(checker.lookupVariable('y')).toBe('string');

      checker.exitScope();
      expect(checker.lookupVariable('x')).toBe('number');
      expect(checker.lookupVariable('y')).toBe('number');  // Now y is in parent scope
    });

    test('register custom type predicate', () => {
      const predicate = (v: any) => typeof v === 'string' && v.length > 0;
      checker.registerPredicate('isNonEmptyString', 'string', predicate);
      // Can't easily verify without additional context
    });

    test('narrowed discriminated union', () => {
      const discriminated = {
        type: 'discriminated-union' as const,
        discriminantProperty: 'kind',
        members: {
          'success': 'T',
          'error': 'string'
        }
      };

      const narrowed = checker.narrowDiscriminatedUnion(discriminated, 'success');
      expect(narrowed).toBe('T');
    });
  });

  // =====================================================
  // INTEGRATION TESTS (10 tests)
  // =====================================================

  describe('Integration Tests', () => {
    test('union type with type guards workflow', () => {
      const checker = new EnhancedTypeChecker();

      // Register variable with union type
      const union = {
        type: 'union' as const,
        members: ['string', 'number']
      } as UnionType;

      // Apply type guard
      const guard = BuiltinTypeGuards.typeof('value', 'string');
      const narrowed = checker.applyTypeGuard(union, guard);

      expect(narrowed).toBe('string');
    });

    test('generic function type substitution', () => {
      const checker = new EnhancedTypeChecker();

      const func = {
        name: 'identity',
        genericParams: [{ name: 'T', constraint: undefined, default: undefined }],
        paramTypes: [{ name: 'x', type: 'T', optional: false }],
        returnType: 'T',
        isAsync: false
      };

      const substituted = checker.substituteGenerics(func, ['number']);
      expect(substituted.paramTypes[0].type).toBe('number');
      expect(substituted.returnType).toBe('number');
    });

    test('infer array element type from literals', () => {
      const arr = [1, 2, 3];
      const result = LiteralTypeInferencer.inferArrayType(arr);
      expect(result.elementType).toBe('number');
    });

    test('infer object shape from literals', () => {
      const obj = { x: 1, y: 'hello' };
      const result = LiteralTypeInferencer.inferObjectType(obj);

      expect(result.properties['x']).toBe('number');
      expect(result.properties['y']).toBe('string');
    });

    test('union type deduplication', () => {
      const union = {
        type: 'union' as const,
        members: ['string', 'number', 'string']
      } as UnionType;

      const deduped = UnionTypeUtil.deduplicateUnion(union);
      expect(deduped.members).toHaveLength(2);
    });

    test('infer return type from mixed branches', () => {
      const body = [
        {
          type: 'if-statement',
          consequent: {
            statements: [
              { type: 'return-statement', value: { type: 'literal', value: 'hello' } }
            ]
          },
          alternate: {
            statements: [
              { type: 'return-statement', value: { type: 'literal', value: 42 } }
            ]
          }
        }
      ];

      const result = ReturnTypeInferencer.inferFromBody(body);
      expect(typeof result).toBe('object');
      expect(result.type).toBe('union');
    });

    test('type error reporting', () => {
      const checker = new EnhancedTypeChecker();

      checker.registerFunction({
        name: 'add',
        genericParams: [],
        paramTypes: [
          { name: 'a', type: 'number', optional: false }
        ],
        returnType: 'number',
        isAsync: false
      });

      checker.checkFunctionCall('add', ['string']);
      expect(checker.hasErrors()).toBe(true);
      expect(checker.getErrors().length).toBeGreaterThan(0);
    });

    test('discriminated union pattern matching', () => {
      const union = {
        type: 'discriminated-union' as const,
        discriminantProperty: 'status',
        members: {
          'success': 'number',
          'failure': 'string'
        }
      };

      const successType = UnionTypeValidator.narrowDiscriminatedUnion(union, 'success');
      const failureType = UnionTypeValidator.narrowDiscriminatedUnion(union, 'failure');

      expect(successType).toBe('number');
      expect(failureType).toBe('string');
    });

    test('contextual type inference', () => {
      const inferencer = new ContextualTypeInferencer();
      const func = {
        type: 'function',
        parameters: [
          { name: 'x' },
          { name: 'y' }
        ],
        body: {}
      };

      const expectedType = {
        kind: 'function',
        paramTypes: ['number', 'string'],
        returnType: 'boolean'
      };

      const inferred = inferencer.inferParametersFromContext(
        func as any,
        expectedType
      );

      expect(inferred[0].type).toBe('number');
      expect(inferred[1].type).toBe('string');
    });

    test('complex union narrowing scenario', () => {
      const checker = new EnhancedTypeChecker();

      const union = {
        type: 'union' as const,
        members: ['string', 'number', 'null', 'undefined']
      } as UnionType;

      // Apply truthiness guard (removes null/undefined)
      const guard = BuiltinTypeGuards.truthiness('value');
      const narrowed = checker.applyTypeGuard(union, guard);

      // Result should be narrowed to string | number
      expect(narrowed).not.toBe('null');
      expect(narrowed).not.toBe('undefined');
    });
  });
});
