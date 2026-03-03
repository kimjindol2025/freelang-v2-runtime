/**
 * ════════════════════════════════════════════════════════════════════
 * FreeLang Language Server (LSP 3.16)
 *
 * Standalone Language Server for FreeLang
 * ════════════════════════════════════════════════════════════════════
 */

import { HoverProvider } from './hover-provider';
import { CompletionProvider } from './completion-provider';
import { DefinitionProvider } from './definition-provider';
import { DiagnosticsEngine } from './diagnostics-engine';

/**
 * FreeLang Language Server
 */
export class FreeLangLanguageServer {
  private hoverProvider: HoverProvider;
  private completionProvider: CompletionProvider;
  private definitionProvider: DefinitionProvider;
  private diagnosticsEngine: DiagnosticsEngine;

  constructor() {
    // Initialize providers
    this.hoverProvider = new HoverProvider();
    this.completionProvider = new CompletionProvider();
    this.definitionProvider = new DefinitionProvider();
    this.diagnosticsEngine = new DiagnosticsEngine();

    console.log('FreeLang LSP Providers initialized');
  }

  /**
   * Get hover provider
   */
  getHoverProvider(): HoverProvider {
    return this.hoverProvider;
  }

  /**
   * Get completion provider
   */
  getCompletionProvider(): CompletionProvider {
    return this.completionProvider;
  }

  /**
   * Get definition provider
   */
  getDefinitionProvider(): DefinitionProvider {
    return this.definitionProvider;
  }

  /**
   * Get diagnostics engine
   */
  getDiagnosticsEngine(): DiagnosticsEngine {
    return this.diagnosticsEngine;
  }

  /**
   * Start the server
   */
  start(): void {
    console.log('FreeLang LSP Server started');
  }
}

/**
 * Main entry point
 */
if (require.main === module) {
  const server = new FreeLangLanguageServer();
  server.start();

  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down');
    process.exit(0);
  });
}
