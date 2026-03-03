/**
 * Phase 10: C Code Emitter
 *
 * HeaderProposal → C Code 변환
 * 간단하지만 실행 가능한 C 코드 생성
 */

import { HeaderProposal } from '../engine/auto-header';

export class CEmitter {
  /**
   * Proposal을 C 코드로 변환
   */
  emit(proposal: HeaderProposal): string {
    const includes = this.generateIncludes(proposal);
    const signature = this.generateSignature(proposal);
    const body = this.generateBody(proposal);

    return [includes, signature, body].filter(Boolean).join('\n');
  }

  /**
   * Include 문 생성
   */
  private generateIncludes(proposal: HeaderProposal): string {
    const includes = new Set(['#include <stdio.h>']);

    if (this.usesString(proposal)) {
      includes.add('#include <string.h>');
    }
    if (this.usesStdlib(proposal)) {
      includes.add('#include <stdlib.h>');
    }
    if (this.usesMath(proposal)) {
      includes.add('#include <math.h>');
    }

    return Array.from(includes).join('\n');
  }

  /**
   * 함수 시그니처 생성
   */
  private generateSignature(proposal: HeaderProposal): string {
    const cInputType = this.mapType(proposal.input);
    const paramName = this.getParamName(proposal.input);

    // 배열 반환 함수: void로 변경 (제자리 수정)
    if (proposal.output.startsWith('array<')) {
      if (proposal.input.startsWith('array<')) {
        return `void ${proposal.fn}(${cInputType}* ${paramName}, int len) {`;
      } else {
        return `void ${proposal.fn}(${cInputType} ${paramName}) {`;
      }
    }

    // 단일 값 반환 함수: 원래 타입 유지
    const cReturnType = this.mapType(proposal.output);
    if (proposal.input.startsWith('array<')) {
      return `${cReturnType} ${proposal.fn}(${cInputType}* ${paramName}, int len) {`;
    } else {
      return `${cReturnType} ${proposal.fn}(${cInputType} ${paramName}) {`;
    }
  }

  /**
   * 함수 본체 생성
   */
  private generateBody(proposal: HeaderProposal): string {
    const paramName = this.getParamName(proposal.input);
    const resultType = this.mapType(proposal.output);

    // 동작별 패턴
    const op = proposal.matched_op;

    let bodyCode = '';

    if (op === 'sum') {
      bodyCode = this.generateSum(paramName, resultType);
    } else if (op === 'average') {
      bodyCode = this.generateAverage(paramName, resultType);
    } else if (op === 'max') {
      bodyCode = this.generateMax(paramName, resultType);
    } else if (op === 'min') {
      bodyCode = this.generateMin(paramName, resultType);
    } else if (op === 'count') {
      bodyCode = this.generateCount(paramName);
    } else if (op === 'reverse') {
      bodyCode = this.generateReverse(paramName, resultType);
    } else if (op === 'sort') {
      bodyCode = this.generateSort(paramName, resultType);
    } else if (op === 'filter') {
      bodyCode = this.generateFilter(paramName, resultType);
    } else if (op === 'map') {
      bodyCode = this.generateMap(paramName, resultType);
    } else {
      // 기본값: identity
      bodyCode = this.generateIdentity(paramName, resultType);
    }

    return `  ${bodyCode}\n}`;
  }

  // ============ 동작별 코드 생성 ============

  private generateSum(arrName: string, resultType: string): string {
    return `${resultType} result = 0;
  for (int i = 0; i < len; i++) result += ${arrName}[i];
  return result;`;
  }

  private generateAverage(arrName: string, resultType: string): string {
    return `if (len == 0) return 0;
  ${resultType} sum = 0;
  for (int i = 0; i < len; i++) sum += ${arrName}[i];
  return sum / len;`;
  }

  private generateMax(arrName: string, resultType: string): string {
    return `if (len == 0) return 0;
  ${resultType} max = ${arrName}[0];
  for (int i = 1; i < len; i++)
    if (${arrName}[i] > max) max = ${arrName}[i];
  return max;`;
  }

  private generateMin(arrName: string, resultType: string): string {
    return `if (len == 0) return 0;
  ${resultType} min = ${arrName}[0];
  for (int i = 1; i < len; i++)
    if (${arrName}[i] < min) min = ${arrName}[i];
  return min;`;
  }

  private generateCount(arrName: string): string {
    return `return len;`;
  }

  private generateReverse(arrName: string, resultType: string): string {
    return `for (int i = 0, j = len - 1; i < j; i++, j--) {
    ${resultType} tmp = ${arrName}[i];
    ${arrName}[i] = ${arrName}[j];
    ${arrName}[j] = tmp;
  }`;
  }

  private generateSort(arrName: string, resultType: string): string {
    return `// Simple bubble sort
  for (int i = 0; i < len - 1; i++)
    for (int j = 0; j < len - i - 1; j++)
      if (${arrName}[j] > ${arrName}[j + 1]) {
        ${resultType} tmp = ${arrName}[j];
        ${arrName}[j] = ${arrName}[j + 1];
        ${arrName}[j + 1] = tmp;
      }`;
  }

  private generateFilter(arrName: string, resultType: string): string {
    return `// Simple filter: keep all non-zero
  int j = 0;
  for (int i = 0; i < len; i++)
    if (${arrName}[i] != 0) ${arrName}[j++] = ${arrName}[i];`;
  }

  private generateMap(arrName: string, resultType: string): string {
    return `// Simple map: multiply by 2
  for (int i = 0; i < len; i++)
    ${arrName}[i] *= 2;`;
  }

  private generateIdentity(paramName: string, resultType: string): string {
    return `return ${paramName};`;
  }

  // ============ Helper Methods ============

  private mapType(freelangType: string): string {
    const base = freelangType.split('<')[0].toLowerCase();

    const typeMap: { [key: string]: string } = {
      number: 'double',
      int: 'int',
      int32: 'int32_t',
      int64: 'int64_t',
      float32: 'float',
      float64: 'double',
      string: 'char*',
      boolean: 'int',
      bool: 'int',
      array: 'double', // 배열 원소 타입
      result: 'void*',
      void: 'void',
    };

    return typeMap[base] || 'double';
  }

  private getParamName(freelangType: string): string {
    if (freelangType.startsWith('array<')) {
      return 'arr';
    }
    if (freelangType.includes('string')) {
      return 'str';
    }
    return 'val';
  }

  private usesString(proposal: HeaderProposal): boolean {
    return (
      proposal.input.includes('string') || proposal.output.includes('string')
    );
  }

  private usesStdlib(proposal: HeaderProposal): boolean {
    return proposal.matched_op === 'sort' || proposal.matched_op === 'filter';
  }

  private usesMath(proposal: HeaderProposal): boolean {
    return proposal.matched_op === 'average';
  }
}

// 싱글톤 인스턴스
export const cEmitter = new CEmitter();
