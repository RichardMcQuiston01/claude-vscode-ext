import assert from 'node:assert/strict';
import {test} from 'node:test';
import {injectWebviewAssets} from './panel.js';

const SAMPLE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
    <title>Claude Settings Builder</title>
    <script type="module" crossorigin src="./assets/index-ABC123.js"></script>
    <link rel="stylesheet" crossorigin href="./assets/index-ABC123.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

void test('injectWebviewAssets rewrites every relative asset reference to the webview base URI', () => {
  const result = injectWebviewAssets(SAMPLE_HTML, {
    cspSource: 'vscode-webview://abc123',
    baseUri: 'vscode-webview://abc123/dist/webview',
  });

  assert.doesNotMatch(result, /="\.\//);
  assert.match(
    result,
    /href="vscode-webview:\/\/abc123\/dist\/webview\/favicon\.svg"/,
  );
  assert.match(
    result,
    /src="vscode-webview:\/\/abc123\/dist\/webview\/assets\/index-ABC123\.js"/,
  );
  assert.match(
    result,
    /href="vscode-webview:\/\/abc123\/dist\/webview\/assets\/index-ABC123\.css"/,
  );
});

void test('injectWebviewAssets adds a CSP meta tag scoped to the webview resource root', () => {
  const result = injectWebviewAssets(SAMPLE_HTML, {
    cspSource: 'vscode-webview://abc123',
    baseUri: 'vscode-webview://abc123/dist/webview',
  });

  assert.match(result, /<meta http-equiv="Content-Security-Policy"/);
  assert.match(result, /script-src vscode-webview:\/\/abc123/);
  assert.match(result, /default-src 'none'/);
});
