/**
 * Phase 14: Realtime Dashboard Server Entry Point
 *
 * SSE 기반 실시간 대시보드 서버 시작 스크립트
 * Usage: PORT=8000 node dist/phase-14/server-entry.js
 */

import { RealtimeDashboardServer } from '../dashboard/realtime-server';
import { Dashboard } from '../dashboard/dashboard';
import { patternUpdater } from '../learning/pattern-updater';
import { autoImprover } from '../learning/auto-improver';

/**
 * 서버 시작
 */
async function startServer() {
  const port = parseInt(process.env.PORT || '8000', 10);

  try {
    // Dashboard 인스턴스 생성
    const dashboard = new Dashboard(patternUpdater, autoImprover);

    // 실시간 대시보드 서버 생성
    const server = new RealtimeDashboardServer(port, dashboard, []);

    // 서버 시작
    await server.start();

    // 성공 메시지
    console.log('\n✅ Phase 14 Realtime Dashboard Server Started');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📌 Port: ${port}`);
    console.log(`🌐 HTTP:  http://localhost:${port}`);
    console.log(`📡 SSE:   http://localhost:${port}/api/realtime/stream`);
    console.log(`❤️ Health: http://localhost:${port}/health`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 Features:');
    console.log('   ✓ Real-time updates (SSE)');
    console.log('   ✓ Auto-reconnection');
    console.log('   ✓ Fallback to polling');
    console.log('   ✓ Chart.js integration');
    console.log('   ✓ Zero npm dependencies');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\n📍 Shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n\n📍 Shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// 서버 시작
startServer();
