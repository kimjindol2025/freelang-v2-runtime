# Phase 12: Dashboard Integration Guide

## Overview

Phase 12 integrates **Phase 11's Dynamic Confidence System** into an interactive web dashboard for real-time monitoring and visualization of intent pattern confidence improvements.

### What is Phase 12?

Phase 12 provides a complete solution for:
- **Real-time Confidence Monitoring**: Visual overview of pattern confidence changes
- **Category-level Analysis**: Performance breakdown by pattern category
- **Top Improvements/Degradations**: Quick identification of learning progress
- **Trend Analysis**: 7-day historical trends with statistical data
- **Interactive Dashboard**: 60-second auto-refresh, responsive design, zero dependencies

### Architecture

```
Phase 8 Dashboard (base)
        ↓
Phase 11 ConfidenceReporter (analysis)
        ↓
Phase 12 Dashboard Extension (aggregation)
        ↓
Phase 9 HTTP Server (API)
        ↓
Web Browser (visualization)
```

---

## Installation & Setup

### 1. Prerequisites

- Node.js 18+
- npm 9+
- v2-freelang-ai project cloned
- Phase 11 and earlier phases completed

### 2. Start Dashboard Server

```bash
# Navigate to project directory
cd /path/to/v2-freelang-ai

# Build project (if needed)
npm run build

# Start dashboard server (uses Port Manager)
# Option 1: Direct port (testing)
PORT=8000 node dist/phase-12/dashboard-server.js

# Option 2: Port Manager auto-allocation (recommended)
curl -X POST http://localhost:45000/api/servers/start \
  -H "Content-Type: application/json" \
  -d '{
    "name": "freelang-dashboard",
    "command": "PORT={port} node dist/phase-12/dashboard-server.js",
    "reason": "Real-time dashboard for confidence monitoring",
    "duration": 4
  }'
```

### 3. Access Dashboard

```bash
# Open in browser
# Local: http://localhost:8000
# Or use allocated port from Port Manager response

# Health check
curl http://localhost:8000/health
# Response: {"status":"ok","timestamp":"...","version":"2.0.0-phase-12"}
```

---

## API Reference

All endpoints return JSON (except `/` which returns HTML).

### Core Statistics Endpoints (Phase 8)

#### `GET /api/dashboard/stats`
Overall pattern statistics.

```json
{
  "total_patterns": 50,
  "total_feedbacks": 150,
  "avg_confidence": 0.78,
  "avg_approval_rate": 0.82,
  "most_used_patterns": [
    {
      "id": "sum_array",
      "usage_count": 25,
      "confidence": 0.95
    }
  ],
  "patterns_needing_improvement": [
    {
      "id": "complex_pattern",
      "approval_rate": 0.45
    }
  ]
}
```

#### `GET /api/dashboard/trends?days=7`
Confidence trends over N days.

```json
[
  {
    "date": "2026-02-10",
    "pattern_id": "sum_array",
    "avg_confidence": 0.75,
    "usage_count": 20,
    "approval_rate": 0.85
  }
]
```

#### `GET /api/dashboard/feedback-summary?patternId=sum_array`
Feedback breakdown (approved, rejected, modified).

```json
{
  "total": 100,
  "approved": 82,
  "rejected": 12,
  "modified": 6,
  "approval_rate": 0.82,
  "by_pattern": {
    "sum_array": {
      "approved": 25,
      "rejected": 2,
      "modified": 1
    }
  }
}
```

#### `GET /api/dashboard/learning-progress`
Overall learning progress metrics.

```json
{
  "total_patterns": 50,
  "improved_patterns": 38,
  "progress_percentage": 76.0,
  "improvement_trends": [
    {
      "date": "2026-02-10",
      "improved_count": 5
    }
  ]
}
```

### Phase 12 Confidence Analysis Endpoints (NEW)

#### `GET /api/dashboard/confidence-report`
Complete Phase 11 confidence analysis report.

**Returns**: `ConfidenceReport | null` (null if no feedback)

