/**
 * Phase 20 Week 1: Metrics API
 *
 * 엔드포인트:
 * GET /metrics          - Prometheus 포맷
 * GET /metrics/json     - JSON 포맷
 * GET /metrics/report   - HTML 리포트
 */

import { Router, Request, Response } from 'express';
import { MetricsExporter } from '../monitoring/metrics-exporter';
import { HealthChecker } from '../monitoring/health-checker';
import { SelfHealer } from '../monitoring/self-healer';

export class MetricsAPI {
  router: Router;
  private exporter: MetricsExporter;

  constructor(healthChecker: HealthChecker, selfHealer: SelfHealer) {
    this.router = Router();
    this.exporter = new MetricsExporter(healthChecker, selfHealer);
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Prometheus 포맷
    this.router.get('/metrics', this.handlePrometheusMetrics.bind(this));

    // JSON 포맷
    this.router.get('/metrics/json', this.handleJsonMetrics.bind(this));

    // 텍스트 리포트
    this.router.get('/metrics/report', this.handleMetricsReport.bind(this));
  }

  /**
   * Prometheus 포맷 메트릭
   */
  private handlePrometheusMetrics(req: Request, res: Response): void {
    try {
      const prometheusText = this.exporter.toPrometheusFormat();
      res.type('text/plain; charset=utf-8').send(prometheusText);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  /**
   * JSON 포맷 메트릭
   */
  private handleJsonMetrics(req: Request, res: Response): void {
    try {
      const metrics = this.exporter.toJSON();
      res.json({
        success: true,
        metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  /**
   * 텍스트 리포트
   */
  private handleMetricsReport(req: Request, res: Response): void {
    try {
      const report = this.exporter.generateReport();
      res.type('text/plain; charset=utf-8').send(report);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }
}

/**
 * 미들웨어 팩토리
 */
export function createMetricsAPI(
  healthChecker: HealthChecker,
  selfHealer: SelfHealer
): Router {
  return new MetricsAPI(healthChecker, selfHealer).router;
}
