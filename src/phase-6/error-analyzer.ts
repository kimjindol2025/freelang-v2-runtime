/**
 * Phase 6.2 Week 4: ErrorAnalyzer
 *
 * 오류 패턴 분석:
 * - 반복되는 오류 감지
 * - 오류 원인 분류
 * - 회피 전략 제안
 * - 신뢰도 점수 계산
 */

import { ExecutionResult } from './smart-repl';

/**
 * 오류 패턴
 */
export interface ErrorPattern {
  type: string;  // 'syntax', 'runtime', 'type', 'logic', 'unknown'
  description: string;
  count: number;
  lastOccurred: number;
  relatedCodes: string[];
  avoidanceStrategies: string[];
  confidence: number;  // 0-1
}

/**
 * 오류 분류
 */
export interface ErrorClassification {
  errorType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  suggestion: string;
}

/**
 * 오류 통계
 */
export interface ErrorStats {
  totalErrors: number;
  uniqueErrorTypes: number;
  mostCommonError: ErrorPattern | null;
  successRate: number;
  errorTrend: number;  // 개선율 (0-1)
  topPatterns: ErrorPattern[];
}

/**
 * ErrorAnalyzer: 오류 패턴 분석
 */
export class ErrorAnalyzer {
  private errorPatterns: Map<string, ErrorPattern> = new Map();
  private executionLog: Array<{
    code: string;
    result: ExecutionResult;
    timestamp: number;
  }> = [];
  private readonly maxPatterns = 100;
  private readonly maxLog = 5000;

  constructor() {
    this.errorPatterns = new Map();
    this.executionLog = [];
  }

  /**
   * 실행 결과로부터 오류 분석
   */
  analyzeError(code: string, result: ExecutionResult): ErrorPattern | null {
    if (result.success) {
      // 성공 로그 기록
      this.executionLog.push({
        code,
        result,
        timestamp: Date.now(),
      });
      return null;
    }

    // 오류 분류
    const classification = this.classifyError(result.error || 'Unknown error');
    const patternKey = this.generatePatternKey(code, classification.errorType);

    let pattern = this.errorPatterns.get(patternKey);

    if (pattern) {
      // 기존 오류 패턴 업데이트
      pattern.count++;
      pattern.lastOccurred = Date.now();
      if (!pattern.relatedCodes.includes(code)) {
        pattern.relatedCodes.push(code);
      }
      pattern.confidence = Math.min(
        0.95,
        0.3 + Math.log(pattern.count + 1) / 10
      );
    } else {
      // 새 오류 패턴 생성
      pattern = {
        type: classification.errorType,
        description: classification.message,
        count: 1,
        lastOccurred: Date.now(),
        relatedCodes: [code],
        avoidanceStrategies: this.generateStrategies(classification),
        confidence: 0.3,
      };
      this.errorPatterns.set(patternKey, pattern);
    }

    // 로그 기록
    this.executionLog.push({
      code,
      result,
      timestamp: Date.now(),
    });

    if (this.executionLog.length > this.maxLog) {
      this.executionLog.shift();
    }

    if (this.errorPatterns.size > this.maxPatterns) {
      this.removeLowestConfidencePattern();
    }

    return pattern;
  }

  /**
   * 오류 분류
   */
  classifyError(errorMessage: string): ErrorClassification {
    const msg = errorMessage.toLowerCase();

    // Syntax errors
    if (
      msg.includes('syntax') ||
      msg.includes('unexpected') ||
      msg.includes('expected')
    ) {
      return {
        errorType: 'syntax',
        severity: 'high',
        message: '문법 오류',
        suggestion:
          '코드 문법을 확인하세요. 괄호, 세미콜론, 키워드를 검증하세요.',
      };
    }

    // Type errors
    if (
      msg.includes('type') ||
      msg.includes('is not a function') ||
      msg.includes('undefined')
    ) {
      return {
        errorType: 'type',
        severity: 'high',
        message: '타입 오류',
        suggestion: '변수 타입을 확인하고 타입 캐스팅을 시도하세요.',
      };
    }

    // Runtime errors
    if (
      msg.includes('runtime') ||
      msg.includes('cannot read') ||
      msg.includes('null')
    ) {
      return {
        errorType: 'runtime',
        severity: 'high',
        message: '런타임 오류',
        suggestion:
          'Null 체크를 추가하고 배열 경계를 확인하세요.',
      };
    }

    // Logic errors (inferred)
    if (msg.includes('assert') || msg.includes('failed')) {
      return {
        errorType: 'logic',
        severity: 'medium',
        message: '논리 오류',
        suggestion: '알고리즘 로직을 다시 검토하세요.',
      };
    }

    // Unknown
    return {
      errorType: 'unknown',
      severity: 'medium',
      message: '알 수 없는 오류',
      suggestion: '오류 메시지를 자세히 읽고 디버깅하세요.',
    };
  }