```json
{
  "reportDate": "2026-02-16T10:30:00Z",
  "totalPatterns": 50,
  "patternsAdjusted": 45,
  "comparison": {
    "averageConfidenceBefore": 0.75,
    "averageConfidenceAfter": 0.82,
    "improvementsCount": 38,
    "degradationsCount": 7
  },
  "categoryReports": [
    {
      "categoryId": "arithmetic",
      "patternCount": 12,
      "avgBefore": 0.78,
      "avgAfter": 0.85,
      "improvementsCount": 10,
      "degradationsCount": 1
    }
  ],
  "topImprovements": [
    {
      "patternId": "factorial",
      "originalConfidence": 0.55,
      "adjustedConfidence": 0.82,
      "confidenceChange": 0.27
    }
  ],
  "topDegradations": [
    {
      "patternId": "edge_case_handler",
      "originalConfidence": 0.75,
      "adjustedConfidence": 0.62,
      "confidenceChange": -0.13
    }
  ],
  "summary": {
    "overallAvgChange": 0.07,
    "highConfidenceGain": 0.27,
    "trends": ["Improvements in mathematical operations", "Degradation in edge case handling"]
  }
}
```

#### `GET /api/dashboard/categories`
Category-level performance breakdown.

```json
[
  {
    "categoryId": "arithmetic",
    "patternCount": 12,
    "avgBefore": 0.78,
    "avgAfter": 0.85,
    "improvementsCount": 10,
    "degradationsCount": 1
  },
  {
    "categoryId": "string_ops",
    "patternCount": 8,
    "avgBefore": 0.72,
    "avgAfter": 0.79,
    "improvementsCount": 7,
    "degradationsCount": 1
  }
]
```

#### `GET /api/dashboard/top-movers?limit=10`
Top improving and degrading patterns.

```json
{
  "improvements": [
    {
      "patternId": "factorial",
      "originalConfidence": 0.55,
      "adjustedConfidence": 0.82,
      "confidenceChange": 0.27
    },
    {
      "patternId": "fibonacci",
      "originalConfidence": 0.60,
      "adjustedConfidence": 0.81,
      "confidenceChange": 0.21
    }
  ],
  "degradations": [
    {
      "patternId": "edge_case_handler",
      "originalConfidence": 0.75,
      "adjustedConfidence": 0.62,
      "confidenceChange": -0.13
    }
  ]
}
```

#### `GET /api/dashboard/confidence-trends?days=7`
Confidence trends with daily aggregates.

```json
[
  {
    "date": "2026-02-09",
    "avgConfidenceBefore": 0.74,
    "avgConfidenceAfter": 0.81,
    "improvedPatternCount": 36
  },
  {
    "date": "2026-02-10",
    "avgConfidenceBefore": 0.75,
    "avgConfidenceAfter": 0.82,
    "improvedPatternCount": 38
  }
]
```

#### `GET /api/dashboard/pattern/:id/confidence`
Single pattern confidence details.

```json
{
  "patternId": "sum_array",
  "originalConfidence": 0.70,
  "adjustedConfidence": 0.88,
  "confidenceChange": 0.18,
  "feedbackCount": 15,
  "approvalRate": 0.87
}
```

### Export Endpoints

#### `GET /api/dashboard/export/json`
Export all dashboard data as JSON.

#### `GET /api/dashboard/export/csv`
Export trends data as CSV.

```csv
Date,PatternID,AvgConfidence,UsageCount,ApprovalRate
2026-02-10,sum_array,0.88,25,0.95
2026-02-10,factorial,0.82,10,0.80
```

### System Endpoints

#### `GET /health`
Server health check.

```json
{
  "status": "ok",
  "timestamp": "2026-02-16T10:35:00Z",
  "version": "2.0.0-phase-12"
}
```

#### `GET /`
Serves dashboard HTML (browser access).

---

## Dashboard UI Guide

### Top Section: Main Stats Cards (Phase 8)
- **Total Patterns**: Number of unique intent patterns
- **Average Confidence**: Overall pattern confidence (0-100%)
- **Approval Rate**: Percentage of approved feedback
- **Total Feedback**: Cumulative user feedback count

### Learning Progress Section
- Progress bar showing percentage of improved patterns
- Daily improvement trends

### Most Used Patterns Table
- Ranked list of frequently matched patterns
- Usage count and confidence score for each

### Phase 12: Confidence Overview Cards (NEW)
- **Confidence Before**: Average before Phase 11 adjustment
- **Confidence After**: Average after adjustment
- **Improved Patterns**: Count of confidence gains
- **Degraded Patterns**: Count of confidence losses

### Phase 12: Category Performance Table (NEW)
| Column | Description |
|--------|-------------|
| Category | Pattern category name |
| Pattern Count | Number of patterns in category |
| Before | Average confidence before adjustment |
| After | Average confidence after adjustment |
| Change | Percentage change (green=up, red=down) |
| Status | Visual indicator (✓ improved, ⚠️ degraded, — unchanged) |

