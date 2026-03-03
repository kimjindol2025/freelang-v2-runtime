/**
 * Phase 15: Delta Encoder - 상태 변화 추출 엔진
 *
 * 목표: 추가 50% 대역폭 절감
 * - 이전 상태와 현재 상태의 diff 추출
 * - 변화된 필드만 전송
 * - 배열/객체 깊은 비교
 * - 성능 메트릭 추적
 */

/**
 * Delta (상태 변화)
 */
export interface Delta {
  timestamp: number;
  changes: Record<string, any>;  // 변화된 필드만
  removedKeys?: string[];         // 삭제된 필드
  type: 'partial' | 'full';      // partial = delta, full = 전체
  originalSize: number;          // 원본 크기
  deltaSize: number;             // Delta 크기
  compressionRatio: number;       // (original / delta)
}

/**
 * 상태 스냅샷
 */
export interface StateSnapshot {
  id: string;
  timestamp: number;
  data: Record<string, any>;
}

/**
 * Delta 통계
 */
export interface DeltaStats {
  totalSnapshots: number;
  totalDeltas: number;
  fullSnapshots: number;     // full state 전송
  partialDeltas: number;     // delta 전송
  totalOriginalSize: number;
  totalDeltaSize: number;
  totalCompressedSize: number; // delta 압축 후
  compressionRatio: number;  // (original / delta)
  bandwidthSaved: number;    // bytes
}

/**
 * Phase 15 Delta Encoder
 *
 * 특징:
 * - 깊은 객체 비교
 * - 배열 변화 추적 (요소 추가/제거/수정)
 * - 임계값 기반 전략 (delta > 70% 크기면 full snapshot 전송)
 * - 하이브리드 전략: 초기는 full, 이후는 delta
 * - 성능 메트릭 추적
 */
export class DeltaEncoder {
  private previousState: Record<string, StateSnapshot> = {};
  private fullSnapshotThreshold: number = 0.85; // delta > original * 85%이면 full 전송
  private minDeltaSize: number = 20; // 20 bytes 이상만 delta 추적

  // 통계
  private stats: DeltaStats = {
    totalSnapshots: 0,
    totalDeltas: 0,
    fullSnapshots: 0,
    partialDeltas: 0,
    totalOriginalSize: 0,
    totalDeltaSize: 0,
    totalCompressedSize: 0,
    compressionRatio: 1,
    bandwidthSaved: 0
  };

  /**
   * 상태 변화 추출
   * @param stateId - 상태 식별자
   * @param currentData - 현재 상태 데이터
   * @returns Delta 객체
   */
  computeDelta(stateId: string, currentData: Record<string, any>): Delta {
    const timestamp = Date.now();
    const originalSize = JSON.stringify(currentData).length;

    // 초기 상태 또는 previous state 없음 → full snapshot
    if (!this.previousState[stateId]) {
      this.previousState[stateId] = {
        id: stateId,
        timestamp,
        data: JSON.parse(JSON.stringify(currentData)) // deep copy
      };

      const delta: Delta = {
        timestamp,
        changes: currentData,
        type: 'full',
        originalSize,
        deltaSize: originalSize,
        compressionRatio: 1
      };

      this.recordDelta(delta, true);
      return delta;
    }

    // 이전 상태와 비교해서 변화된 필드만 추출
    const previousData = this.previousState[stateId].data;
    const changes: Record<string, any> = {};
    const removedKeys: string[] = [];

    // 현재 상태에서 변화된 필드 찾기
    for (const [key, value] of Object.entries(currentData)) {
      if (!this.deepEqual(previousData[key], value)) {
        changes[key] = value;
      }
    }

    // 삭제된 필드 찾기
    for (const key of Object.keys(previousData)) {
      if (!(key in currentData)) {
        removedKeys.push(key);
      }
    }

    // Delta 크기 계산
    const deltaPayload = { changes, removedKeys };
    const deltaSize = JSON.stringify(deltaPayload).length;

    // 결정: full snapshot vs delta
    // delta가 원본의 70% 이상이면 full snapshot 전송이 더 효율적
    const shouldSendFull = deltaSize > originalSize * this.fullSnapshotThreshold;

    if (shouldSendFull) {
      // Full snapshot 전송
      this.previousState[stateId] = {
        id: stateId,
        timestamp,
        data: JSON.parse(JSON.stringify(currentData))
      };

      const delta: Delta = {
        timestamp,
        changes: currentData,
        type: 'full',
        originalSize,
        deltaSize: originalSize,
        compressionRatio: 1
      };

      this.recordDelta(delta, true);
      return delta;
    } else {
      // Delta만 전송
      this.previousState[stateId] = {
        id: stateId,
        timestamp,
        data: JSON.parse(JSON.stringify(currentData))
      };

      const delta: Delta = {
        timestamp,
        changes,
        removedKeys: removedKeys.length > 0 ? removedKeys : undefined,
        type: 'partial',
        originalSize,
        deltaSize,
        compressionRatio: originalSize / deltaSize
      };

      this.recordDelta(delta, false);
      return delta;
    }
  }

