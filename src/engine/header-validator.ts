/**
 * FreeLang v2 - 헤더 검증기
 * 생성된 헤더의 구문/타입/의도 검증
 */

import { HeaderProposal } from './header-generator';
import { INTENT_PATTERNS, PATTERN_IDS } from './intent-patterns';

/**
 * 검증 결과
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
  score: number; // 0~1
}

/**
 * 검증 오류
 */
export interface ValidationError {
  type: 'syntax' | 'type' | 'intent' | 'context';
  message: string;
  severity: 'critical' | 'warning' | 'info';
  line?: number;
}

/**
 * 헤더 검증기
 */
export class HeaderValidator {
  /**
   * 완전한 헤더 검증
   *
   * 검증 항목:
   * 1. 구문 검증 (fn 형식 확인)
   * 2. 타입 검증 (입출력 타입 유효성)
   * 3. 의도 검증 (operation 타당성)
   * 4. 컨텍스트 검증 (directive 유효성)
   *
   * @param header HeaderProposal 또는 헤더 문자열
   * @returns 검증 결과
   */
  static validate(
    header: HeaderProposal | string
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // String 변환
    const headerData = typeof header === 'string'
      ? this._parseHeader(header)
      : header;

    if (!headerData) {
      return {
        valid: false,
        errors: [{
          type: 'syntax',
          message: '헤더 파싱 실패: "fn <operation>: <input> → <output>" 형식이 아님',
          severity: 'critical',
        }],
        warnings: [],
        score: 0,
      };
    }

    // 1. 구문 검증
    const syntaxErrors = this._validateSyntax(headerData);
    errors.push(...syntaxErrors);

    // 2. 타입 검증
    const typeErrors = this._validateTypes(headerData);
    errors.push(...typeErrors);

    // 3. 의도 검증
    const intentErrors = this._validateIntent(headerData);
    errors.push(...intentErrors);

    // 4. 컨텍스트 검증
    if (headerData.directive && headerData.operation) {
      const contextErrors = this._validateContext(
        headerData.operation as string,
        headerData.directive
      );
      errors.push(...contextErrors);
    }

    // 신뢰도 점수 계산
    const criticalErrors = errors.filter(e => e.severity === 'critical').length;
    const score = Math.max(0, 1 - criticalErrors * 0.5);

    return {
      valid: errors.filter(e => e.severity === 'critical').length === 0,
      errors: errors.filter(e => e.severity === 'critical'),
      warnings: [
        ...warnings,
        ...errors
          .filter(e => e.severity === 'warning')
          .map(e => e.message),
      ],
      score,
    };
  }

  /**
   * Step 1: 구문 검증
   * @private
   */
  private static _validateSyntax(
    header: Partial<HeaderProposal>
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // operation 확인
    if (!header.operation || typeof header.operation !== 'string') {
      errors.push({
        type: 'syntax',
        message: 'operation이 없거나 유효하지 않음',
        severity: 'critical',
      });
    }

    // inputType 확인
    if (!header.inputType || typeof header.inputType !== 'string') {
      errors.push({
        type: 'syntax',
        message: 'inputType이 없거나 유효하지 않음',
        severity: 'critical',
      });
    }

    // outputType 확인
    if (!header.outputType || typeof header.outputType !== 'string') {
      errors.push({
        type: 'syntax',
        message: 'outputType이 없거나 유효하지 않음',
        severity: 'critical',
      });
    }

    return errors;
  }

  /**
   * Step 2: 타입 검증
   * @private
   */
  private static _validateTypes(
    header: Partial<HeaderProposal>
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!header.inputType || !header.outputType) {
      return errors;
    }

    // 지원되는 타입 확인
    const validTypes = [
      'number',
      'string',
      'array<number>',
      'array<string>',
      'boolean',
    ];

    if (!validTypes.includes(header.inputType)) {
      errors.push({
        type: 'type',
        message: `inputType "${header.inputType}"은 지원하지 않음. 지원: ${validTypes.join(', ')}`,
        severity: 'warning',
      });
    }

    if (!validTypes.includes(header.outputType)) {
      errors.push({
        type: 'type',
        message: `outputType "${header.outputType}"은 지원하지 않음. 지원: ${validTypes.join(', ')}`,
        severity: 'warning',
      });
    }