### Phase 12: Top Movers Section (NEW)
Two-column layout:
- **Left**: Top 10 improvements (with confidence deltas)
- **Right**: Top 10 degradations (with confidence deltas)

### Phase 12: Confidence Trends Table (NEW)
7-day historical view with:
- Date, before/after averages, number of improved patterns

### Phase 12: Confidence Histogram (NEW)
Visual bar chart comparing before/after confidence distribution across dates.

---

## Configuration

### Environment Variables

```bash
# Server port (default: 8000)
PORT=8000

# Refresh interval (milliseconds, default: 60000)
REFRESH_INTERVAL=60000

# Dashboard title
DASHBOARD_TITLE="FreeLang v2 - Learning Dashboard"
```

### Server Options

```typescript
// Manual server configuration
import { createDashboardServer } from './src/phase-12/dashboard-server';

const server = createDashboardServer(8000);
await server.start();
```

---

## Real-Time Updates

Dashboard automatically refreshes every **60 seconds** via polling.

To manually refresh:
1. Click "새로고침" (Refresh) button
2. Browser console: `refreshData()`

---

## Data Export

### JSON Export
Comprehensive snapshot of all dashboard data.

```bash
curl http://localhost:8000/api/dashboard/export/json > backup.json
```

### CSV Export
Trend data in tabular format for spreadsheet analysis.

```bash
curl http://localhost:8000/api/dashboard/export/csv > trends.csv
```

---

## Troubleshooting

### Dashboard shows "데이터 로딩 중..." (Loading)
**Cause**: Server not responding or no feedback data
**Solution**:
1. Check server is running: `curl http://localhost:8000/health`
2. Verify feedback collection is active
3. Check browser console for API errors

### Charts don't appear
**Cause**: No Phase 11 analysis data (no feedback collected)
**Solution**:
1. Collect user feedback on patterns first
2. Wait for Phase 11 analysis to complete
3. Dashboard will auto-populate when data available

### Port already in use
**Solution**: Use Port Manager or change port
```bash
PORT=8001 node dist/phase-12/dashboard-server.js
```

### API endpoints return 404
**Cause**: Dashboard server not running
**Solution**: Restart server with correct port

---

## Performance Characteristics

| Operation | Typical Time |
|-----------|--------------|
| Load stats | <50ms |
| Load trends | <100ms |
| Generate confidence report | <200ms |
| Full page load | <500ms |
| Category breakdown | <50ms |
| Top movers analysis | <100ms |

---

## Examples

### 1. Monitor Confidence Over Time
```bash
# Check baseline
curl http://localhost:8000/api/dashboard/stats

# Check after feedback collection
sleep 60
curl http://localhost:8000/api/dashboard/confidence-report
```

### 2. Export Weekly Report
```bash
curl http://localhost:8000/api/dashboard/export/json | \
  jq '.summary' > weekly_report.json
```

### 3. Find Patterns Needing Improvement
```bash
curl http://localhost:8000/api/dashboard/top-movers | \
  jq '.degradations | sort_by(.confidenceChange)'
```

### 4. Category Performance Analysis
```bash
curl http://localhost:8000/api/dashboard/categories | \
  jq '.[] | select(.avgAfter < .avgBefore)'
```

---

## Integration with Existing Systems

### Phase 8 Dashboard Compatibility
All Phase 8 endpoints continue working:
- `/api/dashboard/stats`
- `/api/dashboard/trends`
- `/api/dashboard/feedback-summary`
- `/api/dashboard/learning-progress`

### Phase 9 HTTP Server
Uses Phase 9's lightweight HTTPServer (zero external dependencies).

### Phase 11 Integration
Seamlessly integrates confidence analysis results:
- FeedbackAnalyzer for feedback processing
- DynamicConfidenceAdjuster for confidence adjustments
- ConfidenceReporter for comprehensive reports

---

## Next Steps

### Phase 13 (Planned)
- Advanced time-series visualizations
- Heatmaps for category×confidence analysis
- Stacked bar charts for adjustment factors

### Phase 14 (Optional)
- Real-time WebSocket updates (replace polling)
- Live pattern editing with immediate confidence updates
- Custom metric definitions

---

## Support & Documentation

- **Source**: `src/phase-12/dashboard-server.ts`
- **Tests**: `tests/phase-12-integration.test.ts`, `tests/phase-12-e2e.test.ts`
- **Web UI**: `public/dashboard.html`
- **API Routes**: `src/api/routes/dashboard.routes.ts`

---

## License

FreeLang v2 - AI-First Programming Language
© 2026 FreeLang Project
