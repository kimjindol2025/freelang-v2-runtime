/**
 * Phase 26: The Gateway Part 1 (OAuth2) - Social Account Linker
 *
 * Manages the connection between social login (Google/GitHub) and FreeLang accounts
 *
 * Responsibilities:
 * 1. First login: Create FreeLang account automatically
 * 2. Subsequent logins: Recognize existing account
 * 3. Multiple links: One FreeLang user ↔ N social accounts
 * 4. Unlink: Remove social account link
 * 5. Account recovery: Use linked social account to recover access
 */

import { UserInfo, SocialAccount } from './types';

export interface FreeLangUser {
  id: string;
  username: string;
  email: string;
  name?: string;
  picture?: string;
  createdAt: Date;
  lastLoginAt: Date;
  socialAccounts: SocialAccount[];
  verified: boolean;
}

export interface AccountLinkingResult {
  user: FreeLangUser;
  isNewUser: boolean;
  linkedAccount: SocialAccount;
}

export class AccountLinker {
  // In production, replace with real database (PostgreSQL, MongoDB, etc.)
  private users: Map<string, FreeLangUser> = new Map();
  private emailIndex: Map<string, string> = new Map(); // email → user ID
  private providerIndex: Map<string, string> = new Map(); // provider:providerUserId → user ID

  // ============================================================================
  // Account Linking Flow
  // ============================================================================

  /**
   * Link social account to FreeLang user
   * If user doesn't exist, create new account
   * If user exists, add social account link
   */
  linkAccount(userInfo: UserInfo): AccountLinkingResult {
    const { provider, providerUserId, email } = userInfo;

    // Step 1: Check if social account already linked
    const existingUserId = this.getSocialAccountUserId(provider, providerUserId);
    if (existingUserId) {
      const user = this.users.get(existingUserId);
      if (user) {
        return {
          user: this.updateLastLogin(user),
          isNewUser: false,
          linkedAccount: user.socialAccounts.find(
            (a) => a.provider === provider && a.providerUserId === providerUserId
          )!,
        };
      }
    }

    // Step 2: Check if email already registered
    const userByEmail = email ? this.getUserByEmail(email) : null;

    if (userByEmail) {
      // User exists, add new social account link
      const socialAccount: SocialAccount = {
        provider,
        providerUserId,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        linkedAt: new Date(),
      };

      userByEmail.socialAccounts.push(socialAccount);
      this.registerProviderIndex(provider, providerUserId, userByEmail.id);
      const updatedUser = this.updateLastLogin(userByEmail);

      return {
        user: updatedUser,
        isNewUser: false,
        linkedAccount: socialAccount,
      };
    }

    // Step 3: Create new user account
    const newUser = this.createUser(userInfo);
    const socialAccount: SocialAccount = {
      provider,
      providerUserId,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      linkedAt: new Date(),
    };

    newUser.socialAccounts.push(socialAccount);
    this.users.set(newUser.id, newUser);

    // Register indices for fast lookup
    if (email) {
      this.emailIndex.set(email, newUser.id);
    }
    this.registerProviderIndex(provider, providerUserId, newUser.id);

    return {
      user: newUser,
      isNewUser: true,
      linkedAccount: socialAccount,
    };
  }

  // ============================================================================
  // Lookups
  // ============================================================================

  /**
   * Get user by email address
   */
  private getUserByEmail(email: string): FreeLangUser | null {
    const userId = this.emailIndex.get(email.toLowerCase());
    return userId ? this.users.get(userId) || null : null;
  }

  /**
   * Get user by social account (provider + ID)
   */
  private getSocialAccountUserId(provider: string, providerUserId: string): string | null {
    return this.providerIndex.get(`${provider}:${providerUserId}`) || null;
  }

  /**
   * Get user by FreeLang user ID
   */
  getUser(userId: string): FreeLangUser | null {
    return this.users.get(userId) || null;
  }

  // ============================================================================
  // Unlink Social Account
  // ============================================================================

