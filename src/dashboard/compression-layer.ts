/**
 * Phase 15: Compression Layer - SSE 메시지 압축
 *
 * 목표: 초기 메시지 30-40% 압축 + 배치 메시지 압축
 * - gzip 압축/해제
 * - Content-Encoding 헤더 관리
 * - 성능 메트릭 추적
 * - 압축 vs 비압축 최적화
 */

import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * 압축 통계
 */
export interface CompressionStats {
  totalMessages: number;
  compressedMessages: number;
  uncompressedMessages: number;
  totalOriginalSize: number;
  totalCompressedSize: number;
  compressionRatio: number; // (original / compressed)
  averageCompressionTime: number; // ms
  bandwidthSaved: number; // bytes
}

/**
 * 압축된 메시지
 */
export interface CompressedMessage {
  original: string;
  compressed: Buffer;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  compressionTime: number; // ms
}

/**
 * Phase 15 압축 레이어
 *
 * 특징:
 * - gzip 압축 (Node.js 표준)
 * - 임계값 기반 압축 (payload > 200 bytes)
 * - 압축 오버헤드 추적
 * - Content-Encoding 헤더 자동 설정
 * - 비동기 압축/해제
 */
export class CompressionLayer {
  private compressionThreshold: number = 200; // bytes
  private compressionLevel: number = 6; // 0-9, 6 = default
  private enableCompression: boolean = true;

  // 통계
  private stats: CompressionStats = {
    totalMessages: 0,
    compressedMessages: 0,
    uncompressedMessages: 0,
    totalOriginalSize: 0,
    totalCompressedSize: 0,
    compressionRatio: 1,
    averageCompressionTime: 0,
    bandwidthSaved: 0
  };

  private compressionTimes: number[] = [];
  private readonly maxCompressionTimeHistory = 100;

  constructor(
    compressionThreshold: number = 200,
    compressionLevel: number = 6,
    enableCompression: boolean = true
  ) {
    this.compressionThreshold = compressionThreshold;
    this.compressionLevel = compressionLevel;
    this.enableCompression = enableCompression;
  }

  /**
   * 메시지 압축 (조건부)
   * - 크기 > threshold일 때만 압축
   * - 압축률 > 50%일 때만 적용
   */
  async compress(message: string): Promise<CompressedMessage | null> {
    this.stats.totalMessages++;

    // 압축 비활성화 또는 크기 미만
    if (!this.enableCompression || message.length < this.compressionThreshold) {
      this.stats.uncompressedMessages++;
      this.stats.totalOriginalSize += message.length;
      return null;
    }

    try {
      const startTime = performance.now();

      // gzip 압축
      const originalBuffer = Buffer.from(message, 'utf-8');
      const compressedBuffer = await gzip(originalBuffer, {
        level: this.compressionLevel
      });

      const compressionTime = performance.now() - startTime;
      const compressionRatio = originalBuffer.length / compressedBuffer.length;

      // 압축 효율성 검사: 50% 이상 압축되지 않으면 압축 미사용
      if (compressionRatio < 1.5) {
        this.stats.uncompressedMessages++;
        this.stats.totalOriginalSize += originalBuffer.length;
        return null;
      }

      // 압축 성공
      this.stats.compressedMessages++;
      this.stats.totalOriginalSize += originalBuffer.length;
      this.stats.totalCompressedSize += compressedBuffer.length;
      this.stats.bandwidthSaved += originalBuffer.length - compressedBuffer.length;

      // 압축 시간 추적
      this.compressionTimes.push(compressionTime);
      if (this.compressionTimes.length > this.maxCompressionTimeHistory) {
        this.compressionTimes.shift();
      }
      this.stats.averageCompressionTime =
        this.compressionTimes.reduce((a, b) => a + b, 0) / this.compressionTimes.length;

      // 압축률 업데이트
      if (this.stats.totalCompressedSize > 0) {
        this.stats.compressionRatio =
          this.stats.totalOriginalSize / this.stats.totalCompressedSize;
      }

      return {
        original: message,
        compressed: compressedBuffer,
        originalSize: originalBuffer.length,
        compressedSize: compressedBuffer.length,
        compressionRatio,
        compressionTime
      };
    } catch (error) {
      console.error('Compression error:', error);
      // 압축 실패시 원본 반환
      this.stats.uncompressedMessages++;
      this.stats.totalOriginalSize += message.length;
      return null;
    }
  }

