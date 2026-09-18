import type {ExtensionContext, Uri, Webview, WebviewPanel} from 'vscode';
import {loadSettingsSchema, type JsonSchema} from './schemaProvider.js';
import {
  readSettingsFile,
  resolveSettingsFileUri,
  writeSettingsFile,
  type SettingsTarget,
} from './settingsFile.js';

type JsonObject = Record<string, unknown>;

/**
 * Messages sent from the webview to the extension host.
 *
 * Mirrored (not imported) in `webview-ui/src/App.tsx`: the extension host
 * and webview-ui are separate TypeScript projects with their own tsconfigs,
 * so sharing this literal type isn't worth the cross-project build wiring
 * yet. Keep the two in sync by hand; revisit if the protocol grows.
 */
export type WebviewToHostMessage =
  | {type: 'ready'}
  | {type: 'selectTarget'; target: SettingsTarget}
  | {type: 'save'; target: SettingsTarget; values: JsonObject};

/** Messages sent from the extension host to the webview. See above. */
export type HostToWebviewMessage =
  | {
      type: 'loadSettings';
      schema: JsonSchema;
      target: SettingsTarget;
      availableTargets: SettingsTarget[];
      values: JsonObject;
      warning?: string;
    }
  | {type: 'loadError'; message: string}
  | {type: 'saveResult'; target: SettingsTarget; ok: true}
  | {type: 'saveResult'; target: SettingsTarget; ok: false; error: string};

const ALL_TARGETS: SettingsTarget[] = [
  'workspaceSettings',
  'workspaceLocalSettings',
  'userSettings',
];

const VIEW_TYPE = 'claudeSettingsBuilder.panel';
const PANEL_TITLE = 'Claude Settings Builder';
const WEBVIEW_DIST_PATH = ['dist', 'webview'];

let currentPanel: WebviewPanel | undefined;
// Cached for the life of one panel session so switching targets doesn't
// re-fetch (or re-read the bundled fallback for) the schema every time;
// cleared when the panel is disposed so a fresh session gets a fresh copy.
let cachedSchemaResult: {schema: JsonSchema; warning?: string} | undefined;
// The target the webview is currently viewing (or last asked to view),
// tracked purely so the "Refresh Schema" command has something to reload
// after invalidating the cache above.
let currentTarget: SettingsTarget | undefined;

/**
 * Rewrites the built webview-ui `index.html` so its relative asset
 * references (produced by Vite's `base: './'` config) resolve inside the
 * webview sandbox, and adds a CSP that only allows loading from the
 * webview's own resource root. Pure string manipulation with no VS Code
 * API dependency, so it's directly unit-testable; see `getWebviewHtml` for
 * the real integration that reads the file and supplies
 * `cspSource`/`baseUri`.
 */
