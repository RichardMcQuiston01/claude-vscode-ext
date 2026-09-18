import '@testing-library/jest-dom/vitest';
import {cleanup} from '@testing-library/react';
import {afterEach} from 'vitest';

// Without `test.globals: true`, @testing-library/react's automatic
// afterEach(cleanup) never attaches, so renders from one test would still
// be in the document for the next. Do it explicitly instead.
afterEach(() => {
  cleanup();
});

interface VsCodeApiStub {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare global {
  function acquireVsCodeApi(): VsCodeApiStub;
}

// jsdom doesn't provide the VS Code webview API; stub it so importing
// src/vscode.ts (which calls this at module scope) doesn't throw in tests.
globalThis.acquireVsCodeApi = (): VsCodeApiStub => ({
  postMessage: () => {},
  getState: () => undefined,
  setState: () => {},
});
