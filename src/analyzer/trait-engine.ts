/**
 * ════════════════════════════════════════════════════════════════════
 * Trait Engine
 *
 * Trait 정의, 구현, 검증 및 Associated Types 관리
 * ════════════════════════════════════════════════════════════════════
 */

import { MinimalFunctionAST } from '../parser/ast';

/**
 * Trait 메서드 정의
 */
export interface TraitMethod {
  name: string;
  inputType: string;
  outputType: string;
  required: boolean;              // 필수 구현 여부
}

/**
 * Associated Type (관련 타입)
 */
export interface AssociatedType {
  name: string;                   // "Item", "Output"
  constraint?: string;            // "Item: Clone"
  default?: string;
}

/**
 * Trait 정의
 */
export interface TraitDefinition {
  name: string;
  methods: TraitMethod[];
  associatedTypes: AssociatedType[];
  superTraits: string[];          // 상위 trait
  confidence: number;
}

/**
 * Trait 구현
 */
export interface TraitImplementation {
  traitName: string;
  forType: string;                // "array<T>" 또는 "number"
  methods: Map<string, string>;   // 메서드명 → 구현 코드
  associatedTypeBindings: Map<string, string>;  // Item → T
  complete: boolean;              // 모든 필수 메서드 구현 여부
  confidence: number;
}

/**
 * Trait 검증 에러
 */
export interface TraitValidationError {
  type: 'missing_method' | 'type_mismatch' | 'missing_associated_type' | 'missing_trait_def';
  traitName: string;
  forType: string;
  message: string;
}

/**
 * Trait Engine 결과
 */
export interface TraitEngineResult {
  traits: Map<string, TraitDefinition>;
  implementations: TraitImplementation[];
  validationErrors: TraitValidationError[];
  completeness: number;           // 0.0-1.0
  reasoning: string[];
}

/**
 * Trait Engine
 */
export class TraitEngine {
  /**
   * 메인 빌드 메서드
   */
  build(functions: MinimalFunctionAST[]): TraitEngineResult {
    const result: TraitEngineResult = {
      traits: new Map(),
      implementations: [],
      validationErrors: [],
      completeness: 0,
      reasoning: []
    };

    // Step 1: Trait 정의 추출
    this.extractTraitDefinitions(functions, result);

    // Step 2: Trait 구현 추출
    this.extractTraitImplementations(functions, result);

    // Step 3: 구현 검증 (필요할 때만)
    if (result.implementations.length > 0) {
      this.validateImplementations(result);
    }

    // Step 4: Associated Types 검증 (필요할 때만)
    if (result.implementations.some((impl) => impl.associatedTypeBindings.size > 0)) {
      this.validateAssociatedTypes(result);
    }

    // Step 5: 완전성 계산
    result.completeness = this.calculateCompleteness(result);

    return result;
  }

