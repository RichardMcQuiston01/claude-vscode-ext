import type {ExtensionContext, Uri, Webview, WebviewPanel} from 'vscode';
import {loadSettingsSchema, type JsonSchema} from './schemaProvider.js';

type JsonObject = Record<string, unknown>;

/**
 * Messages sent from the webview to the extension host. Extended in Stage
 * 5 to carry the actual "save" action — kept to just the initial handshake
 * here since there's no save flow yet.
 *
 * Mirrored (not imported) in `webview-ui/src/App.tsx`: the extension host
 * and webview-ui are separate TypeScript projects with their own tsconfigs,
 * so sharing this literal type isn't worth the cross-project build wiring
 * yet. Keep the two in sync by hand; revisit if the protocol grows.
 */
export type WebviewToHostMessage = {type: 'ready'};

/** Messages sent from the extension host to the webview. See above. */
export type HostToWebviewMessage =
  | {
      type: 'loadSettings';
      schema: JsonSchema;
      values: JsonObject;
      warning?: string;
    }
  | {type: 'loadError'; message: string};

const VIEW_TYPE = 'claudeSettingsBuilder.panel';
const PANEL_TITLE = 'Claude Settings Builder';
const WEBVIEW_DIST_PATH = ['dist', 'webview'];

let currentPanel: WebviewPanel | undefined;

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

async function handleWebviewMessage(
  context: ExtensionContext,
  panel: WebviewPanel,
  message: WebviewToHostMessage,
): Promise<void> {
  if (message.type !== 'ready') {
    return;
  }

  let reply: HostToWebviewMessage;
  try {
    const {schema, warning} = await loadSettingsSchema(context);
    // The webview only renders the loaded schema; wiring in the current
    // file's real values and the three-target picker is Stage 5.
    reply = {type: 'loadSettings', schema, values: {}, warning};
  } catch (error) {
    reply = {
      type: 'loadError',
      message: error instanceof Error ? error.message : String(error),
    };
  }
  await panel.webview.postMessage(reply);
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
    },
    undefined,
    context.subscriptions,
  );

  currentPanel = panel;
}
