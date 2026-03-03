/**
 * Phase 5 Stage 3.2.3: Code Formatter
 *
 * 함수 본체를 입력받아 변수 타입 추론 결과를 바탕으로
 * 타입 주석을 자동으로 추가합니다.
 *
 * 예시:
 * 입력:
 *   total: number = 0
 *   for i in arr
 *     total += i
 *
 * 출력:
 *   total = 0  // Inferred: number (95% confidence)
 *   for i in arr
 *     total += i
 */

import { analyzeBody, BodyAnalysisResult } from '../analyzer/body-analysis';
import { VariableTypeRecommender, VariableTypeInfo } from '../analyzer/variable-type-recommender';

/**
 * 포맷팅된 코드 결과
 */
export interface FormattedCode {
  original: string;
  formatted: string;
  changes: CodeChange[];
  statistics: FormatStatistics;
}

/**
 * 코드 변경 사항
 */
export interface CodeChange {
  type: 'type_omitted' | 'type_added' | 'comment_added';
  line: number;
  variableName: string;
  oldCode: string;
  newCode: string;
  confidence: number;
}

/**
 * 포맷팅 통계
 */
export interface FormatStatistics {
  linesAnalyzed: number;
  variablesInferred: number;
  typesOmitted: number;
  commentsAdded: number;
  averageConfidence: number;
}

/**
 * Code Formatter - 함수 본체 포맷팅 및 타입 주석 추가
 */
export class CodeFormatter {
  private recommender: VariableTypeRecommender;

  constructor() {
    this.recommender = new VariableTypeRecommender();
  }

  /**
   * 함수 본체를 분석하고 타입 주석을 추가합니다.
   *
   * @param body 함수 본체 코드
   * @returns 포맷팅된 코드 및 통계
   */
  public formatFunctionBody(body: string): FormattedCode {
    // 1. BodyAnalyzer로 분석
    const analysis = analyzeBody(body);

    // 2. 추론된 변수 타입 추출
    const inferredVariables = analysis.inferredVariableTypes || new Map();

    // 3. 코드 변경 사항 수집
    const changes: CodeChange[] = [];
    const lines = body.split('\n');
    const formattedLines: string[] = [];
    let variablesProcessed = 0;
    let typesOmitted = 0;
    let commentsAdded = 0;
    let totalConfidence = 0;

    // 4. 라인별로 처리
    inferredVariables.forEach((info: VariableTypeInfo) => {
      totalConfidence += info.confidence;
      variablesProcessed++;
    });

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      let lineChanged = false;

      // 각 변수에 대해 처리
      inferredVariables.forEach((info: VariableTypeInfo) => {
        if (lineChanged) return; // 이미 처리됨

        const recommendation = this.recommender.recommend(info);
        if (!recommendation.shouldOmitType) return;

        // 변수 선언 패턴 찾기: "varName: type" 형식
        // 예: total: number = 0, let x: string = "hi"
        const colonIndex = line.indexOf(`${info.name}:`);
        if (colonIndex === -1) return; // 패턴 없음

        // 콜론 다음의 타입 부분과 = 찾기
        const equalIndex = line.indexOf('=', colonIndex);
        if (equalIndex === -1) return; // = 없음

        const oldCode = line.substring(colonIndex, equalIndex).trim();
        const beforeVar = line.substring(0, colonIndex);
        const afterEqual = line.substring(equalIndex);

        let newCode = `${beforeVar.trimEnd()} ${info.name} ${afterEqual}`;

        // 주석 추가
        if (recommendation.shouldShowComment) {
          const comment = this._generateInlineComment(info, recommendation);
          // = 다음 공백과 값을 찾아 주석 추가
          const valueMatch = afterEqual.match(/=\s*(.+?)(\s*$)/);
          if (valueMatch) {
            const value = valueMatch[1];
            newCode = `${beforeVar.trimEnd()} ${info.name} = ${value}${comment}`;
          }
          commentsAdded++;
        } else {
          commentsAdded++;
        }

        line = newCode;
        lineChanged = true;
        typesOmitted++;

        changes.push({
          type: recommendation.shouldShowComment ? 'comment_added' : 'type_omitted',
          line: i + 1,
          variableName: info.name,
          oldCode: `${info.name}${oldCode}`,
          newCode: newCode.trim(),
          confidence: info.confidence
        });
      });

      formattedLines.push(line);
    }

