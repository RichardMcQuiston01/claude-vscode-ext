import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  const openCommand = vscode.commands.registerCommand(
    'claudeSettingsBuilder.open',
    () => {
      void vscode.window.showInformationMessage(
        'Claude Settings Builder: the settings editor UI has not been implemented yet.',
      );
    },
  );
  context.subscriptions.push(openCommand);
}

export function deactivate(): void {}
