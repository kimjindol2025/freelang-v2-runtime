/**
 * Phase 4 Step 3: Comment Analyzer
 *
 * 코드 주석에서 의미를 추출하여 타입 및 도메인 추론
 * 예: "// finance: 세금 계산" → domain: "finance"
 *     "// format: currency with 2 decimals" → format: "currency"
 *     "// range: 0-100 percent" → range: { min: 0, max: 100, unit: "percent" }
 */

export interface CommentInfo {
  domain?: string;                // 추론된 도메인 (finance, web, crypto, data-science, iot)
  format?: string;                // 포맷 정보 (percent, cents, currency, bytes, hex, validated, hash, encrypted)
  range?: {
    min?: number;
    max?: number;
    isPositive?: boolean;         // > 0
    isNonNegative?: boolean;      // >= 0
    isNegative?: boolean;         // < 0
    unit?: string;                // percent, bytes, etc
  };
  confidence: number;             // 0.0-1.0
  reasoning: string[];
}

/**
 * 주석 분석기
 */
export class CommentAnalyzer {
  /**
   * 도메인 키워드
   */
  private domainKeywords = new Map<string, string>([
    // Finance
    ['tax', 'finance'],
    ['price', 'finance'],
    ['cost', 'finance'],
    ['currency', 'finance'],
    ['money', 'finance'],
    ['amount', 'finance'],
    ['payment', 'finance'],
    ['invoice', 'finance'],
    ['fee', 'finance'],
    ['discount', 'finance'],

    // Web
    ['email', 'web'],
    ['url', 'web'],
    ['domain', 'web'],
    ['http', 'web'],
    ['request', 'web'],
    ['response', 'web'],
    ['validation', 'web'],
    ['phone', 'web'],

    // Crypto
    ['hash', 'crypto'],
    ['encryption', 'crypto'],
    ['key', 'crypto'],
    ['signature', 'crypto'],
    ['certificate', 'crypto'],
    ['token', 'crypto'],
    ['cipher', 'crypto'],
    ['salt', 'crypto'],

    // Data Science
    ['vector', 'data-science'],
    ['matrix', 'data-science'],
    ['tensor', 'data-science'],
    ['dataset', 'data-science'],
    ['model', 'data-science'],
    ['feature', 'data-science'],
    ['regression', 'data-science'],
    ['classification', 'data-science'],
    ['clustering', 'data-science'],

    // IoT
    ['sensor', 'iot'],
    ['device', 'iot'],
    ['reading', 'iot'],
    ['measurement', 'iot'],
    ['temperature', 'iot'],
    ['humidity', 'iot'],
    ['signal', 'iot'],
  ]);

  /**
   * 포맷 키워드
   */
  private formatKeywords = new Map<string, string>([
    ['percent', 'percent'],
    ['percentage', 'percent'],
    ['cents', 'cents'],
    ['currency', 'currency'],
    ['money', 'currency'],
    ['bytes', 'bytes'],
    ['hex', 'hex'],
    ['hexadecimal', 'hex'],
    ['validated', 'validated_string'],
    ['validation', 'validated_string'],
    ['hash', 'hash_string'],
    ['encrypted', 'encrypted_string'],
    ['base64', 'base64_string'],
    ['json', 'json_string'],
  ]);

  /**
   * 주석 분석
   */
  public analyzeComment(comment: string): CommentInfo {
    if (!comment || comment.length === 0) {
      return {
        confidence: 0,
        reasoning: ['Empty comment']
      };
    }

    const cleanComment = this.normalizeComment(comment);
    const info: CommentInfo = {
      confidence: 0,
      reasoning: []
    };

    // Step 1: 도메인 추출
    const domainResult = this.extractDomain(cleanComment);
    if (domainResult) {
      info.domain = domainResult.domain;
      info.confidence = Math.max(info.confidence, domainResult.confidence);
      info.reasoning.push(domainResult.reason);
    }

    // Step 2: 포맷 추출
    const formatResult = this.extractFormat(cleanComment);
    if (formatResult) {
      info.format = formatResult.format;
      info.confidence = Math.max(info.confidence, formatResult.confidence);
      info.reasoning.push(formatResult.reason);
    }

    // Step 3: 범위 추출
    const rangeResult = this.extractRange(cleanComment);
    if (rangeResult) {
      info.range = rangeResult.range;
      info.confidence = Math.max(info.confidence, rangeResult.confidence);
      info.reasoning.push(rangeResult.reason);
    }

    // Step 4: 신뢰도 정규화
    if (info.confidence === 0 && info.reasoning.length === 0) {
      info.reasoning.push('No domain, format, or range information detected');
      info.confidence = 0.0;
    } else {
      info.confidence = Math.min(0.95, Math.max(0.0, info.confidence));
    }

    return info;
  }

  /**
   * 여러 주석 분석
   */
  public analyzeComments(comments: string[]): CommentInfo[] {
    return comments.map(comment => this.analyzeComment(comment));
  }

  /**
   * 주석 정규화
   */
  private normalizeComment(comment: string): string {
    return comment
      .replace(/^\/\/\s*/, '')     // '//' 제거
      .replace(/^\/\*\s*/, '')     // '/*' 제거
      .replace(/\s*\*\/$/, '')     // '*/' 제거
      .toLowerCase()
      .trim();
  }

