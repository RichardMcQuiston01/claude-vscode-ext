import {useEffect, useState} from 'react';
import {SchemaForm} from './schemaForm/SchemaForm';
import type {JsonObject, JsonSchema} from './schemaForm/types';
import {vscodeApi} from './vscode';

// Mirrors the message protocol defined in src/panel.ts (the extension
// host). Duplicated rather than imported: the extension host and
// webview-ui are separate TypeScript projects with their own tsconfigs, so
// sharing this literal type isn't worth the cross-project build wiring
// yet. Keep the two in sync by hand; revisit if the protocol grows.
type HostToWebviewMessage =
  | {type: 'loadSettings'; schema: JsonSchema; values: JsonObject; warning?: string}
  | {type: 'loadError'; message: string};

type LoadState =
  | {status: 'connecting'}
  | {status: 'error'; message: string}
  | {status: 'loaded'; schema: JsonSchema; values: JsonObject; warning?: string};

function App() {
  const [state, setState] = useState<LoadState>({status: 'connecting'});

  useEffect(() => {
    const onMessage = (event: MessageEvent<HostToWebviewMessage>) => {
      const message = event.data;
      if (message.type === 'loadSettings') {
        setState({
          status: 'loaded',
          schema: message.schema,
          values: message.values,
          warning: message.warning,
        });
      } else if (message.type === 'loadError') {
        setState({status: 'error', message: message.message});
      }
    };
    window.addEventListener('message', onMessage);
    vscodeApi.postMessage({type: 'ready'});
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <main className="flex h-screen flex-col gap-3 p-4">
      <h1 className="text-lg font-semibold">Claude Settings Builder</h1>
      {state.status === 'connecting' && (
        <p className="text-sm text-gray-500">
          Connecting to the extension host…
        </p>
      )}
      {state.status === 'error' && (
        <p className="text-sm text-red-600">
          Failed to load settings: {state.message}
        </p>
      )}
      {state.status === 'loaded' && (
        <>
          {state.warning && (
            <p className="text-xs text-amber-600">{state.warning}</p>
          )}
          <div className="min-h-0 flex-1">
            <SchemaForm
              schema={state.schema}
              values={state.values}
              onChange={nextValues =>
                setState(current =>
                  current.status === 'loaded'
                    ? {...current, values: nextValues}
                    : current,
                )
              }
            />
          </div>
        </>
      )}
    </main>
  );
}

export default App;