    // 패턴과 타입 일치성 확인
    if (header.operation && INTENT_PATTERNS[header.operation]) {
      const pattern = INTENT_PATTERNS[header.operation];

      if (header.inputType !== pattern.inputType) {
        errors.push({
          type: 'type',
          message: `inputType 불일치: "${header.inputType}" vs 패턴 "${pattern.inputType}"`,
          severity: 'info',
        });
      }

      if (header.outputType !== pattern.outputType) {
        errors.push({
          type: 'type',
          message: `outputType 불일치: "${header.outputType}" vs 패턴 "${pattern.outputType}"`,
          severity: 'info',
        });
      }
    }

    return errors;
  }

  /**
   * Step 3: 의도 검증
   * @private
   */
  private static _validateIntent(
    header: Partial<HeaderProposal>
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!header.operation) {
      return errors;
    }

    // Operation이 알려진 패턴인지 확인
    if (!PATTERN_IDS.includes(header.operation as any)) {
      errors.push({
        type: 'intent',
        message: `operation "${header.operation}"은 알려진 패턴이 아님. 지원: ${PATTERN_IDS.join(', ')}`,
        severity: 'critical',
      });
    }

    // Reason 확인 (없으면 경고)
    if (!header.reason) {
      errors.push({
        type: 'intent',
        message: 'reason이 없습니다. (권장: 있어야 함)',
        severity: 'info',
      });
    }

    return errors;
  }

  /**
   * Step 4: 컨텍스트 검증
   * @private
   */
  private static _validateContext(
    operation: string,
    directive: string
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!directive) return errors;

    // Directive 유효성 확인 (키워드 기반)
    const validKeywords = [
      '메모리 효율성',
      '속도 우선',
      '안정성',
      '검증',
      'O(n)',
      '캐싱',
      '정렬',
    ];

    const hasValidKeyword = validKeywords.some(kw => directive.includes(kw));

    if (!hasValidKeyword && directive.length < 5) {
      errors.push({
        type: 'context',
        message: `directive가 너무 짧거나 유효하지 않음: "${directive}"`,
        severity: 'warning',
      });
    }

    // 패턴-directive 조화 검사
    if (operation === 'sort' && directive.includes('캐싱')) {
      errors.push({
        type: 'context',
        message: '정렬 작업에 "캐싱"이 부적절할 수 있음',
        severity: 'info',
      });
    }

    return errors;
  }

  /**
   * 헤더 문자열 파싱
   * @private
   */
  private static _parseHeader(
    headerString: string
  ): Partial<HeaderProposal> | null {
    const lines = headerString.split('\n');
    const header: Partial<HeaderProposal> = {};

    // 첫 줄: fn sum: array<number> → number
    const match = lines[0]?.match(
      /fn\s+(\w+):\s*(\S+)\s*→\s*(\S+)/
    );

    if (!match) return null;

    header.operation = match[1];
    header.inputType = match[2];
    header.outputType = match[3];

    // 나머지 줄: reason, directive 파싱
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes('~"') || line.includes('~ "')) {
        // ~ "이유"
        const reasonMatch = line.match(/~\s*"([^"]+)"/);
        if (reasonMatch) {
          header.reason = reasonMatch[1];
        }
      }

      if (line.includes('directive:')) {
        // directive: "..."
        const directiveMatch = line.match(/directive:\s*"([^"]+)"/);
        if (directiveMatch) {
          header.directive = directiveMatch[1];
        }
      }
    }

    return header;
  }

  /**
   * 검증 결과 상세 리포트 생성
   */
  static generateReport(result: ValidationResult): string {
    let report = '';

    if (result.valid) {
      report += '✅ 헤더 검증 성공\n';
    } else {
      report += '❌ 헤더 검증 실패\n';
    }

    report += `신뢰도: ${(result.score * 100).toFixed(0)}%\n\n`;

    if (result.errors.length > 0) {
      report += '🔴 오류:\n';
      result.errors.forEach(e => {
        report += `  - [${e.type}] ${e.message}\n`;
      });
    }

    if (result.warnings.length > 0) {
      report += '\n🟡 경고:\n';
      result.warnings.forEach(w => {
        report += `  - ${w}\n`;
      });
    }

    return report;
  }
}