  /**
   * 메시지 해제
   */
  async decompress(buffer: Buffer): Promise<string> {
    try {
      const decompressedBuffer = await gunzip(buffer);
      return decompressedBuffer.toString('utf-8');
    } catch (error) {
      console.error('Decompression error:', error);
      throw error;
    }
  }

  /**
   * SSE 메시지 포맷으로 압축된 데이터 인코딩
   * Content-Encoding 헤더와 함께 전송
   */
  encodeCompressedSSE(originalMessage: string): {
    event: string;
    data: string;
    encoding: string;
    headers: { [key: string]: string };
  } | null {
    // 압축 가능 여부 판단
    if (!this.enableCompression || originalMessage.length < this.compressionThreshold) {
      return null; // 압축 불필요
    }

    // 실제 압축은 비동기로 처리해야 하므로 여기서는 인코딩만 반환
    return {
      event: 'message',
      data: `<compressed>${originalMessage.substring(0, 50)}...</compressed>`,
      encoding: 'gzip',
      headers: {
        'Content-Encoding': 'gzip',
        'Vary': 'Accept-Encoding'
      }
    };
  }

  /**
   * 통계 조회
   */
  getStats(): CompressionStats {
    return { ...this.stats };
  }

  /**
   * 통계 초기화
   */
  resetStats(): void {
    this.stats = {
      totalMessages: 0,
      compressedMessages: 0,
      uncompressedMessages: 0,
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      compressionRatio: 1,
      averageCompressionTime: 0,
      bandwidthSaved: 0
    };
    this.compressionTimes = [];
  }

  /**
   * 압축 활성화/비활성화
   */
  setCompressionEnabled(enabled: boolean): void {
    this.enableCompression = enabled;
  }

  /**
   * 압축 임계값 설정
   */
  setCompressionThreshold(threshold: number): void {
    this.compressionThreshold = threshold;
  }

  /**
   * 압축 레벨 설정 (0-9)
   */
  setCompressionLevel(level: number): void {
    if (level < 0 || level > 9) {
      throw new Error('Compression level must be between 0 and 9');
    }
    this.compressionLevel = level;
  }

  /**
   * 디버그 정보
   */
  getDebugInfo(): object {
    return {
      enabled: this.enableCompression,
      threshold: this.compressionThreshold,
      level: this.compressionLevel,
      stats: this.getStats(),
      recentCompressionTimes: this.compressionTimes.slice(-10)
    };
  }

  /**
   * 요약 정보
   */
  getSummary(): string {
    const stats = this.getStats();
    const percentage = stats.totalOriginalSize > 0
      ? ((stats.bandwidthSaved / stats.totalOriginalSize) * 100).toFixed(1)
      : '0';

    return [
      `Compression Summary:`,
      `  Total messages: ${stats.totalMessages}`,
      `  Compressed: ${stats.compressedMessages} | Uncompressed: ${stats.uncompressedMessages}`,
      `  Original size: ${(stats.totalOriginalSize / 1024).toFixed(1)}KB`,
      `  Compressed size: ${(stats.totalCompressedSize / 1024).toFixed(1)}KB`,
      `  Compression ratio: ${stats.compressionRatio.toFixed(2)}x`,
      `  Bandwidth saved: ${(stats.bandwidthSaved / 1024).toFixed(1)}KB (${percentage}%)`,
      `  Avg compression time: ${stats.averageCompressionTime.toFixed(2)}ms`
    ].join('\n');
  }
}