    const formatted = formattedLines.join('\n');

    // 5. 통계 계산
    const statistics: FormatStatistics = {
      linesAnalyzed: body.split('\n').length,
      variablesInferred: inferredVariables.size,
      typesOmitted,
      commentsAdded,
      averageConfidence:
        variablesProcessed > 0 ? totalConfidence / variablesProcessed : 0
    };

    return {
      original: body,
      formatted,
      changes,
      statistics
    };
  }

  /**
   * 변수 선언 패턴 생성
   * 다양한 형식의 변수 선언을 감지합니다.
   *
   * 지원하는 형식:
   * - let total: number = 0
   * - const arr: array<number> = []
   * - total: number = 0  (no let/const)
   */
  private _generateVariablePatterns(
    varName: string,
    varType: string
  ): Array<{
    regex: RegExp;
    replacement: (match: string, info: VariableTypeInfo) => string;
  }> {
    const patterns: Array<{
      regex: RegExp;
      replacement: (match: string, info: VariableTypeInfo) => string;
    }> = [];

    // Pattern 1: let/const varName: type = value
    patterns.push({
      regex: new RegExp(
        `(let|const)\\s+${varName}\\s*:\\s*[\\w<>,\\s]+\\s*=`,
        'g'
      ),
      replacement: (match: string, info: VariableTypeInfo) => {
        const keyword = match.includes('let') ? 'let' : 'const';
        return `${keyword} ${varName} =`;
      }
    });

    // Pattern 2: varName: type = value (no let/const)
    patterns.push({
      regex: new RegExp(`${varName}\\s*:\\s*[\\w<>,\\s]+\\s*=`, 'g'),
      replacement: (match: string, info: VariableTypeInfo) => {
        return `${varName} =`;
      }
    });

    // Pattern 3: varName = value (already without type)
    patterns.push({
      regex: new RegExp(`${varName}\\s*=`, 'g'),
      replacement: (match: string, info: VariableTypeInfo) => {
        return match; // No change needed
      }
    });

    return patterns;
  }

  /**
   * 인라인 주석 생성
   */
  private _generateInlineComment(
    info: VariableTypeInfo,
    recommendation: any
  ): string {
    const confidence = Math.round(info.confidence * 100);
    return `  // Inferred: ${info.inferredType} (${confidence}% confidence, source: ${info.source})`;
  }

  /**
   * 원본 코드에서 주어진 텍스트의 줄 번호 구하기
   */
  private _getLineNumber(original: string, text: string): number {
    const lines = original.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(text)) {
        return i + 1;
      }
    }
    return 1;
  }

  /**
   * 전체 함수를 포맷팅 (헤더 + 본체)
   *
   * @param functionCode 전체 함수 코드
   * @returns 포맷팅된 함수
   */
  public formatFunction(functionCode: string): FormattedCode {
    // 함수 본체 추출 (do ~ 이후부터 끝까지)
    const doMatch = functionCode.match(/\bdo\b/);
    if (!doMatch) {
      // do가 없으면 전체를 본체로 취급
      return this.formatFunctionBody(functionCode);
    }

    const doIndex = doMatch.index || 0;
    const header = functionCode.substring(0, doIndex + 2); // "do" 포함
    const body = functionCode.substring(doIndex + 2);

    // 본체 포맷팅
    const bodyResult = this.formatFunctionBody(body);

    // 결과 결합
    return {
      ...bodyResult,
      original: functionCode,
      formatted: header + bodyResult.formatted
    };
  }
}

/**
 * 싱글톤 인스턴스
 */
export const codeFormatter = new CodeFormatter();