export function injectWebviewAssets(
  html: string,
  options: {cspSource: string; baseUri: string},
): string {
  const csp = [
    "default-src 'none'",
    `img-src ${options.cspSource} data:`,
    `style-src ${options.cspSource} 'unsafe-inline'`,
    `script-src ${options.cspSource}`,
  ].join('; ');

  return html
    .replace(
      '<head>',
      `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}">`,
    )
    .replace(/(src|href)="\.\//g, `$1="${options.baseUri}/`);
}

async function getWebviewHtml(
  webview: Webview,
  webviewRoot: Uri,
): Promise<string> {
  const vscode = await import('vscode');
  const indexUri = vscode.Uri.joinPath(webviewRoot, 'index.html');
  let html: string;
  try {
    const bytes = await vscode.workspace.fs.readFile(indexUri);
    html = Buffer.from(bytes).toString('utf8');
  } catch (error) {
    throw new Error(
      `Failed to read webview bundle at ${indexUri.fsPath}: ${
        error instanceof Error ? error.message : String(error)
      }. Did you run "npm run build"?`,
    );
  }
  return injectWebviewAssets(html, {
    cspSource: webview.cspSource,
    baseUri: webview.asWebviewUri(webviewRoot).toString(),
  });
}

async function getWorkspaceFolderUri(): Promise<Uri | undefined> {
  const vscode = await import('vscode');
  return vscode.workspace.workspaceFolders?.[0]?.uri;
}

/**
 * The two workspace-scoped targets need an open workspace folder;
 * `userSettings` never does. Reflecting that here (rather than always
 * offering all three and failing on save) is what makes the three-target
 * picker in the webview honest about what's actually available.
 */
export function getAvailableTargets(
  workspaceFolderUri: Uri | undefined,
): SettingsTarget[] {
  return workspaceFolderUri
    ? ALL_TARGETS
    : ALL_TARGETS.filter(target => target === 'userSettings');
}

export function getDefaultTarget(
  availableTargets: SettingsTarget[],
): SettingsTarget {
  return availableTargets.includes('workspaceSettings')
    ? 'workspaceSettings'
    : 'userSettings';
}

async function ensureSchema(
  context: ExtensionContext,
): Promise<{schema: JsonSchema; warning?: string}> {
  cachedSchemaResult ??= await loadSettingsSchema(context);
  return cachedSchemaResult;
}

type LoadResultMessage = Extract<
  HostToWebviewMessage,
  {type: 'loadSettings'} | {type: 'loadError'}
>;

async function loadTargetMessage(
  context: ExtensionContext,
  target: SettingsTarget,
): Promise<LoadResultMessage> {
  const workspaceFolderUri = await getWorkspaceFolderUri();
  const availableTargets = getAvailableTargets(workspaceFolderUri);

  const uriResult = await resolveSettingsFileUri(target, workspaceFolderUri);
  if (!uriResult.ok) {
    return {type: 'loadError', message: uriResult.error};
  }

  const readResult = await readSettingsFile(uriResult.value);
  if (!readResult.ok) {
    return {type: 'loadError', message: readResult.error};
  }

  try {
    const {schema, warning} = await ensureSchema(context);
    return {
      type: 'loadSettings',
      schema,
      target,
      availableTargets,
      values: readResult.value,
      warning,
    };
  } catch (error) {
    return {
      type: 'loadError',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function handleSave(
  context: ExtensionContext,
  target: SettingsTarget,
  values: JsonObject,
): Promise<HostToWebviewMessage> {
  const vscode = await import('vscode');

  const workspaceFolderUri = await getWorkspaceFolderUri();
  const uriResult = await resolveSettingsFileUri(target, workspaceFolderUri);
  if (!uriResult.ok) {
    void vscode.window.showErrorMessage(
      `Failed to save Claude Code settings: ${uriResult.error}`,
    );
    return {type: 'saveResult', target, ok: false, error: uriResult.error};
  }

  let schema: JsonSchema;
  try {
    ({schema} = await ensureSchema(context));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(
      `Failed to save Claude Code settings: ${message}`,
    );
    return {type: 'saveResult', target, ok: false, error: message};
  }

  const writeResult = await writeSettingsFile(uriResult.value, schema, values);
  if (!writeResult.ok) {
    void vscode.window.showErrorMessage(
      `Failed to save Claude Code settings: ${writeResult.error}`,
    );
    return {type: 'saveResult', target, ok: false, error: writeResult.error};
  }

  void vscode.window.showInformationMessage(
    `Saved Claude Code settings to ${uriResult.value.fsPath}`,
  );
  return {type: 'saveResult', target, ok: true};
}

async function handleWebviewMessage(
  context: ExtensionContext,
  panel: WebviewPanel,
  message: WebviewToHostMessage,
): Promise<void> {
  let reply: HostToWebviewMessage;
  switch (message.type) {
    case 'ready': {
      const availableTargets = getAvailableTargets(
        await getWorkspaceFolderUri(),
      );
      currentTarget = getDefaultTarget(availableTargets);
      reply = await loadTargetMessage(context, currentTarget);
      break;
    }
    case 'selectTarget':
      currentTarget = message.target;
      reply = await loadTargetMessage(context, message.target);
      break;
    case 'save':
      reply = await handleSave(context, message.target, message.values);
      break;
  }
  // Each branch above awaits async work (a fetch, file I/O); the panel may
  // have been closed while it was in flight. Posting to a disposed webview
  // throws, so check it's still the active one rather than let that
  // surface as a confusing "failed to load/save settings" error.
  if (panel === currentPanel) {
    await panel.webview.postMessage(reply);
  }
}

/**
 * Opens the Claude Settings Builder webview panel, revealing the existing
 * one instead of creating a second copy if it's already open.
 */
export async function openSettingsBuilderPanel(
  context: ExtensionContext,
): Promise<void> {
  const vscode = await import('vscode');

  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.One);
    return;
  }

  const webviewRoot = vscode.Uri.joinPath(
    context.extensionUri,
    ...WEBVIEW_DIST_PATH,
  );

  const panel = vscode.window.createWebviewPanel(
    VIEW_TYPE,
    PANEL_TITLE,
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [webviewRoot],
    },
  );

  panel.webview.html = await getWebviewHtml(panel.webview, webviewRoot);

  panel.webview.onDidReceiveMessage(
    (message: WebviewToHostMessage) => {
      void handleWebviewMessage(context, panel, message);
    },
    undefined,
    context.subscriptions,
  );

  panel.onDidDispose(
    () => {
      currentPanel = undefined;
      cachedSchemaResult = undefined;
      currentTarget = undefined;
    },
    undefined,
    context.subscriptions,
  );

  currentPanel = panel;
}

/**
 * Retries the live schema fetch, bypassing the cached copy from this panel
 * session, and reloads the currently-viewed target with the result. This
 * is the "manual refresh" escape hatch for offline resilience: a session
 * that started offline (and is therefore showing the bundled fallback
 * schema with its staleness warning) can retry once connectivity is back,
 * without closing and reopening the panel.
 */
export async function refreshSchema(context: ExtensionContext): Promise<void> {
  const vscode = await import('vscode');

  // Captured before the awaits below so a dispose that happens while this
  // is in flight is detected by comparing against the (then-updated)
  // module state, rather than by this function's own local state going
  // stale silently.
  const panel = currentPanel;
  const target = currentTarget;

  cachedSchemaResult = undefined;

  if (!panel || !target) {
    void vscode.window.showInformationMessage(
      'Open Claude Settings Builder before refreshing its schema.',
    );
    return;
  }

  const reply = await loadTargetMessage(context, target);

  if (panel !== currentPanel) {
    // The panel was closed (or replaced by a new one) while the refresh
    // was in flight; there's nothing left to post the result to or show a
    // notification about.
    return;
  }
  await panel.webview.postMessage(reply);

  if (reply.type === 'loadError') {
    void vscode.window.showErrorMessage(
      `Failed to refresh the Claude Code settings schema: ${reply.message}`,
    );
  } else if (reply.warning) {
    void vscode.window.showWarningMessage(reply.warning);
  } else {
    void vscode.window.showInformationMessage(
      'Refreshed the Claude Code settings schema from schemastore.org.',
    );
  }
}
