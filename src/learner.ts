// FreeLang v2 - Pattern Learner
// Tracks what works, what fails. Pure data, no human interpretation.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AIIntent, PatternEntry, VMResult } from './types';
import { createHash } from 'crypto';

const DATA_DIR = join(process.env.HOME ?? '/tmp', '.freelang-ai');
const DB_FILE = join(DATA_DIR, 'patterns.json');

export class Learner {
  private patterns: Map<string, PatternEntry> = new Map();

  constructor() {
    this.load();
  }

  record(intent: AIIntent, result: VMResult): void {
    const key = this.key(intent);
    const existing = this.patterns.get(key);

    if (existing) {
      if (result.ok) existing.success_count++;
      else existing.fail_count++;
      existing.avg_cycles = (existing.avg_cycles * (existing.success_count + existing.fail_count - 1) + result.cycles) /
        (existing.success_count + existing.fail_count);
      existing.last_used = Date.now();
    } else {
      this.patterns.set(key, {
        fn: intent.fn,
        params_hash: this.hashParams(intent),
        body_hash: this.hashBody(intent),
        success_count: result.ok ? 1 : 0,
        fail_count: result.ok ? 0 : 1,
        avg_cycles: result.cycles,
        last_used: Date.now(),
      });
    }

    this.save();
  }

  // Success rate for a pattern
  successRate(intent: AIIntent): number {
    const entry = this.patterns.get(this.key(intent));
    if (!entry) return -1; // unknown
    const total = entry.success_count + entry.fail_count;
    return total > 0 ? entry.success_count / total : 0;
  }

  // Get all patterns sorted by success rate
  getPatterns(): PatternEntry[] {
    return [...this.patterns.values()].sort((a, b) => {
      const rateA = a.success_count / (a.success_count + a.fail_count || 1);
      const rateB = b.success_count / (b.success_count + b.fail_count || 1);
      return rateB - rateA;
    });
  }

  // Stats
  stats(): { total: number; successful: number; failed: number; avg_success_rate: number } {
    const entries = [...this.patterns.values()];
    const total = entries.length;
    const successful = entries.filter(e => e.success_count > e.fail_count).length;
    const failed = total - successful;
    const avg = total > 0
      ? entries.reduce((s, e) => s + e.success_count / (e.success_count + e.fail_count || 1), 0) / total
      : 0;
    return { total, successful, failed, avg_success_rate: avg };
  }

  private key(intent: AIIntent): string {
    return `${intent.fn}:${this.hashParams(intent)}`;
  }

  private hashParams(intent: AIIntent): string {
    const sig = intent.params.map(p => `${p.name}:${p.type}`).join(',');
    return createHash('md5').update(sig).digest('hex').slice(0, 8);
  }

  private hashBody(intent: AIIntent): string {
    const ops = intent.body.map(i => `${i.op}:${i.arg ?? ''}`).join(';');
    return createHash('md5').update(ops).digest('hex').slice(0, 8);
  }

  private load(): void {
    try {
      if (existsSync(DB_FILE)) {
        const data = JSON.parse(readFileSync(DB_FILE, 'utf-8'));
        for (const [k, v] of Object.entries(data)) {
          this.patterns.set(k, v as PatternEntry);
        }
      }
    } catch { /* fresh start */ }
  }

  private save(): void {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      const obj: Record<string, PatternEntry> = {};
      for (const [k, v] of this.patterns) obj[k] = v;
      writeFileSync(DB_FILE, JSON.stringify(obj, null, 0));
    } catch { /* ignore write failures */ }
  }
}