  /**
   * 깊은 등가성 비교
   * @param a - 값 A
   * @param b - 값 B
   * @returns 같은지 여부
   */
  private deepEqual(a: any, b: any): boolean {
    // 기본 타입
    if (typeof a !== 'object' || typeof b !== 'object') {
      return a === b;
    }

    // null 확인
    if (a === null || b === null) {
      return a === b;
    }

    // 배열
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((val, idx) => this.deepEqual(val, b[idx]));
    }

    // 객체
    if (Array.isArray(a) !== Array.isArray(b)) {
      return false;
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) {
      return false;
    }

    return keysA.every(key => this.deepEqual(a[key], b[key]));
  }

  /**
   * Delta 기록
   */
  private recordDelta(delta: Delta, isFull: boolean): void {
    this.stats.totalSnapshots++;
    this.stats.totalOriginalSize += delta.originalSize;
    this.stats.totalDeltaSize += delta.deltaSize;

    if (isFull) {
      this.stats.fullSnapshots++;
    } else {
      this.stats.partialDeltas++;
      this.stats.totalDeltas++;
    }

    // 압축률 업데이트
    if (this.stats.totalDeltaSize > 0) {
      this.stats.compressionRatio = this.stats.totalOriginalSize / this.stats.totalDeltaSize;
      this.stats.bandwidthSaved = this.stats.totalOriginalSize - this.stats.totalDeltaSize;
    }
  }

  /**
   * Delta에서 full state 복원
   * @param previousData - 이전 상태
   * @param delta - Delta 객체
   * @returns 복원된 상태
   */
  applyDelta(previousData: Record<string, any>, delta: Delta): Record<string, any> {
    if (delta.type === 'full') {
      return JSON.parse(JSON.stringify(delta.changes));
    }

    // partial delta 적용
    const restored = JSON.parse(JSON.stringify(previousData));

    // 변화된 필드 적용
    for (const [key, value] of Object.entries(delta.changes)) {
      restored[key] = value;
    }

    // 삭제된 필드 제거
    if (delta.removedKeys) {
      for (const key of delta.removedKeys) {
        delete restored[key];
      }
    }

    return restored;
  }

  /**
   * 통계 조회
   */
  getStats(): DeltaStats {
    return { ...this.stats };
  }

  /**
   * 통계 리셋
   */
  resetStats(): void {
    this.stats = {
      totalSnapshots: 0,
      totalDeltas: 0,
      fullSnapshots: 0,
      partialDeltas: 0,
      totalOriginalSize: 0,
      totalDeltaSize: 0,
      totalCompressedSize: 0,
      compressionRatio: 1,
      bandwidthSaved: 0
    };
  }

  /**
   * 상태 초기화
   */
  clearState(stateId?: string): void {
    if (stateId) {
      delete this.previousState[stateId];
    } else {
      this.previousState = {};
    }
  }

  /**
   * 통계 요약
   */
  summarize(): string {
    const lines: string[] = [];
    lines.push('📊 Delta Encoder Statistics');
    lines.push(`Total Snapshots: ${this.stats.totalSnapshots}`);
    lines.push(`Full Snapshots: ${this.stats.fullSnapshots}`);
    lines.push(`Partial Deltas: ${this.stats.partialDeltas}`);
    lines.push(`Compression Ratio: ${this.stats.compressionRatio.toFixed(2)}x`);
    lines.push(`Bandwidth Saved: ${(this.stats.bandwidthSaved / 1024).toFixed(2)} KB`);

    const savingPercent = this.stats.totalOriginalSize > 0
      ? ((this.stats.bandwidthSaved / this.stats.totalOriginalSize) * 100).toFixed(1)
      : '0.0';
    lines.push(`Saving: ${savingPercent}%`);

    return lines.join('\n');
  }
}

/**
 * 헬퍼 함수: 두 상태의 diff 계산
 */
export function computeStateDiff(
  previousState: Record<string, any>,
  currentState: Record<string, any>
): Record<string, any> {
  const encoder = new DeltaEncoder();
  const delta = encoder.computeDelta('temp', currentState);

  if (delta.type === 'full') {
    return currentState;
  }

  return delta.changes;
}

/**
 * 헬퍼 함수: State 복원
 */
export function restoreState(
  previousState: Record<string, any>,
  delta: Delta
): Record<string, any> {
  const encoder = new DeltaEncoder();
  return encoder.applyDelta(previousState, delta);
}
