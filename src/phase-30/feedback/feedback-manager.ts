/**
 * Phase 30: Post-Launch Support - Feedback Manager
 * Collects, analyzes, and tracks user feedback
 */

export interface Feedback {
  id: string;
  userId: string;
  type: 'BUG_REPORT' | 'FEATURE_REQUEST' | 'IMPROVEMENT' | 'GENERAL';
  title: string;
  content: string;
  rating: number; // 1-5
  createdAt: Date;
  status: 'NEW' | 'ACKNOWLEDGED' | 'IN_REVIEW' | 'IMPLEMENTED' | 'REJECTED';
  tags: string[];
  response?: string;
  respondedAt?: Date;
  likes: number;
}

export interface FeedbackTrend {
  period: string;
  type: string;
  count: number;
  averageRating: number;
}

export interface FeedbackAnalysis {
  totalFeedback: number;
  averageRating: number;
  feedbackByType: Map<string, number>;
  feedbackByStatus: Map<string, number>;
  trends: FeedbackTrend[];
  topFeatureRequests: Feedback[];
  topBugReports: Feedback[];
}

export class FeedbackManager {
  private feedback: Map<string, Feedback> = new Map();
  private feedbackHistory: Feedback[] = [];
  private responseTargetDays: number = 7; // Target response time

  /**
   * Submit feedback
   */
  submitFeedback(
    userId: string,
    type: 'BUG_REPORT' | 'FEATURE_REQUEST' | 'IMPROVEMENT' | 'GENERAL',
    title: string,
    content: string,
    rating: number,
    tags?: string[]
  ): Feedback {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const fb: Feedback = {
      id: `feedback-${Date.now()}`,
      userId,
      type,
      title,
      content,
      rating,
      createdAt: new Date(),
      status: 'NEW',
      tags: tags || [],
      likes: 0,
    };

    this.feedback.set(fb.id, fb);
    this.feedbackHistory.push(fb);
    return fb;
  }

  /**
   * Respond to feedback
   */
  respondToFeedback(feedbackId: string, response: string, newStatus?: string): Feedback {
    const fb = this.feedback.get(feedbackId);
    if (!fb) {
      throw new Error('Feedback not found');
    }

    fb.response = response;
    fb.respondedAt = new Date();
    if (newStatus) {
      fb.status = newStatus as any;
    }

    return fb;
  }

  /**
   * Update feedback status
   */
  updateFeedbackStatus(
    feedbackId: string,
    status: 'NEW' | 'ACKNOWLEDGED' | 'IN_REVIEW' | 'IMPLEMENTED' | 'REJECTED'
  ): Feedback {
    const fb = this.feedback.get(feedbackId);
    if (!fb) {
      throw new Error('Feedback not found');
    }

    fb.status = status;
    return fb;
  }

  /**
   * Like a feedback entry
   */
  likeFeedback(feedbackId: string): Feedback {
    const fb = this.feedback.get(feedbackId);
    if (!fb) {
      throw new Error('Feedback not found');
    }

    fb.likes++;
    return fb;
  }

  /**
   * Get feedback by ID
   */
  getFeedback(feedbackId: string): Feedback | undefined {
    return this.feedback.get(feedbackId);
  }

  /**
   * Get feedback by type
   */
  getFeedbackByType(type: string): Feedback[] {
    return Array.from(this.feedback.values()).filter((f) => f.type === type);
  }

  /**
   * Get pending feedback (needs response)
   */
  getPendingFeedback(): Feedback[] {
    const now = new Date();
    return Array.from(this.feedback.values()).filter((f) => {
      if (f.status === 'NEW' || f.status === 'ACKNOWLEDGED') {
        return true;
      }
      if (f.respondedAt) {
        const daysSinceSubmission = (now.getTime() - f.createdAt.getTime()) / (24 * 60 * 60 * 1000);
        return daysSinceSubmission > this.responseTargetDays && !f.response;
      }
      return false;
    });
  }

  /**
   * Get most liked feedback
   */
  getMostLikedFeedback(limit: number = 10): Feedback[] {
    return Array.from(this.feedback.values())
      .sort((a, b) => b.likes - a.likes)
      .slice(0, limit);
  }