  /**
   * Trait 정의 추출
   * 예: trait Comparable { fn compare(other: Self) -> number }
   */
  private extractTraitDefinitions(functions: MinimalFunctionAST[], result: TraitEngineResult): void {
    for (const fn of functions) {
      if (!fn.body) continue;

      // Trait 선언 패턴: trait Name { ... }
      // 먼저 trait 헤더를 찾음
      const traitHeaderPattern = /trait\s+(\w+)\s*(?::\s*([\w\s,]+))?\s*\{/g;
      let headerMatch;

      while ((headerMatch = traitHeaderPattern.exec(fn.body)) !== null) {
        const traitName = headerMatch[1];
        const superTraitsStr = headerMatch[2];

        // 열린 괄호 위치부터 매칭되는 닫힌 괄호까지 찾기
        const openBracePos = headerMatch.index + headerMatch[0].length - 1;
        let braceCount = 1;
        let pos = openBracePos + 1;

        while (pos < fn.body.length && braceCount > 0) {
          if (fn.body[pos] === '{') braceCount++;
          else if (fn.body[pos] === '}') braceCount--;
          pos++;
        }

        const body = fn.body.substring(openBracePos + 1, pos - 1);

        const trait: TraitDefinition = {
          name: traitName,
          methods: [],
          associatedTypes: [],
          superTraits: superTraitsStr ? superTraitsStr.split(',').map(s => s.trim()) : [],
          confidence: 0.85
        };

        // 메서드 추출: fn name(params) -> type
        const methodPattern = /fn\s+(\w+)\s*\((.*?)\)\s*->\s*(\w+(?:<[\w,\s]+>)?)/g;
        let methodMatch;
        while ((methodMatch = methodPattern.exec(body)) !== null) {
          trait.methods.push({
            name: methodMatch[1],
            inputType: methodMatch[2] || 'null',
            outputType: methodMatch[3],
            required: true
          });
        }

        // Associated types 추출: type Name; 또는 type Name: Constraint;
        const assocPattern = /type\s+(\w+)(?:\s*:\s*(\w+(?:<[\w,\s]+>)?))?(?:\s*=\s*(\w+))?/g;
        let assocMatch;
        while ((assocMatch = assocPattern.exec(body)) !== null) {
          trait.associatedTypes.push({
            name: assocMatch[1],
            constraint: assocMatch[2],
            default: assocMatch[3]
          });
        }

        result.traits.set(traitName, trait);
        result.reasoning.push(
          `Trait defined: ${traitName} with ${trait.methods.length} methods, ` +
          `${trait.associatedTypes.length} associated types`
        );
      }
    }
  }

  /**
   * Trait 구현 추출
   * 예: impl Comparable for number { ... }
   */
  private extractTraitImplementations(
    functions: MinimalFunctionAST[],
    result: TraitEngineResult
  ): void {
    for (const fn of functions) {
      if (!fn.body) continue;

      // impl 패턴: impl TraitName for TypeName { ... }
      // 먼저 impl 헤더를 찾음
      const implHeaderPattern = /impl\s+(\w+)\s+for\s+([\w<>,\s]+?)\s*\{/g;
      let headerMatch;

      while ((headerMatch = implHeaderPattern.exec(fn.body)) !== null) {
        const traitName = headerMatch[1];
        const forType = headerMatch[2].trim();

        // 열린 괄호 위치부터 매칭되는 닫힌 괄호까지 찾기
        const openBracePos = headerMatch.index + headerMatch[0].length - 1;
        let braceCount = 1;
        let pos = openBracePos + 1;

        while (pos < fn.body.length && braceCount > 0) {
          if (fn.body[pos] === '{') braceCount++;
          else if (fn.body[pos] === '}') braceCount--;
          pos++;
        }

        const body = fn.body.substring(openBracePos + 1, pos - 1);

        // Trait 정의 확인
        if (!result.traits.has(traitName)) {
          result.validationErrors.push({
            type: 'missing_trait_def',
            traitName,
            forType,
            message: `Trait ${traitName} not defined`
          });
          continue;
        }

        const impl: TraitImplementation = {
          traitName,
          forType,
          methods: new Map(),
          associatedTypeBindings: new Map(),
          complete: false,
          confidence: 0.80
        };

        // 메서드 구현 추출: fn name(params) { ... }
        const methodPattern = /fn\s+(\w+)\s*\((.*?)\)\s*(?:->\s*(\w+))?\s*\{([\s\S]*?)\}/g;
        let methodMatch;
        while ((methodMatch = methodPattern.exec(body)) !== null) {
          impl.methods.set(methodMatch[1], methodMatch[4]);
        }

        // Associated type 바인딩 추출: type Name = Type
        const typeBindingPattern = /type\s+(\w+)\s*=\s*([\w<>,\s]+)/g;
        let typeMatch;
        while ((typeMatch = typeBindingPattern.exec(body)) !== null) {
          impl.associatedTypeBindings.set(typeMatch[1], typeMatch[2].trim());
        }

        result.implementations.push(impl);
      }
    }
  }

  /**
   * 구현 검증
   */
  private validateImplementations(result: TraitEngineResult): void {
    for (const impl of result.implementations) {
      const trait = result.traits.get(impl.traitName);
      if (!trait) continue;

      // 모든 필수 메서드 구현 확인
      const requiredMethods = trait.methods.filter(m => m.required);
      const implementedMethods = Array.from(impl.methods.keys());

      let allImplemented = true;
      for (const method of requiredMethods) {
        if (!implementedMethods.includes(method.name)) {
          result.validationErrors.push({
            type: 'missing_method',
            traitName: impl.traitName,
            forType: impl.forType,
            message: `Missing required method: ${method.name}`
          });
          allImplemented = false;
        }
      }

      impl.complete = allImplemented;
      if (allImplemented) {
        impl.confidence = Math.min(0.95, impl.confidence + 0.15);
        result.reasoning.push(
          `Implementation complete: ${impl.traitName} for ${impl.forType}`
        );
      }
    }
  }

  /**
   * Associated Types 검증
   */
  private validateAssociatedTypes(result: TraitEngineResult): void {
    for (const impl of result.implementations) {
      const trait = result.traits.get(impl.traitName);
      if (!trait) continue;

      for (const assocType of trait.associatedTypes) {
        if (!impl.associatedTypeBindings.has(assocType.name)) {
          // default가 있으면 자동 바인딩
          if (assocType.default) {
            impl.associatedTypeBindings.set(assocType.name, assocType.default);
          } else {
            result.validationErrors.push({
              type: 'missing_associated_type',
              traitName: impl.traitName,
              forType: impl.forType,
              message: `Missing associated type binding: ${assocType.name}`
            });
          }
        }
      }
    }
  }

  /**
   * 완전성 계산
   */
  private calculateCompleteness(result: TraitEngineResult): number {
    if (result.implementations.length === 0) return 0;

    const completeImpls = result.implementations.filter(i => i.complete).length;
    return completeImpls / result.implementations.length;
  }

  /**
   * 특정 타입의 trait 구현 조회
   */
  getImplementationsForType(result: TraitEngineResult, type: string): TraitImplementation[] {
    return result.implementations.filter(i => i.forType === type);
  }

  /**
   * 타입이 특정 trait을 구현하는지 확인
   */
  implementsTrait(result: TraitEngineResult, type: string, traitName: string): boolean {
    return result.implementations.some(
      i => i.forType === type && i.traitName === traitName && i.complete
    );
  }

  /**
   * 특정 trait의 모든 구현 조회
   */
  getImplementationsOfTrait(result: TraitEngineResult, traitName: string): TraitImplementation[] {
    return result.implementations.filter(i => i.traitName === traitName);
  }

  /**
   * Trait 정의 조회
   */
  getTrait(result: TraitEngineResult, traitName: string): TraitDefinition | null {
    return result.traits.get(traitName) || null;
  }

  /**
   * 모든 trait 조회
   */
  getAllTraits(result: TraitEngineResult): TraitDefinition[] {
    return Array.from(result.traits.values());
  }

  /**
   * 검증 에러 필터링
   */
  getErrorsForImpl(result: TraitEngineResult, traitName: string, forType: string): TraitValidationError[] {
    return result.validationErrors.filter(
      e => e.traitName === traitName && e.forType === forType
    );
  }
}
