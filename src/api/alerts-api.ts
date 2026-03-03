/**
 * Phase 20 Week 2: Alerts API
 *
 * 엔드포인트:
 * POST /alerts/process           - 건강 체크 결과 처리
 * GET /alerts/records            - 알림 기록 조회
 * GET /alerts/stats              - 알림 통계
 * POST /alerts/config/update     - 설정 업데이트
 */

import { Router, Request, Response } from 'express';
import { AlertManager, AlertConfig } from '../monitoring/alert-manager';
import { HealthCheckResult } from '../monitoring/health-checker';

export class AlertsAPI {
  router: Router;
  private alertManager: AlertManager;

  constructor(alertManager: AlertManager) {
    this.router = Router();
    this.alertManager = alertManager;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // 알림 처리
    this.router.post('/alerts/process', this.handleProcessAlerts.bind(this));

    // 알림 기록
    this.router.get('/alerts/records', this.handleGetRecords.bind(this));

    // 알림 통계
    this.router.get('/alerts/stats', this.handleGetStats.bind(this));

    // 설정 업데이트
    this.router.post('/alerts/config/update', this.handleUpdateConfig.bind(this));
  }

  /**
   * 건강 체크 결과 처리
   */
  private async handleProcessAlerts(req: Request, res: Response): Promise<void> {
    try {
      const result = req.body as HealthCheckResult;

      if (!result || !result.alerts) {
        res.status(400).json({ error: 'Invalid request body' });
        return;
      }

      const records = await this.alertManager.processHealthCheck(result);

      res.json({
        success: true,
        alertsProcessed: records.length,
        records
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  /**
   * 알림 기록 조회
   */
  private handleGetRecords(req: Request, res: Response): void {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const records = this.alertManager.getRecords(limit);

      res.json({
        success: true,
        count: records.length,
        records
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  /**
   * 알림 통계
   */
  private handleGetStats(req: Request, res: Response): void {
    try {
      const stats = this.alertManager.getStats();

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  /**
   * 설정 업데이트
   */
  private handleUpdateConfig(req: Request, res: Response): void {
    try {
      const config = req.body as Partial<AlertConfig>;

      if (!config) {
        res.status(400).json({ error: 'Invalid config' });
        return;
      }

      this.alertManager.updateConfig(config);

      res.json({
        success: true,
        message: 'Alert configuration updated'
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }
}

/**
 * 미들웨어 팩토리
 */
export function createAlertsAPI(alertManager: AlertManager): Router {
  return new AlertsAPI(alertManager).router;
}