  /**
   * Get feedback analysis
   */
  analyzeFeedback(): FeedbackAnalysis {
    const feedbackArray = Array.from(this.feedback.values());
    const totalFeedback = feedbackArray.length;

    // Average rating
    const averageRating =
      totalFeedback > 0 ? feedbackArray.reduce((sum, f) => sum + f.rating, 0) / totalFeedback : 0;

    // Feedback by type
    const feedbackByType = new Map<string, number>();
    for (const fb of feedbackArray) {
      feedbackByType.set(fb.type, (feedbackByType.get(fb.type) || 0) + 1);
    }

    // Feedback by status
    const feedbackByStatus = new Map<string, number>();
    for (const fb of feedbackArray) {
      feedbackByStatus.set(fb.status, (feedbackByStatus.get(fb.status) || 0) + 1);
    }

    // Trends
    const trends: FeedbackTrend[] = [];
    for (const [type, count] of feedbackByType) {
      const typeForecasts = feedbackArray.filter((f) => f.type === type);
      const avgRating = typeForecasts.length > 0
        ? typeForecasts.reduce((sum, f) => sum + f.rating, 0) / typeForecasts.length
        : 0;
      trends.push({
        period: 'current',
        type,
        count,
        averageRating: Math.round(avgRating * 100) / 100,
      });
    }

    // Top feature requests and bug reports
    const topFeatureRequests = feedbackArray
      .filter((f) => f.type === 'FEATURE_REQUEST')
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 5);

    const topBugReports = feedbackArray
      .filter((f) => f.type === 'BUG_REPORT')
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 5);

    return {
      totalFeedback,
      averageRating: Math.round(averageRating * 100) / 100,
      feedbackByType,
      feedbackByStatus,
      trends,
      topFeatureRequests,
      topBugReports,
    };
  }

  /**
   * Get response rate (% of feedback with responses)
   */
  getResponseRate(): number {
    const total = this.feedback.size;
    if (total === 0) return 0;

    const responded = Array.from(this.feedback.values()).filter((f) => f.response).length;
    return (responded / total) * 100;
  }

  /**
   * Get average response time (in days)
   */
  getAverageResponseTime(): number {
    const responded = Array.from(this.feedback.values()).filter((f) => f.respondedAt && f.response);

    if (responded.length === 0) return 0;

    const totalTime = responded.reduce((sum, f) => {
      const time = (f.respondedAt!.getTime() - f.createdAt.getTime()) / (24 * 60 * 60 * 1000);
      return sum + time;
    }, 0);

    return Math.round((totalTime / responded.length) * 100) / 100;
  }

  /**
   * Get feedback statistics
   */
  getFeedbackStats(): {
    totalFeedback: number;
    averageRating: number;
    responseRate: number;
    averageResponseTime: number;
    satisfactionScore: number;
  } {
    const analysis = this.analyzeFeedback();
    const responseRate = this.getResponseRate();
    const avgResponseTime = this.getAverageResponseTime();

    // Satisfaction score: combines average rating and response rate
    const satisfactionScore = (analysis.averageRating / 5) * 50 + (responseRate / 100) * 50;

    return {
      totalFeedback: analysis.totalFeedback,
      averageRating: analysis.averageRating,
      responseRate: Math.round(responseRate * 100) / 100,
      averageResponseTime: avgResponseTime,
      satisfactionScore: Math.round(satisfactionScore * 100) / 100,
    };
  }

  /**
   * Export feedback as report
   */
  generateReport(): string {
    const analysis = this.analyzeFeedback();
    const stats = this.getFeedbackStats();

    let report = '# Feedback Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;

    report += '## Summary\n';
    report += `- Total Feedback: ${stats.totalFeedback}\n`;
    report += `- Average Rating: ${stats.averageRating}/5\n`;
    report += `- Response Rate: ${stats.responseRate}%\n`;
    report += `- Average Response Time: ${stats.averageResponseTime} days\n`;
    report += `- Satisfaction Score: ${stats.satisfactionScore}/100\n\n`;

    report += '## Feedback by Type\n';
    for (const [type, count] of analysis.feedbackByType) {
      report += `- ${type}: ${count}\n`;
    }

    report += '\n## Top Feature Requests\n';
    for (const fb of analysis.topFeatureRequests) {
      report += `- ${fb.title} (${fb.likes} likes)\n`;
    }

    report += '\n## Top Bug Reports\n';
    for (const fb of analysis.topBugReports) {
      report += `- ${fb.title} (${fb.likes} likes)\n`;
    }

    return report;
  }
}
