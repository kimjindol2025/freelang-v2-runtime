/**
 * Phase 20 Week 4: Benchmarking API
 *
 * 엔드포인트:
 * POST /benchmarks/run            - 벤치마크 실행
 * GET /benchmarks/latest          - 최신 벤치마크 결과
 * GET /benchmarks/results         - 벤치마크 히스토리
 * GET /benchmarks/compare         - 현재 vs Baseline 비교
 * POST /benchmarks/set-baseline   - Baseline 설정
 * GET /benchmarks/baseline        - Baseline 조회
 * GET /benchmarks/trend           - 성능 트렌드
 * GET /benchmarks/average         - 평균 성능
 */

import { Router, Request, Response } from 'express';
import { BenchmarkRunner } from '../monitoring/benchmark-runner';

export class BenchmarkAPI {
  router: Router;
  private benchmarkRunner: BenchmarkRunner;

  constructor(benchmarkRunner: BenchmarkRunner) {
    this.router = Router();
    this.benchmarkRunner = benchmarkRunner;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // 벤치마크 실행
    this.router.post('/benchmarks/run', this.handleRunBenchmark.bind(this));

    // 최신 결과
    this.router.get('/benchmarks/latest', this.handleGetLatest.bind(this));

    // 히스토리
    this.router.get('/benchmarks/results', this.handleGetResults.bind(this));

    // 비교
    this.router.get('/benchmarks/compare', this.handleCompare.bind(this));

    // Baseline 설정
    this.router.post('/benchmarks/set-baseline', this.handleSetBaseline.bind(this));

    // Baseline 조회
    this.router.get('/benchmarks/baseline', this.handleGetBaseline.bind(this));

    // 트렌드
    this.router.get('/benchmarks/trend', this.handleGetTrend.bind(this));

    // 평균 성능
    this.router.get('/benchmarks/average', this.handleGetAverage.bind(this));
  }

  /**
   * 벤치마크 실행
   */
  private async handleRunBenchmark(req: Request, res: Response): Promise<void> {
    try {
      const { duration = 30, rps = 1000 } = req.body;

      const metrics = await this.benchmarkRunner.runBenchmark(duration, rps);

      res.json({
        success: true,
        message: 'Benchmark completed',
        metrics
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  /**
   * 최신 결과
   */
  private handleGetLatest(req: Request, res: Response): void {
    try {
      const results = this.benchmarkRunner.getResults(1);

      if (results.length === 0) {
        res.status(404).json({ error: 'No benchmark results available' });
        return;
      }

      res.json({
        success: true,
        metrics: results[0]
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  /**
   * 히스토리
   */
  private handleGetResults(req: Request, res: Response): void {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const results = this.benchmarkRunner.getResults(limit);

      res.json({
        success: true,
        count: results.length,
        results
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  /**
   * 비교
   */
  private handleCompare(req: Request, res: Response): void {
    try {
      const comparison = this.benchmarkRunner.compareWithBaseline();

      if (!comparison) {
        res.status(404).json({ error: 'No baseline set or insufficient data' });
        return;
      }

      res.json({
        success: true,
        comparison
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  /**
   * Baseline 설정
   */
  private handleSetBaseline(req: Request, res: Response): void {
    try {
      const { metrics } = req.body;

      if (!metrics) {
        res.status(400).json({ error: 'Metrics required' });
        return;
      }

      this.benchmarkRunner.setBaseline(metrics);

      res.json({
        success: true,
        message: 'Baseline set'
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  /**
   * Baseline 조회
   */
  private handleGetBaseline(req: Request, res: Response): void {
    try {
      const baseline = this.benchmarkRunner.getBaseline();

      if (!baseline) {
        res.status(404).json({ error: 'No baseline set' });
        return;
      }

      res.json({
        success: true,
        baseline
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  /**
   * 트렌드
   */
  private handleGetTrend(req: Request, res: Response): void {
    try {
      const count = parseInt(req.query.count as string) || 10;
      const trend = this.benchmarkRunner.analyzeTrend(count);

      res.json({
        success: true,
        trend
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }

  /**
   * 평균 성능
   */
  private handleGetAverage(req: Request, res: Response): void {
    try {
      const count = parseInt(req.query.count as string) || 5;
      const average = this.benchmarkRunner.getAveragePerformance(count);

      if (!average) {
        res.status(404).json({ error: 'No benchmark data available' });
        return;
      }

      res.json({
        success: true,
        average
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }
}

/**
 * 미들웨어 팩토리
 */
export function createBenchmarkAPI(benchmarkRunner: BenchmarkRunner): Router {
  return new BenchmarkAPI(benchmarkRunner).router;
}