  /**
   * 도메인 추출
   */
  private extractDomain(comment: string): {
    domain: string;
    confidence: number;
    reason: string;
  } | null {
    // 명시적 도메인 태그 (finance:, web:, etc)
    const explicitMatch = comment.match(/\b(finance|web|crypto|data-science|iot):/);
    if (explicitMatch) {
      const domain = explicitMatch[1];
      return {
        domain,
        confidence: 0.95,
        reason: `Explicit domain tag detected: "${domain}"`
      };
    }

    // 키워드 기반 도메인 추출
    const domainMatches = new Map<string, number>(); // domain → count

    for (const [keyword, domain] of this.domainKeywords.entries()) {
      if (comment.includes(keyword)) {
        const count = (comment.match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length;
        domainMatches.set(domain, (domainMatches.get(domain) || 0) + count);
      }
    }

    if (domainMatches.size > 0) {
      // 가장 많은 키워드 매치 도메인 선택
      let maxCount = 0;
      let detectedDomain: string | null = null;
      for (const [domain, count] of domainMatches.entries()) {
        if (count > maxCount) {
          maxCount = count;
          detectedDomain = domain;
        }
      }

      if (detectedDomain) {
        // 신뢰도: 기본 0.70 + 키워드 개수별 증가 (최대 0.95)
        const confidence = Math.min(0.95, 0.70 + maxCount * 0.1);
        return {
          domain: detectedDomain,
          confidence,
          reason: `Domain detected from keywords: "${detectedDomain}" (${maxCount} matches)`
        };
      }
    }

    return null;
  }

  /**
   * 포맷 추출
   */
  private extractFormat(comment: string): {
    format: string;
    confidence: number;
    reason: string;
  } | null {
    const formatMatches: Array<{
      format: string;
      keyword: string;
      position: number;
      count: number;
      confidence: number;
    }> = [];

    for (const [keyword, format] of this.formatKeywords.entries()) {
      const position = comment.indexOf(keyword);
      if (position !== -1) {
        const count = (comment.match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length;
        const confidence = Math.min(0.95, 0.80 + count * 0.05);

        formatMatches.push({
          format,
          keyword,
          position,
          count,
          confidence
        });
      }
    }

    if (formatMatches.length === 0) {
      return null;
    }

    // 조건별 우선순위:
    // 1. 신뢰도가 높은 것 (명시적 포맷 키워드)
    // 2. 주석에서 먼저 나타나는 것
    formatMatches.sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence; // 신뢰도 높은 것 먼저
      }
      return a.position - b.position; // 같은 신뢰도면 먼저 나타나는 것
    });

    const best = formatMatches[0];
    return {
      format: best.format,
      confidence: best.confidence,
      reason: `Format detected: "${best.format}"`
    };
  }

  /**
   * 범위 추출
   */
  private extractRange(comment: string): {
    range: CommentInfo['range'];
    confidence: number;
    reason: string;
  } | null {
    const range: CommentInfo['range'] = {};
    let hasRangeInfo = false;

    // 범위 패턴: "0-100", "0 to 100", "0..100", "min: 0, max: 100"
    // 더 강력한 정규식: 선택적 음수 부호, 소수점 지원
    const rangePatterns = [
      /(?:range\s*:?\s*)?(-?\d+(?:\.\d+)?)\s*[-–to\.]+\s*(-?\d+(?:\.\d+)?)/,  // "0-100" 또는 "0..100"
      /(?:min\s*:?\s*)?(-?\d+(?:\.\d+)?)\s*,\s*(?:max\s*:?\s*)?(-?\d+(?:\.\d+)?)/,  // "min: 0, max: 100"
      /(?:from\s+)?(-?\d+(?:\.\d+)?)\s+(?:to|through)\s+(-?\d+(?:\.\d+)?)/,  // "from 0 to 100"
    ];

    for (const pattern of rangePatterns) {
      const rangeMatch = comment.match(pattern);
      if (rangeMatch) {
        range.min = parseFloat(rangeMatch[1]);
        range.max = parseFloat(rangeMatch[2]);
        hasRangeInfo = true;
        break;
      }
    }

    // 양수 패턴 (더 강력함)
    if (/\b(?:positive|>0|> 0)\b/.test(comment)) {
      range.isPositive = true;
      hasRangeInfo = true;
    }

    // 음이 아닌 패턴
    if (/\b(?:non-negative|non negative|>=0|>= 0)\b/.test(comment)) {
      range.isNonNegative = true;
      hasRangeInfo = true;
    }

    // 음수 패턴
    if (/\b(?:negative|<0|< 0)\b/.test(comment)) {
      range.isNegative = true;
      hasRangeInfo = true;
    }

    // 단위 추출 (더 강력한 패턴)
    const unitPatterns = [
      /\b(percent|percentage|%)\b/,
      /\b(bytes?|kb|mb|gb)\b/,
      /\b(second|seconds|sec|secs?)\b/,
      /\b(hour|hours|hrs?)\b/,
      /\b(day|days)\b/,
      /\b(millisecond|milliseconds|ms)\b/,
      /\b(microsecond|microseconds|µs|us)\b/,
      /\b(nanosecond|nanoseconds|ns)\b/,
      /\b(minute|minutes|mins?)\b/,
    ];

    for (const pattern of unitPatterns) {
      const unitMatch = comment.match(pattern);
      if (unitMatch) {
        range.unit = unitMatch[1];
        hasRangeInfo = true;
        break;
      }
    }

    if (hasRangeInfo) {
      return {
        range,
        confidence: 0.80,
        reason: `Range constraints detected: ${JSON.stringify(range)}`
      };
    }

    return null;
  }

  /**
   * 특정 단어가 어떤 도메인을 나타내는지 조회
   */
  public getDomainForKeyword(keyword: string): string | null {
    return this.domainKeywords.get(keyword.toLowerCase()) || null;
  }

  /**
   * 특정 단어가 어떤 포맷을 나타내는지 조회
   */
  public getFormatForKeyword(keyword: string): string | null {
    return this.formatKeywords.get(keyword.toLowerCase()) || null;
  }
}
