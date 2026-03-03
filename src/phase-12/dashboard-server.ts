/**
 * Phase 12: Dashboard Server
 *
 * HTTP Server (Phase 9) + Dashboard (Phase 8) + Phase 11 Integration
 * Real-time web dashboard for confidence monitoring
 */

import { HTTPServer } from '../phase-9/http-server';
import { dashboard } from '../dashboard/dashboard';
import * as dashboardRoutes from '../api/routes/dashboard.routes';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Create and configure dashboard server
 */
export function createDashboardServer(port: number = 8000): HTTPServer {
  const server = new HTTPServer(port);

  // Serve static dashboard HTML
  server.route('/', () => {
    try {
      const htmlPath = path.join(process.cwd(), 'public', 'dashboard.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: html,
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to load dashboard' }),
      };
    }
  });

  // Phase 8 Dashboard API endpoints
  server.route('/api/dashboard/stats', () => {
    try {
      const stats = dashboardRoutes.dashboardRoutes.getStats();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stats),
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: String(error) }),
      };
    }
  });

  server.route('/api/dashboard/trends', () => {
    try {
      const trends = dashboardRoutes.dashboardRoutes.getTrends(7);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trends),
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: String(error) }),
      };
    }
  });

  server.route('/api/dashboard/feedback-summary', () => {
    try {
      const summary = dashboardRoutes.dashboardRoutes.getFeedbackSummary();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(summary),
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: String(error) }),
      };
    }
  });

  server.route('/api/dashboard/learning-progress', () => {
    try {
      const progress = dashboardRoutes.dashboardRoutes.getLearningProgress();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(progress),
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: String(error) }),
      };
    }
  });

  // Phase 12: Phase 11 Integration endpoints
  server.route('/api/dashboard/confidence-report', () => {
    try {
      const report = dashboardRoutes.dashboardRoutes.getConfidenceReport();
      if (!report) {
        return {
          statusCode: 202,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'No feedback collected yet' }),
        };
      }
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: String(error) }),
      };
    }
  });

  server.route('/api/dashboard/categories', () => {
    try {
      const categories = dashboardRoutes.dashboardRoutes.getCategoryBreakdown();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categories),
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: String(error) }),
      };
    }
  });

  server.route('/api/dashboard/top-movers', () => {
    try {
      const movers = dashboardRoutes.dashboardRoutes.getTopMovers(10);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(movers),
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: String(error) }),
      };
    }
  });

  server.route('/api/dashboard/confidence-trends', () => {
    try {
      const trends = dashboardRoutes.dashboardRoutes.getConfidenceTrends(7);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trends),
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: String(error) }),
      };
    }
  });

  // Export endpoints
  server.route('/api/dashboard/export/json', (): any => {
    try {
      const data = dashboardRoutes.dashboardRoutes.exportJSON();
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="dashboard.json"',
        },
        body: JSON.stringify(data, null, 2),
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: String(error) }),
      };
    }
  });

  server.route('/api/dashboard/export/csv', (): any => {
    try {
      const csv = dashboardRoutes.dashboardRoutes.exportCSV();
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="trends.csv"',
        },
        body: csv,
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'text/plain' },
        body: String(error),
      };
    }
  });

  // Health check
  server.route('/health', () => {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '2.0.0-phase-12',
      }),
    };
  });

  // 404 handler (optional - can be added to HTTPServer)
  server.route('/api/dashboard/*', () => {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Endpoint not found' }),
    };
  });

  return server;
}

/**
 * Start dashboard server
 */
export async function startDashboardServer(port: number = 8000): Promise<void> {
  const server = createDashboardServer(port);

  try {
    await server.start();
    console.log(`✅ Dashboard server running on http://localhost:${port}`);
    console.log(`   HTML: http://localhost:${port}/`);
    console.log(`   API: http://localhost:${port}/api/dashboard/*`);
    console.log(`   Health: http://localhost:${port}/health`);
  } catch (error) {
    console.error('❌ Failed to start dashboard server:', error);
    throw error;
  }
}

// Main entry point
if (require.main === module) {
  const port = parseInt(process.env.PORT || '8000', 10);
  startDashboardServer(port).catch(console.error);
}

export { HTTPServer };
