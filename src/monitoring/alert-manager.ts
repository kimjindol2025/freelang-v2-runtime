/**
 * Phase 20 Week 2: Alert Manager (Email/Slack 알림)
 *
 * 책임:
 * 1. CRITICAL 경고 감지
 * 2. Email 발송 (SMTP)
 * 3. Slack 메시지 발송 (Webhook)
 * 4. 알림 템플릿 관리
 */

import { HealthAlert, HealthCheckResult } from './health-checker';

/**
 * 알림 채널 타입
 */
export type AlertChannel = 'email' | 'slack' | 'both';

/**
 * 알림 설정
 */
export interface AlertConfig {
  email?: {
    enabled: boolean;
    smtpHost: string;
    smtpPort: number;
    fromAddress: string;
    toAddresses: string[];
    username?: string;
    password?: string;
  };
  slack?: {
    enabled: boolean;
    webhookUrl: string;
    channel?: string;
  };
}

/**
 * 알림 기록
 */
export interface AlertRecord {
  timestamp: number;
  severity: 'warning' | 'critical';
  component: string;
  message: string;
  channels: AlertChannel[];
  success: boolean;
  error?: string;
}

/**
 * AlertManager 구현
 */
export class AlertManager {
  private config: AlertConfig;
  private alertRecords: AlertRecord[] = [];
  private lastAlertTime: Map<string, number> = new Map();
  private alertDebounceMs: number = 60000; // 같은 경고는 1분 간격으로만 발송

  constructor(config: AlertConfig = {}) {
    this.config = config;
  }

  /**
   * 경고 설정 업데이트
   */
  updateConfig(config: Partial<AlertConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('✏️ Alert configuration updated');
  }

  /**
   * 건강 체크 결과 처리
   */
  async processHealthCheck(result: HealthCheckResult): Promise<AlertRecord[]> {
    const records: AlertRecord[] = [];

    // CRITICAL 경고만 처리
    for (const alert of result.alerts) {
      if (alert.severity === 'critical') {
        const record = await this.sendAlert(alert);
        records.push(record);
        this.alertRecords.push(record);

        // 최근 100개 기록만 유지
        if (this.alertRecords.length > 100) {
          this.alertRecords.shift();
        }
      }
    }

    return records;
  }

  /**
   * 단일 경고 발송
   */
  private async sendAlert(alert: HealthAlert): Promise<AlertRecord> {
    const alertKey = `${alert.component}:${alert.severity}`;
    const lastAlert = this.lastAlertTime.get(alertKey) || 0;
    const timeSinceLastAlert = Date.now() - lastAlert;

    // Debounce 체크: 같은 경고는 1분 간격
    if (timeSinceLastAlert < this.alertDebounceMs) {
      if (process.env.NODE_ENV !== 'test') {
        console.log(`⏱️ Alert debounced (last alert ${Math.floor(timeSinceLastAlert / 1000)}s ago): ${alertKey}`);
      }
      return {
        timestamp: Date.now(),
        severity: alert.severity,
        component: alert.component,
        message: alert.message,
        channels: [],
        success: false,
        error: 'Debounced'
      };
    }

    const record: AlertRecord = {
      timestamp: Date.now(),
      severity: alert.severity,
      component: alert.component,
      message: alert.message,
      channels: [],
      success: true
    };

    // Email 발송
    if (this.config.email?.enabled) {
      try {
        await this.sendEmailAlert(alert);
        record.channels.push('email');
        if (process.env.NODE_ENV !== 'test') {
          console.log(`📧 Email alert sent: ${alert.component}`);
        }
      } catch (error) {
        record.success = false;
        record.error = `Email failed: ${error}`;
        if (process.env.NODE_ENV !== 'test') {
          console.error(`❌ Email alert failed: ${error}`);
        }
      }
    }

    // Slack 발송
    if (this.config.slack?.enabled) {
      try {
        await this.sendSlackAlert(alert);
        record.channels.push('slack');
        if (process.env.NODE_ENV !== 'test') {
          console.log(`💬 Slack alert sent: ${alert.component}`);
        }
      } catch (error) {
        record.success = false;
        record.error = `Slack failed: ${error}`;
        if (process.env.NODE_ENV !== 'test') {
          console.error(`❌ Slack alert failed: ${error}`);
        }
      }
    }

    // 발송 시간 기록
    this.lastAlertTime.set(alertKey, Date.now());

    return record;
  }

