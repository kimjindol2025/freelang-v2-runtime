/**
 * Phase 30: Post-Launch Support - Community Manager
 * Handles user community, issue tracking, and feedback management
 */

export interface CommunityUser {
  id: string;
  username: string;
  email: string;
  joinedAt: Date;
  contributionCount: number;
  reputation: number;
  role: 'user' | 'contributor' | 'maintainer';
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'DUPLICATE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  labels: string[];
  comments: Comment[];
  resolution?: string;
  assignedTo?: string;
}

export interface Comment {
  id: string;
  authorId: string;
  content: string;
  createdAt: Date;
  likes: number;
  resolved: boolean;
}

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
  views: number;
  helpful: number;
  notHelpful: number;
}

export interface CommunityMetrics {
  totalUsers: number;
  activeUsers: number;
  totalIssues: number;
  resolvedIssues: number;
  averageResolutionTime: number;
  communityHealth: number; // 0-100
  engagementScore: number;
}

export class CommunityManager {
  private users: Map<string, CommunityUser> = new Map();
  private issues: Map<string, Issue> = new Map();
  private faqEntries: Map<string, FaqEntry> = new Map();
  private issueHistory: Issue[] = [];

  /**
   * Register a new community user
   */
  registerUser(username: string, email: string): CommunityUser {
    const user: CommunityUser = {
      id: `user-${Date.now()}`,
      username,
      email,
      joinedAt: new Date(),
      contributionCount: 0,
      reputation: 0,
      role: 'user',
    };

    this.users.set(user.id, user);
    return user;
  }

  /**
   * Create an issue
   */
  createIssue(
    title: string,
    description: string,
    createdBy: string,
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM'
  ): Issue {
    const issue: Issue = {
      id: `issue-${Date.now()}`,
      title,
      description,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'OPEN',
      priority,
      labels: [],
      comments: [],
    };

    this.issues.set(issue.id, issue);
    this.issueHistory.push(issue);
    return issue;
  }

  /**
   * Add comment to issue
   */
  addComment(issueId: string, authorId: string, content: string): Comment {
    const issue = this.issues.get(issueId);
    if (!issue) {
      throw new Error('Issue not found');
    }

    const comment: Comment = {
      id: `comment-${Date.now()}`,
      authorId,
      content,
      createdAt: new Date(),
      likes: 0,
      resolved: false,
    };

    issue.comments.push(comment);
    issue.updatedAt = new Date();

    // Update user contribution
    const user = Array.from(this.users.values()).find((u) => u.id === authorId);
    if (user) {
      user.contributionCount++;
      user.reputation += 1;
    }

    return comment;
  }

  /**
   * Update issue status
   */
  updateIssueStatus(
    issueId: string,
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'DUPLICATE',
    resolution?: string
  ): Issue {
    const issue = this.issues.get(issueId);
    if (!issue) {
      throw new Error('Issue not found');
    }

    issue.status = status;
    issue.updatedAt = new Date();
    if (resolution) {
      issue.resolution = resolution;
    }

    return issue;
  }

  /**
   * Create FAQ entry from resolved issue
   */
  createFaqFromIssue(issueId: string): FaqEntry {
    const issue = this.issues.get(issueId);
    if (!issue || issue.status !== 'RESOLVED') {
      throw new Error('Issue must be resolved before creating FAQ entry');
    }

    const faq: FaqEntry = {
      id: `faq-${Date.now()}`,
      question: issue.title,
      answer: issue.resolution || issue.description,
      category: issue.labels[0] || 'General',
      createdAt: new Date(),
      updatedAt: new Date(),
      views: 0,
      helpful: 0,
      notHelpful: 0,
    };

    this.faqEntries.set(faq.id, faq);
    return faq;
  }

  /**
   * Get FAQ by category
   */
  getFaqByCategory(category: string): FaqEntry[] {
    return Array.from(this.faqEntries.values()).filter((f) => f.category === category);
  }

  /**
   * Mark FAQ as helpful
   */
  markFaqHelpful(faqId: string, helpful: boolean): FaqEntry {
    const faq = this.faqEntries.get(faqId);
    if (!faq) {
      throw new Error('FAQ entry not found');
    }

    if (helpful) {
      faq.helpful++;
    } else {
      faq.notHelpful++;
    }

    faq.updatedAt = new Date();
    return faq;
  }

  /**
   * Get community metrics
   */
  getCommunityMetrics(): CommunityMetrics {
    const totalUsers = this.users.size;
    const activeUsers = Array.from(this.users.values()).filter(
      (u) => Date.now() - u.joinedAt.getTime() < 30 * 24 * 60 * 60 * 1000
    ).length;

    const totalIssues = this.issues.size;
    const resolvedIssues = Array.from(this.issues.values()).filter((i) => i.status === 'RESOLVED'
      || i.status === 'CLOSED'
    ).length;

    const resolutionTimes = Array.from(this.issues.values())
      .filter((i) => i.status === 'RESOLVED')
      .map((i) => i.updatedAt.getTime() - i.createdAt.getTime());

    const averageResolutionTime = resolutionTimes.length > 0
      ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length / (24 * 60 * 60 * 1000)
      : 0;

    // Community health: 0-100 based on resolution rate and engagement
    const resolutionRate = totalIssues > 0 ? (resolvedIssues / totalIssues) * 100 : 0;
    const communityHealth = Math.min(100, resolutionRate + (activeUsers / Math.max(totalUsers, 1)) * 50);

    // Engagement score
    const totalComments = Array.from(this.issues.values()).reduce((sum, i) => sum + i.comments.length, 0);
    const engagementScore = totalUsers > 0 ? (totalComments / totalUsers) * 10 : 0;

    return {
      totalUsers,
      activeUsers,
      totalIssues,
      resolvedIssues,
      averageResolutionTime: Math.round(averageResolutionTime * 100) / 100,
      communityHealth: Math.round(communityHealth),
      engagementScore: Math.round(engagementScore * 100) / 100,
    };
  }

  /**
   * Get issue by ID
   */
  getIssue(issueId: string): Issue | undefined {
    return this.issues.get(issueId);
  }

  /**
   * Get open issues
   */
  getOpenIssues(priority?: string): Issue[] {
    return Array.from(this.issues.values()).filter(
      (i) => i.status === 'OPEN' && (!priority || i.priority === priority)
    );
  }

  /**
   * Get recent issues
   */
  getRecentIssues(limit: number = 10): Issue[] {
    return Array.from(this.issues.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get user by ID
   */
  getUser(userId: string): CommunityUser | undefined {
    return this.users.get(userId);
  }

  /**
   * Get top contributors
   */
  getTopContributors(limit: number = 10): CommunityUser[] {
    return Array.from(this.users.values())
      .sort((a, b) => b.reputation - a.reputation)
      .slice(0, limit);
  }

  /**
   * Get FAQ statistics
   */
  getFaqStats(): {
    totalEntries: number;
    categories: string[];
    mostViewed: FaqEntry | undefined;
    totalViews: number;
  } {
    const entries = Array.from(this.faqEntries.values());
    const categories = new Set(entries.map((f) => f.category));
    const mostViewed = entries.length > 0 ? entries.reduce((max, f) => (f.views > max.views ? f : max)) : undefined;
    const totalViews = entries.reduce((sum, f) => sum + f.views, 0);

    return {
      totalEntries: entries.length,
      categories: Array.from(categories),
      mostViewed,
      totalViews,
    };
  }
}
