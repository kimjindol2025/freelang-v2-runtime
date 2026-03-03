/**
 * ════════════════════════════════════════════════════════════════════
 * Generics Resolution Engine
 *
 * Generic 선언 추출, Type Parameter 제약, 인스턴스화, Variance 분석
 * ════════════════════════════════════════════════════════════════════
 */

/**
 * Type Parameter 정의
 */
export interface TypeParameter {
  name: string;                   // "T", "K", "V"
  constraint?: string;            // "T extends number"
  default?: string;               // "T = string"
  variance: 'covariant' | 'contravariant' | 'invariant';
}

/**
 * Generic Signature
 */
export interface GenericSignature {
  name: string;
  typeParams: TypeParameter[];
  signature: string;
  instantiations: GenericInstantiation[];
  confidence: number;
}

/**
 * Generic Instantiation
 */
export interface GenericInstantiation {
  typeArgs: Map<string, string>;  // T → number
  resultType: string;
  confidence: number;
  source: 'explicit' | 'inferred';
  reasoning: string[];
}

/**
 * Generics Resolution 결과
 */
export interface GenericsResolutionResult {
  generics: Map<string, GenericSignature>;
  instantiations: GenericInstantiation[];
  resolutionSuccess: number;      // 0.0-1.0
  reasoning: string[];
}

/**
 * Generics Resolution Engine
 */
export class GenericsResolutionEngine {
  /**
   * 메인 빌드 메서드
   */
  build(code: string): GenericsResolutionResult {
    const result: GenericsResolutionResult = {
      generics: new Map(),
      instantiations: [],
      resolutionSuccess: 0,
      reasoning: []
    };

    // Step 1: Generic 선언 추출
    this.extractGenericDeclarations(code, result);

    // Step 2: Type Parameter 제약 추출
    this.extractTypeParameters(code, result);

    // Step 3: Instantiation 추론
    this.inferInstantiations(code, result);

    // Step 4: Resolution 성공률 계산
    this.calculateResolutionSuccess(result);

    return result;
  }

  /**
   * Generic 선언 추출
   */
  private extractGenericDeclarations(code: string, result: GenericsResolutionResult): void {
    // 패턴: Type<T>, Map<K,V>, etc.
    const genericPattern = /(\w+)<([A-Z][a-zA-Z0-9]*(?:\s*,\s*[A-Z][a-zA-Z0-9]*)*)>/g;
    let match;
    const processed = new Set<string>();

    while ((match = genericPattern.exec(code)) !== null) {
      const typeName = match[1];
      const typeParamsStr = match[2];

      if (processed.has(typeName)) continue;
      processed.add(typeName);

      const typeParamNames = typeParamsStr.split(',').map(s => s.trim());
      const typeParams: TypeParameter[] = typeParamNames.map(name => ({
        name,
        variance: this.inferVariance(typeName),
      }));

      const signature: GenericSignature = {
        name: typeName,
        typeParams,
        signature: match[0],
        instantiations: [],
        confidence: 0.85,
      };

      result.generics.set(typeName, signature);
      result.reasoning.push(`Generic type detected: ${match[0]}`);
    }
  }

  /**
   * Type Parameter 제약 추출
   */
  private extractTypeParameters(code: string, result: GenericsResolutionResult): void {
    // extends 제약
    const extendsPattern = /(\w+)\s+extends\s+([A-Za-z0-9<>,\s]+)/g;
    let match;

    while ((match = extendsPattern.exec(code)) !== null) {
      const paramName = match[1];
      const constraint = match[2].trim();

      // 모든 generic에서 이 파라미터를 찾아 제약 추가
      for (const [_, sig] of result.generics.entries()) {
        const param = sig.typeParams.find(p => p.name === paramName);
        if (param) {
          param.constraint = constraint;
          result.reasoning.push(`Type constraint: ${paramName} extends ${constraint}`);
        }
      }
    }
  }

  /**
   * Generic 인스턴시이션 추론
   */
  private inferInstantiations(code: string, result: GenericsResolutionResult): void {
    // 명시적 인스턴시이션: array<number>, Map<string, number>
    const instantPattern = /(\w+)<([^>]+)>/g;
    let match;

    while ((match = instantPattern.exec(code)) !== null) {
      const typeName = match[1];
      const typeArgsStr = match[2];

      if (!result.generics.has(typeName)) continue;

      const sig = result.generics.get(typeName)!;
      const typeArgs = this.parseTypeArgs(typeArgsStr);
      const typeArgMap = new Map<string, string>();

      // Type parameters에 인수 매핑
      for (let i = 0; i < sig.typeParams.length && i < typeArgs.length; i++) {
        typeArgMap.set(sig.typeParams[i].name, typeArgs[i]);
      }

      const resultType = typeName + '<' + typeArgs.join(', ') + '>';
      const instantiation: GenericInstantiation = {
        typeArgs: typeArgMap,
        resultType,
        confidence: 0.85,
        source: 'explicit',
        reasoning: [`Explicit instantiation: ${resultType}`]
      };

      result.instantiations.push(instantiation);
      sig.instantiations.push(instantiation);
    }
  }

  /**
   * Type Arguments 파싱 (중첩 지원)
   */
  private parseTypeArgs(typeArgsStr: string): string[] {
    const args: string[] = [];
    let current = '';
    let depth = 0;

    for (const char of typeArgsStr) {
      if (char === '<') {
        depth++;
        current += char;
      } else if (char === '>') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        args.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (current) {
      args.push(current.trim());
    }

    return args;
  }

  /**
   * Resolution 성공률 계산
   */
  private calculateResolutionSuccess(result: GenericsResolutionResult): void {
    if (result.generics.size === 0) {
      result.resolutionSuccess = 0;
      return;
    }

    let instantiatedCount = 0;
    for (const sig of result.generics.values()) {
      if (sig.instantiations.length > 0) instantiatedCount++;
    }

    result.resolutionSuccess = instantiatedCount / result.generics.size;
    result.reasoning.push(
      `Resolution success: ${instantiatedCount}/${result.generics.size} = ${(result.resolutionSuccess * 100).toFixed(1)}%`
    );
  }

  /**
   * Variance 추론
   */
  private inferVariance(typeName: string): 'covariant' | 'contravariant' | 'invariant' {
    // array, list, vector는 covariant
    if (['array', 'list', 'vector', 'tuple'].includes(typeName.toLowerCase())) {
      return 'covariant';
    }

    // function은 contravariant
    if (typeName.toLowerCase() === 'function') {
      return 'contravariant';
    }

    // 기본값은 invariant
    return 'invariant';
  }

  /**
   * 특정 타입의 인스턴시이션 조회
   */
  getInstantiations(result: GenericsResolutionResult, typeName: string): GenericInstantiation[] {
    const sig = result.generics.get(typeName);
    return sig?.instantiations || [];
  }

  /**
   * Generic signature 조회
   */
  getSignature(result: GenericsResolutionResult, typeName: string): GenericSignature | null {
    return result.generics.get(typeName) || null;
  }

  /**
   * 모든 generic 조회
   */
  getAllGenerics(result: GenericsResolutionResult): GenericSignature[] {
    return Array.from(result.generics.values());
  }
}
