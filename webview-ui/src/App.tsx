import {useEffect, useState} from 'react';
import {SchemaForm} from './schemaForm/SchemaForm';
import type {JsonObject, JsonSchema} from './schemaForm/types';
import type {SettingsTarget} from './settingsTarget';
import {TargetPicker} from './TargetPicker';
import {vscodeApi} from './vscode';

// Mirrors the message protocol defined in src/panel.ts (the extension
// host). Duplicated rather than imported: the extension host and
// webview-ui are separate TypeScript projects with their own tsconfigs, so
// sharing this literal type isn't worth the cross-project build wiring
// yet. Keep the two in sync by hand; revisit if the protocol grows.
type HostToWebviewMessage =
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

type WebviewToHostMessage =
  | {type: 'ready'}
  | {type: 'selectTarget'; target: SettingsTarget}
  | {type: 'save'; target: SettingsTarget; values: JsonObject};

type SaveStatus =
  | {kind: 'idle'}
  | {kind: 'saving'}
  | {kind: 'saved'}
  | {kind: 'error'; message: string};

type LoadState =
  | {status: 'connecting'}
  | {status: 'error'; message: string}
  | {
      status: 'loaded';
      schema: JsonSchema;
      target: SettingsTarget;
      availableTargets: SettingsTarget[];
      values: JsonObject;
      warning?: string;
      saveStatus: SaveStatus;
    };

function postToHost(message: WebviewToHostMessage) {
  vscodeApi.postMessage(message);
}

function App() {
  const [state, setState] = useState<LoadState>({status: 'connecting'});

  useEffect(() => {
    const onMessage = (event: MessageEvent<HostToWebviewMessage>) => {
      const message = event.data;
      if (message.type === 'loadSettings') {
        setState({
          status: 'loaded',
          schema: message.schema,
          target: message.target,
          availableTargets: message.availableTargets,
          values: message.values,
          warning: message.warning,
          saveStatus: {kind: 'idle'},
        });
      } else if (message.type === 'loadError') {
        setState({status: 'error', message: message.message});
      } else if (message.type === 'saveResult') {
        setState(current =>
          current.status === 'loaded' && current.target === message.target
            ? {
                ...current,
                saveStatus: message.ok
                  ? {kind: 'saved'}
                  : {kind: 'error', message: message.error},
              }
            : current,
        );
      }
    };
    window.addEventListener('message', onMessage);
    postToHost({type: 'ready'});
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <main className="flex h-screen flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">Claude Settings Builder</h1>
        {state.status === 'loaded' && (
          <TargetPicker
            target={state.target}
            availableTargets={state.availableTargets}
            onSelect={target => {
              setState({status: 'connecting'});
              postToHost({type: 'selectTarget', target});
            }}
          />
        )}
      </div>
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
                    ? {...current, values: nextValues, saveStatus: {kind: 'idle'}}
                    : current,
                )
              }
            />
          </div>
          <div className="flex items-center gap-3 border-t border-gray-200 pt-3">
            <button
              type="button"
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              disabled={state.saveStatus.kind === 'saving'}
              onClick={() => {
                setState(current =>
                  current.status === 'loaded'
                    ? {...current, saveStatus: {kind: 'saving'}}
                    : current,
                );
                postToHost({
                  type: 'save',
                  target: state.target,
                  values: state.values,
                });
              }}
            >
              {state.saveStatus.kind === 'saving' ? 'Saving…' : 'Save'}
            </button>
            {state.saveStatus.kind === 'saved' && (
              <span className="text-sm text-green-600">Saved.</span>
            )}
            {state.saveStatus.kind === 'error' && (
              <span className="text-sm text-red-600">
                {state.saveStatus.message}
              </span>
            )}
          </div>
        </>
      )}
    </main>
  );
}

export default App;
