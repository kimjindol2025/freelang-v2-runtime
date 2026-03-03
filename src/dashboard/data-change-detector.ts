/**
 * Phase 14: Data Change Detection
 *
 * 효율적인 데이터 변화 감지
 * - O(1) 빠른 해시 기반 비교
 * - 세부 필드별 선택적 감지
 * - 메모리 효율적 저장
 */

import crypto from 'crypto';

export interface ChangeDetectionResult {
  hasChanged: boolean;
  changedFields: string[];
  timestamp: number;
}

/**
 * 데이터 변화 감지 엔진
 */
export class DataChangeDetector {
  private lastHash: Map<string, string> = new Map(); // 필드별 해시
  private lastFullHash: string = ''; // 전체 데이터 해시

  /**
   * 전체 데이터 변화 감지
   */
  detectChanges(currentData: any): ChangeDetectionResult {
    const changedFields: string[] = [];
    const currentFullHash = this.hashObject(currentData);

    // 전체 해시가 다르면 자세히 검사
    if (currentFullHash !== this.lastFullHash) {
      for (const [key, value] of Object.entries(currentData)) {
        const fieldHash = this.hashObject(value);
        const prevHash = this.lastHash.get(key) || '';

        if (fieldHash !== prevHash) {
          changedFields.push(key);
          this.lastHash.set(key, fieldHash);
        }
      }

      this.lastFullHash = currentFullHash;

      return {
        hasChanged: true,
        changedFields,
        timestamp: Date.now()
      };
    }

    return {
      hasChanged: false,
      changedFields: [],
      timestamp: Date.now()
    };
  }

  /**
   * 특정 필드만 감지 (성능 최적화)
   */
  detectFieldChanges(fieldName: string, newValue: any): boolean {
    const newHash = this.hashObject(newValue);
    const prevHash = this.lastHash.get(fieldName) || '';

    if (newHash !== prevHash) {
      this.lastHash.set(fieldName, newHash);
      this.lastFullHash = ''; // 전체 재계산 필요 표시
      return true;
    }

    return false;
  }

  /**
   * 임계값 기반 감지 (수치 필드)
   */
  detectNumericChange(fieldName: string, newValue: number, threshold: number = 0.01): boolean {
    const prevValue = this.lastNumericValue(fieldName);

    if (prevValue === null) {
      // 첫 값 저장
      this.lastHash.set(fieldName, newValue.toString());
      return true;
    }

    const change = Math.abs(newValue - prevValue);
    const hasChanged = change > threshold;

    // 변경되면 새 값 저장
    if (hasChanged) {
      this.lastHash.set(fieldName, newValue.toString());
    }

    return hasChanged;
  }

  /**
   * 배열 길이 변화 감지 (빠른 검사)
   */
  detectArrayLengthChange(fieldName: string, newArray: any[]): boolean {
    const arrayHash = `${fieldName}:${newArray.length}`;
    const prevHash = this.lastHash.get(`${fieldName}:length`) || '';

    if (arrayHash !== prevHash) {
      this.lastHash.set(`${fieldName}:length`, arrayHash);
      return true;
    }

    return false;
  }

  /**
   * 객체 깊은 비교 (선택적)
   */
  detectDeepChange(fieldName: string, oldValue: any, newValue: any): boolean {
    return JSON.stringify(oldValue) !== JSON.stringify(newValue);
  }

  /**
   * 해시 생성 (O(1) 비교 성능)
   */
  private hashObject(obj: any): string {
    try {
      const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
      return crypto
        .createHash('md5')
        .update(str)
        .digest('hex')
        .substring(0, 8); // 8자 해시로 충분
    } catch (error) {
      console.error('Hash error:', error);
      return '';
    }
  }

  /**
   * 이전 숫자값 조회
   */
  private lastNumericValue(fieldName: string): number | null {
    const hash = this.lastHash.get(fieldName);
    return hash ? parseFloat(hash) : null;
  }

  /**
   * 상태 리셋
   */
  reset(): void {
    this.lastHash.clear();
    this.lastFullHash = '';
  }

  /**
   * 통계 정보
   */
  getStats(): object {
    return {
      tracked_fields: this.lastHash.size,
      last_full_hash: this.lastFullHash.substring(0, 8),
      memory_bytes: this.lastHash.size * 50 // 대략적 메모리
    };
  }
}

export default DataChangeDetector;
