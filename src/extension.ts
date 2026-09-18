import * as vscode from 'vscode';
import {openSettingsBuilderPanel, refreshSchema} from './panel.js';

export function activate(context: vscode.ExtensionContext): void {
  const openCommand = vscode.commands.registerCommand(
    'claudeSettingsBuilder.open',
    () => {
      openSettingsBuilderPanel(context).catch((error: unknown) => {
        void vscode.window.showErrorMessage(
          `Failed to open Claude Settings Builder: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    },
  );

  const refreshCommand = vscode.commands.registerCommand(
    'claudeSettingsBuilder.refreshSchema',
    () => {
      refreshSchema(context).catch((error: unknown) => {
        void vscode.window.showErrorMessage(
          `Failed to refresh the Claude Code settings schema: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    },
  );

  context.subscriptions.push(openCommand, refreshCommand);
}

export function deactivate(): void {}
