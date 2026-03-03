/**
 * FreeLang Phase 13: HTTP Wrapper
 * Phase 9 HTTPClient를 FreeLang builtin과 호환되게 래핑
 */

import { HttpResponse, HttpOptions, HttpError } from '../types/http-types';
import { HTTPClient } from '../phase-9/http-server';

/**
 * HTTP 클라이언트 래퍼
 * Phase 9의 HTTPClient를 FreeLang builtin 시스템에 맞게 변환
 */
export class HttpWrapper {
  /**
   * GET 요청
   * @param url 요청 URL
   * @param options 옵션 (미사용, 향후 확장)
   * @returns HttpResponse { status_code, body, headers, elapsed_ms }
   */
  static async get(url: string, options?: HttpOptions): Promise<HttpResponse> {
    const startTime = Date.now();
    try {
      const response = await HTTPClient.get(url, options?.headers);
      return {
        status_code: response.statusCode,
        body: response.body,
        headers: response.headers || {},
        elapsed_ms: Date.now() - startTime,
      };
    } catch (error: any) {
      throw new HttpError(`HTTP GET failed: ${error.message}`, 0);
    }
  }

  /**
   * POST 요청
   * @param url 요청 URL
   * @param body 요청 본문
   * @param options 옵션
   * @returns HttpResponse { status_code, body, headers, elapsed_ms }
   */
  static async post(
    url: string,
    body: string,
    options?: HttpOptions
  ): Promise<HttpResponse> {
    const startTime = Date.now();
    try {
      const response = await HTTPClient.post(url, body, options?.headers);
      return {
        status_code: response.statusCode,
        body: response.body,
        headers: response.headers || {},
        elapsed_ms: Date.now() - startTime,
      };
    } catch (error: any) {
      throw new HttpError(`HTTP POST failed: ${error.message}`, 0);
    }
  }

  /**
   * PUT 요청
   * @param url 요청 URL
   * @param body 요청 본문
   * @param options 옵션
   * @returns HttpResponse { status_code, body, headers, elapsed_ms }
   */
  static async put(
    url: string,
    body: string,
    options?: HttpOptions
  ): Promise<HttpResponse> {
    const startTime = Date.now();
    try {
      const response = await HTTPClient.put(url, body, options?.headers);
      return {
        status_code: response.statusCode,
        body: response.body,
        headers: response.headers || {},
        elapsed_ms: Date.now() - startTime,
      };
    } catch (error: any) {
      throw new HttpError(`HTTP PUT failed: ${error.message}`, 0);
    }
  }

  /**
   * DELETE 요청
   * @param url 요청 URL
   * @param options 옵션
   * @returns HttpResponse { status_code, body, headers, elapsed_ms }
   */
  static async delete(
    url: string,
    options?: HttpOptions
  ): Promise<HttpResponse> {
    const startTime = Date.now();
    try {
      const response = await HTTPClient.delete(url, options?.headers);
      return {
        status_code: response.statusCode,
        body: response.body,
        headers: response.headers || {},
        elapsed_ms: Date.now() - startTime,
      };
    } catch (error: any) {
      throw new HttpError(`HTTP DELETE failed: ${error.message}`, 0);
    }
  }

  /**
   * PATCH 요청
   * @param url 요청 URL
   * @param body 요청 본문
   * @param options 옵션
   * @returns HttpResponse { status_code, body, headers, elapsed_ms }
   */
  static async patch(
    url: string,
    body: string,
    options?: HttpOptions
  ): Promise<HttpResponse> {
    const startTime = Date.now();
    try {
      // PATCH를 PUT으로 대체 (Phase 9에는 PATCH 없음)
      const response = await HTTPClient.put(url, body, options?.headers);
      return {
        status_code: response.statusCode,
        body: response.body,
        headers: response.headers || {},
        elapsed_ms: Date.now() - startTime,
      };
    } catch (error: any) {
      throw new HttpError(`HTTP PATCH failed: ${error.message}`, 0);
    }
  }

  /**
   * HEAD 요청 (헤더만, 본문 없음)
   * @param url 요청 URL
   * @param options 옵션
   * @returns HttpResponse { status_code, body: '', headers, elapsed_ms }
   */
  static async head(url: string, options?: HttpOptions): Promise<HttpResponse> {
    const startTime = Date.now();
    try {
      // HEAD 요청은 GET으로 대체하되, 반환시 body를 비움
      const response = await HTTPClient.get(url, options?.headers);
      return {
        status_code: response.statusCode,
        body: '',
        headers: response.headers || {},
        elapsed_ms: Date.now() - startTime,
      };
    } catch (error: any) {
      throw new HttpError(`HTTP HEAD failed: ${error.message}`, 0);
    }
  }

  /**
   * JSON GET 요청 (자동 파싱)
   * @param url 요청 URL
   * @returns 파싱된 JSON 객체
   */
  static async getJSON(url: string): Promise<any> {
    const response = await HttpWrapper.get(url);
    try {
      return JSON.parse(response.body);
    } catch (error: any) {
      throw new HttpError(
        `Failed to parse JSON: ${error.message}`,
        response.status_code,
        response
      );
    }
  }

  /**
   * JSON POST 요청 (자동 직렬화 및 파싱)
   * @param url 요청 URL
   * @param data 전송할 객체
   * @returns 파싱된 JSON 응답
   */
  static async postJSON(url: string, data: any): Promise<any> {
    const body = JSON.stringify(data);
    const response = await HttpWrapper.post(url, body, {
      headers: { 'Content-Type': 'application/json' },
    });
    try {
      return JSON.parse(response.body);
    } catch (error: any) {
      throw new HttpError(
        `Failed to parse JSON: ${error.message}`,
        response.status_code,
        response
      );
    }
  }

  /**
   * JSON PUT 요청 (자동 직렬화 및 파싱)
   * @param url 요청 URL
   * @param data 전송할 객체
   * @returns 파싱된 JSON 응답
   */
  static async putJSON(url: string, data: any): Promise<any> {
    const body = JSON.stringify(data);
    const response = await HttpWrapper.put(url, body, {
      headers: { 'Content-Type': 'application/json' },
    });
    try {
      return JSON.parse(response.body);
    } catch (error: any) {
      throw new HttpError(
        `Failed to parse JSON: ${error.message}`,
        response.status_code,
        response
      );
    }
  }
}