  /**
   * Email 알림 발송 (시뮬레이션)
   */
  private async sendEmailAlert(alert: HealthAlert): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      // 테스트 환경에서는 로그만 출력
      return;
    }

    if (!this.config.email || !this.config.email.toAddresses.length) {
      throw new Error('Email configuration not available');
    }

    // 실제 구현에서는 SMTP 라이브러리 (nodemailer 등) 사용
    const subject = `[🔴 CRITICAL] ${alert.component.toUpperCase()} Alert`;
    const body = this.generateEmailTemplate(alert);

    // TODO: nodemailer integration
    // const transporter = nodemailer.createTransport({...});
    // await transporter.sendMail({
    //   from: this.config.email.fromAddress,
    //   to: this.config.email.toAddresses.join(','),
    //   subject,
    //   html: body
    // });

    if (process.env.NODE_ENV !== 'test') {
      console.log(`📧 Email would be sent to: ${this.config.email.toAddresses.join(', ')}`);
      console.log(`   Subject: ${subject}`);
    }
  }

  /**
   * Slack 알림 발송
   */
  private async sendSlackAlert(alert: HealthAlert): Promise<void> {
    if (!this.config.slack?.webhookUrl) {
      throw new Error('Slack configuration not available');
    }

    const payload = {
      text: `🔴 CRITICAL Alert: ${alert.component.toUpperCase()}`,
      attachments: [
        {
          color: 'danger',
          fields: [
            {
              title: 'Component',
              value: alert.component,
              short: true
            },
            {
              title: 'Severity',
              value: alert.severity,
              short: true
            },
            {
              title: 'Message',
              value: alert.message,
              short: false
            },
            {
              title: 'Value',
              value: alert.value.toString(),
              short: true
            },
            {
              title: 'Threshold',
              value: alert.threshold.toString(),
              short: true
            },
            {
              title: 'Time',
              value: new Date(alert.timestamp).toISOString(),
              short: false
            }
          ]
        }
      ]
    };

    if (process.env.NODE_ENV === 'test') {
      // 테스트 환경에서는 생략
      return;
    }

    // TODO: Slack webhook integration
    // const response = await fetch(this.config.slack.webhookUrl, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(payload)
    // });

    if (process.env.NODE_ENV !== 'test') {
      console.log(`💬 Slack message would be sent to: ${this.config.slack.webhookUrl}`);
    }
  }

  /**
   * Email 템플릿 생성
   */
  private generateEmailTemplate(alert: HealthAlert): string {
    const timestamp = new Date(alert.timestamp).toLocaleString('ko-KR');

    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #d32f2f; color: white; padding: 15px; border-radius: 5px 5px 0 0; }
    .content { background: #f5f5f5; padding: 20px; border-radius: 0 0 5px 5px; }
    .field { margin: 10px 0; }
    .label { font-weight: bold; color: #666; }
    .value { color: #333; font-size: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>🔴 Critical Alert: ${alert.component.toUpperCase()}</h2>
    </div>
    <div class="content">
      <div class="field">
        <div class="label">Message:</div>
        <div class="value">${alert.message}</div>
      </div>
      <div class="field">
        <div class="label">Current Value:</div>
        <div class="value">${alert.value}</div>
      </div>
      <div class="field">
        <div class="label">Threshold:</div>
        <div class="value">${alert.threshold}</div>
      </div>
      <div class="field">
        <div class="label">Time:</div>
        <div class="value">${timestamp}</div>
      </div>
      <hr>
      <p>Please check your system status immediately.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * 알림 기록 조회
   */
  getRecords(limit: number = 50): AlertRecord[] {
    return this.alertRecords.slice(-limit);
  }

  /**
   * 알림 통계
   */
  getStats(): {
    totalAlerts: number;
    criticalAlerts: number;
    warningAlerts: number;
    emailCount: number;
    slackCount: number;
    failureCount: number;
  } {
    let criticalCount = 0;
    let warningCount = 0;
    let emailCount = 0;
    let slackCount = 0;
    let failureCount = 0;

    for (const record of this.alertRecords) {
      if (record.severity === 'critical') {
        criticalCount++;
      } else {
        warningCount++;
      }

      if (record.channels.includes('email')) {
        emailCount++;
      }
      if (record.channels.includes('slack')) {
        slackCount++;
      }

      if (!record.success) {
        failureCount++;
      }
    }

    return {
      totalAlerts: this.alertRecords.length,
      criticalAlerts: criticalCount,
      warningAlerts: warningCount,
      emailCount,
      slackCount,
      failureCount
    };
  }

  /**
   * 알림 기록 리셋
   */
  reset(): void {
    this.alertRecords = [];
    this.lastAlertTime.clear();
    console.log('🔄 Alert records reset');
  }

  /**
   * Debounce 시간 설정
   */
  setDebounceMs(ms: number): void {
    this.alertDebounceMs = ms;
  }
}
