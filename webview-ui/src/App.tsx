import {useEffect, useState} from 'react';
import {vscodeApi} from './vscode';

// Mirrors the message protocol defined in src/panel.ts (the extension
// host). Duplicated rather than imported: the extension host and
// webview-ui are separate TypeScript projects with their own tsconfigs, so
// sharing this literal type isn't worth the cross-project build wiring
// yet. Keep the two in sync by hand; revisit if the protocol grows.
type HostToWebviewMessage = {type: 'init'};

function App() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const onMessage = (event: MessageEvent<HostToWebviewMessage>) => {
      if (event.data.type === 'init') {
        setConnected(true);
      }
    };
    window.addEventListener('message', onMessage);
    vscodeApi.postMessage({type: 'ready'});
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <main className="flex min-h-screen flex-col gap-2 p-6">
      <h1 className="text-lg font-semibold">Claude Settings Builder</h1>
      <p className="text-sm text-gray-500">
        {connected
          ? 'Connected to the extension host.'
          : 'Connecting to the extension host…'}
      </p>
      <p className="text-sm text-gray-500">
        Schema-driven settings form will render here (see ROADMAP.md, Stage
        4).
      </p>
    </main>
  );
}

export default App;