  /**
   * Unlink social account from FreeLang user
   * User can have multiple social accounts; this removes one
   */
  unlinkAccount(userId: string, provider: string): FreeLangUser | null {
    const user = this.users.get(userId);
    if (!user) return null;

    // Find account to unlink
    const accountIndex = user.socialAccounts.findIndex((a) => a.provider === provider);
    if (accountIndex === -1) return user; // Already unlinked

    const unlinkedAccount = user.socialAccounts[accountIndex];

    // Remove from social accounts list
    user.socialAccounts.splice(accountIndex, 1);

    // Remove from provider index
    this.providerIndex.delete(`${provider}:${unlinkedAccount.providerUserId}`);

    return user;
  }

  // ============================================================================
  // Account Recovery
  // ============================================================================

  /**
   * Recover account using linked social account
   * If user loses email but has Google/GitHub link, they can recover via social login
   */
  recoverAccount(userInfo: UserInfo): FreeLangUser | null {
    const { provider, providerUserId } = userInfo;

    // Check if social account exists
    const userId = this.getSocialAccountUserId(provider, providerUserId);
    if (!userId) return null;

    const user = this.users.get(userId);
    if (!user) return null;

    // Update user info from latest social login
    if (userInfo.email) user.email = userInfo.email;
    if (userInfo.name) user.name = userInfo.name;
    if (userInfo.picture) user.picture = userInfo.picture;

    // Update last login
    user.lastLoginAt = new Date();

    return user;
  }

  // ============================================================================
  // Account Management
  // ============================================================================

  /**
   * Merge two accounts (user A has multiple social accounts)
   * Useful when user initially signs up with Google, then links GitHub
   */
  mergeAccounts(primaryUserId: string, secondaryUserId: string): FreeLangUser | null {
    const primary = this.users.get(primaryUserId);
    const secondary = this.users.get(secondaryUserId);

    if (!primary || !secondary) return null;

    // Move all social accounts from secondary to primary
    secondary.socialAccounts.forEach((account) => {
      primary.socialAccounts.push(account);
      this.registerProviderIndex(account.provider, account.providerUserId, primaryUserId);
    });

    // Delete secondary user
    this.users.delete(secondaryUserId);
    if (secondary.email) {
      this.emailIndex.delete(secondary.email.toLowerCase());
    }

    return primary;
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Create new FreeLang user
   */
  private createUser(userInfo: UserInfo): FreeLangUser {
    const id = this.generateUserId();

    return {
      id,
      username: this.generateUsername(userInfo.name || userInfo.sub),
      email: userInfo.email || `${userInfo.provider}:${userInfo.sub}@freelang.internal`,
      name: userInfo.name,
      picture: userInfo.picture,
      createdAt: new Date(),
      lastLoginAt: new Date(),
      socialAccounts: [],
      verified: !!userInfo.email_verified,
    };
  }

  /**
   * Update last login timestamp
   */
  private updateLastLogin(user: FreeLangUser): FreeLangUser {
    user.lastLoginAt = new Date();
    return user;
  }

  /**
   * Register provider lookup index
   */
  private registerProviderIndex(
    provider: string,
    providerUserId: string,
    userId: string
  ): void {
    this.providerIndex.set(`${provider}:${providerUserId}`, userId);
  }

  /**
   * Generate unique user ID
   */
  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Generate unique username from name or email
   */
  private generateUsername(base: string): string {
    // Sanitize: lowercase, remove special chars, max 32 chars
    let username = base
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .substring(0, 32);

    // Ensure unique
    let attempt = 0;
    const original = username;
    while (
      Array.from(this.users.values()).some((u) => u.username === username) &&
      attempt < 100
    ) {
      username = `${original}_${++attempt}`;
    }

    return username || `user_${Math.random().toString(36).substring(2, 9)}`;
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get account statistics
   */
  getStats() {
    const users = Array.from(this.users.values());

    return {
      totalUsers: users.length,
      googleLinked: users.filter((u) => u.socialAccounts.some((a) => a.provider === 'google'))
        .length,
      githubLinked: users.filter((u) => u.socialAccounts.some((a) => a.provider === 'github'))
        .length,
      multiLinked: users.filter((u) => u.socialAccounts.length > 1).length,
      verified: users.filter((u) => u.verified).length,
    };
  }
}
