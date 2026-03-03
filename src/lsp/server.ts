/**
 * ════════════════════════════════════════════════════════════════════
 * FreeLang LSP Server - Protocol Layer
 *
 * Implements LSP 3.16 protocol handlers
 * Connects FreeLang providers to LSP protocol
 * ════════════════════════════════════════════════════════════════════
 */

import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  ServerCapabilities,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  DidChangeTextDocumentParams,
  DidOpenTextDocumentParams,
  DidCloseTextDocumentParams
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { FreeLangLanguageServer } from './language-server';

/**
 * Create LSP connection with stdio transport
 */
const connection = createConnection(ProposedFeatures.all);

/**
 * Document management
 */
const documents = new TextDocuments(TextDocument);

/**
 * FreeLang language server instance
 */
const server = new FreeLangLanguageServer();

/**
 * Track open documents for diagnostics
 */
const openDocuments = new Map<string, TextDocument>();

/**
 * Initialization handler
 */
connection.onInitialize((params: InitializeParams): InitializeResult => {
  console.log('FreeLang LSP Server initializing...');

  const capabilities: ServerCapabilities = {
    textDocumentSync: TextDocumentSyncKind.Full,
    hoverProvider: true,
    completionProvider: {
      triggerCharacters: ['.', ':'],
      resolveProvider: false
    },
    definitionProvider: true,
    diagnosticProvider: {
      interFileDependencies: false,
      workspaceDiagnostics: false
    }
  };

  return {
    capabilities,
    serverInfo: {
      name: 'FreeLang Language Server',
      version: '0.1.0'
    }
  };
});

/**
 * Hover provider
 */
connection.onHover((params: TextDocumentPositionParams) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    console.warn(`Document not found: ${params.textDocument.uri}`);
    return null;
  }

  try {
    const hover = server.getHoverProvider().provideHover(
      document,
      params.position.line,
      params.position.character
    );
    return hover;
  } catch (error) {
    console.error('Error in hover provider:', error);
    return null;
  }
});

/**
 * Completion provider
 */
connection.onCompletion((params: TextDocumentPositionParams) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    console.warn(`Document not found: ${params.textDocument.uri}`);
    return [];
  }

  try {
    const completions = server.getCompletionProvider().provideCompletions(
      document,
      params.position
    );
    return completions;
  } catch (error) {
    console.error('Error in completion provider:', error);
    return [];
  }
});

/**
 * Definition provider
 */
connection.onDefinition((params: TextDocumentPositionParams) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    console.warn(`Document not found: ${params.textDocument.uri}`);
    return null;
  }

  try {
    const definition = server.getDefinitionProvider().findDefinition(
      document,
      params.position
    );
    return definition;
  } catch (error) {
    console.error('Error in definition provider:', error);
    return null;
  }
});

/**
 * Document open handler
 */
connection.onDidOpenTextDocument((params: DidOpenTextDocumentParams) => {
  const { textDocument } = params;
  console.log(`Document opened: ${textDocument.uri}`);

  const doc = documents.get(textDocument.uri);
  if (doc) {
    openDocuments.set(textDocument.uri, doc);
    sendDiagnostics(doc);
  }
});

/**
 * Document change handler - trigger diagnostics
 */
connection.onDidChangeTextDocument((params: DidChangeTextDocumentParams) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return;

  // Debounce diagnostics (simplified - in production, use proper debouncing)
  sendDiagnostics(document);
});

/**
 * Document close handler
 */
connection.onDidCloseTextDocument((params: DidCloseTextDocumentParams) => {
  const { textDocument } = params;
  console.log(`Document closed: ${textDocument.uri}`);

  openDocuments.delete(textDocument.uri);
  // Clear diagnostics for closed document
  connection.sendDiagnostics({
    uri: textDocument.uri,
    diagnostics: []
  });
});

/**
 * Send diagnostics for a document
 */
function sendDiagnostics(document: TextDocument): void {
  try {
    const diagnostics = server.getDiagnosticsEngine().validate(document);

    connection.sendDiagnostics({
      uri: document.uri,
      diagnostics: diagnostics || []
    });
  } catch (error) {
    console.error('Error generating diagnostics:', error);
  }
}

/**
 * Document manager
 */
documents.listen(connection);

/**
 * Listen for incoming LSP messages
 */
connection.listen();

console.log('FreeLang LSP Server listening on stdio...');
