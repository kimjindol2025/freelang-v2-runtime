/**
 * Phase 20 Week 3: A/B Testing API
 *
 * 엔드포인트:
 * POST /ab-tests/start/:action     - 테스트 시작
 * POST /ab-tests/end/:action       - 테스트 종료 및 리포트
 * POST /ab-tests/record            - 테스트 결과 기록
 * GET /ab-tests/reports            - 모든 테스트 리포트
 * GET /ab-tests/report/:action     - 특정 액션 리포트
 * GET /ab-tests/active             - 활성 테스트 조회
 */

import { Router, Request, Response } from 'express';
import { ABTestManager, TestResult, TestGroup } from '../monitoring/ab-test-manager';
import { HealingAction } from '../monitoring/self-healer';

export class ABTestAPI {
  router: Router;
  private abTestManager: ABTestManager;

  constructor(abTestManager: ABTestManager) {
    this.router = Router();
    this.abTestManager = abTestManager;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // 테스트 시작
    this.router.post('/ab-tests/start/:action', this.handleStartTest.bind(this));

    // 테스트 종료
    this.router.post('/ab-tests/end/:action', this.handleEndTest.bind(this));

    // 결과 기록
    this.router.post('/ab-tests/record', this.handleRecordResult.bind(this));

    // 모든 리포트
    this.router.get('/ab-tests/reports', this.handleGetReports.bind(this));

    // 특정 액션 리포트
    this.router.get('/ab-tests/report/:action', this.handleGetReport.bind(this));

    // 활성 테스트
    this.router.get('/ab-tests/active', this.handleGetActiveTests.bind(this));
  }

  /**
   * 테스트 시작
   */
  private handleStartTest(req: Request, res: Response): void {
    try {
      const action = req.params.action as HealingAction;

      if (!action) {
        res.status(400).json({ error: 'Action name required' });
        return;
      }

      this.abTestManager.startTest(action);

      res.json({
        success: true,
        message: `A/B test started for ${action}`,
        action
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  /**
   * 테스트 종료
   */
  private handleEndTest(req: Request, res: Response): void {
    try {
      const action = req.params.action as HealingAction;

      if (!action) {
        res.status(400).json({ error: 'Action name required' });
        return;
      }

      const report = this.abTestManager.endTest(action);

      if (!report) {
        res.status(404).json({ error: `No active test for ${action}` });
        return;
      }

      res.json({
        success: true,
        message: `A/B test completed for ${action}`,
        report
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  /**
   * 결과 기록
   */
  private handleRecordResult(req: Request, res: Response): void {
    try {
      const result = req.body as TestResult;

      if (!result || !result.action || !result.group || result.success === undefined) {
        res.status(400).json({ error: 'Missing required fields: action, group, success' });
        return;
      }

      // timestamp 추가
      if (!result.timestamp) {
        result.timestamp = Date.now();
      }

      this.abTestManager.recordResult(result);

      res.json({
        success: true,
        message: 'Test result recorded',
        result
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  /**
   * 모든 리포트
   */
  private handleGetReports(req: Request, res: Response): void {
    try {
      const reports = this.abTestManager.generateFullReport();

      res.json({
        success: true,
        count: reports.length,
        reports
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  /**
   * 특정 액션 리포트
   */
  private handleGetReport(req: Request, res: Response): void {
    try {
      const action = req.params.action as HealingAction;

      if (!action) {
        res.status(400).json({ error: 'Action name required' });
        return;
      }

      const report = this.abTestManager.generateReport(action);

      if (!report) {
        res.status(404).json({ error: `No data for action: ${action}` });
        return;
      }

      res.json({
        success: true,
        report
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  /**
   * 활성 테스트
   */
  private handleGetActiveTests(req: Request, res: Response): void {
    try {
      const activeTests = this.abTestManager.getActiveTests();

      res.json({
        success: true,
        count: activeTests.length,
        activeTests
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }
}

/**
 * 미들웨어 팩토리
 */
export function createABTestAPI(abTestManager: ABTestManager): Router {
  return new ABTestAPI(abTestManager).router;
}
