/**
 * Phase 12: Worker Thread Script
 *
 * 워커 스레드에서 실행되는 스크립트
 * - 부모 스레드로부터 메시지 수신
 * - 작업 실행
 * - 결과를 부모 스레드에 반환
 */

import { parentPort } from 'worker_threads';

/**
 * 메시지 형식
 */
interface WorkerMessage {
  id: string;
  type: 'EXECUTE' | 'TERMINATE';
  data?: any;
}

/**
 * 응답 형식
 */
interface WorkerResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * 워커 메인 루프
 */
if (parentPort) {
  parentPort.on('message', async (message: WorkerMessage) => {
    try {
      if (message.type === 'TERMINATE') {
        process.exit(0);
      }

      if (message.type === 'EXECUTE') {
        // 작업 실행
        const result = await executeTask(message.data);

        const response: WorkerResponse = {
          id: message.id,
          success: true,
          data: result,
        };

        parentPort!.postMessage(response);
      }
    } catch (error) {
      const response: WorkerResponse = {
        id: message.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };

      parentPort!.postMessage(response);
    }
  });
}

/**
 * 작업 실행 (간단한 버전)
 * Phase 12.4에서 FreeLang IR 실행으로 확장됨
 */
async function executeTask(data: any): Promise<any> {
  // 현재: 데이터 에코 (테스트용)
  // Phase 12.4: FreeLang IR 실행

  if (data && typeof data === 'object') {
    // CPU 바운드 작업 시뮬레이션
    if (data.type === 'fibonacci') {
      return fibonacci(data.n);
    } else if (data.type === 'sum_array') {
      return sumArray(data.array);
    }
  }

  return data;
}

/**
 * 피보나치 (CPU 바운드 테스트)
 */
function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

/**
 * 배열 합계 (I/O 없는 CPU 작업)
 */
function sumArray(array: number[]): number {
  let sum = 0;
  for (const val of array) {
    sum += val;
  }
  return sum;
}