  /**
   * 회피 전략 생성
   */
  private generateStrategies(classification: ErrorClassification): string[] {
    const strategies: string[] = [];

    if (classification.errorType === 'syntax') {
      strategies.push('코드 블록을 작은 단위로 분할');
      strategies.push('린터 사용으로 문법 검증');
      strategies.push('주석으로 코드 의도 명시');
    } else if (classification.errorType === 'type') {
      strategies.push('변수 타입 선언 추가');
      strategies.push('타입 체크 함수 사용');
      strategies.push('안전한 타입 캐스팅');
    } else if (classification.errorType === 'runtime') {
      strategies.push('Null 체크 추가');
      strategies.push('배열 크기 검증');
      strategies.push('에러 핸들링 래핑');
    } else if (classification.errorType === 'logic') {
      strategies.push('테스트 케이스 추가');
      strategies.push('단계별 검증');
      strategies.push('불변성 검증');
    }

    return strategies;
  }

  /**
   * 오류 통계
   */
  getStats(): ErrorStats {
    const patterns = Array.from(this.errorPatterns.values());

    if (patterns.length === 0) {
      return {
        totalErrors: 0,
        uniqueErrorTypes: 0,
        mostCommonError: null,
        successRate: 100,
        errorTrend: 0,
        topPatterns: [],
      };
    }

    const totalErrors = patterns.reduce((sum, p) => sum + p.count, 0);
    const uniqueTypes = new Set(patterns.map((p) => p.type)).size;

    // 가장 흔한 오류
    const mostCommonError = [...patterns].sort((a, b) => b.count - a.count)[0];

    // 성공률 계산
    const successCount = this.executionLog.filter(
      (log) => log.result.success
    ).length;
    const successRate =
      this.executionLog.length > 0
        ? (successCount / this.executionLog.length) * 100
        : 100;

    // 오류 추세 (최근 vs 과거)
    const recentLog = this.executionLog.slice(-500);
    const oldLog = this.executionLog.slice(0, -500);

    const recentErrorCount = recentLog.filter(
      (log) => !log.result.success
    ).length;
    const oldErrorCount = oldLog.filter((log) => !log.result.success).length;

    const recentErrorRate =
      recentLog.length > 0 ? recentErrorCount / recentLog.length : 0;
    const oldErrorRate =
      oldLog.length > 0 ? oldErrorCount / oldLog.length : 0;

    const errorTrend = Math.max(-1, Math.min(1, oldErrorRate - recentErrorRate)); // 개선되면 양수

    // 상위 패턴
    const topPatterns = [...patterns]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    return {
      totalErrors,
      uniqueErrorTypes: uniqueTypes,
      mostCommonError,
      successRate,
      errorTrend,
      topPatterns,
    };
  }

  /**
   * 오류 회피 조언
   */
  getAvoidanceAdvice(errorType: string): string[] {
    const patterns = Array.from(this.errorPatterns.values()).filter(
      (p) => p.type === errorType
    );

    if (patterns.length === 0) return [];

    const advice = new Set<string>();
    for (const pattern of patterns) {
      pattern.avoidanceStrategies.forEach((s) => advice.add(s));
    }

    return Array.from(advice);
  }

  /**
   * 패턴 키 생성 (내부)
   */
  private generatePatternKey(code: string, errorType: string): string {
    const codeHash = code.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return `${errorType}-${codeHash % 1000}`;
  }

  /**
   * 최저 신뢰도 패턴 제거 (내부)
   */
  private removeLowestConfidencePattern(): void {
    let lowestKey: string | null = null;
    let lowestConfidence = 1;

    for (const [key, pattern] of this.errorPatterns) {
      if (pattern.confidence < lowestConfidence) {
        lowestConfidence = pattern.confidence;
        lowestKey = key;
      }
    }

    if (lowestKey) {
      this.errorPatterns.delete(lowestKey);
    }
  }

  /**
   * 패턴 목록
   */
  listPatterns(): ErrorPattern[] {
    return Array.from(this.errorPatterns.values());
  }

  /**
   * 초기화
   */
  reset(): void {
    this.errorPatterns.clear();
    this.executionLog = [];
  }

  /**
   * 실행 로그 조회
   */
  getLog(limit: number = 100): Array<{
    code: string;
    result: ExecutionResult;
    timestamp: number;
  }> {
    return this.executionLog.slice(-limit);
  }

  /**
   * 오류 추세 리포트
   */
  generateReport(): string {
    const stats = this.getStats();

    return `
╔════════════════════════════════════════════════════════════╗
║          Error Analysis Report                             ║
╚════════════════════════════════════════════════════════════╝

📊 Summary
  Total Errors: ${stats.totalErrors}
  Unique Types: ${stats.uniqueErrorTypes}
  Success Rate: ${stats.successRate.toFixed(1)}%

📈 Trends
  Error Reduction: ${(stats.errorTrend * 100).toFixed(1)}%
  ${stats.errorTrend > 0 ? '✅ Improving!' : '⚠️ Getting worse'}

🔴 Most Common Error
  ${stats.mostCommonError ? `${stats.mostCommonError.type.toUpperCase()}: ${stats.mostCommonError.description} (${stats.mostCommonError.count}x)` : 'No errors yet'}

💡 Top Error Patterns
${stats.topPatterns
  .map((p) => `  [${p.type}] ${p.description} - ${p.count} occurrences`)
  .join('\n')}
    `.trim();
  }
}

/**
 * 글로벌 인스턴스
 */
export const globalErrorAnalyzer = new ErrorAnalyzer();
