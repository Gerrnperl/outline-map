import {
	ExtensionContext,
	window,
	commands,
	workspace,
	TextDocumentChangeEvent,
	TextEditorSelectionChangeEvent,
	TextEditorVisibleRangesChangeEvent,
	languages,
	DiagnosticChangeEvent
} from 'vscode';

import { OutlineView } from './outline';

import { commandList } from './commands';
import { ScrollMsg } from '../common';
import { config } from './config';
import { debounce, throttle } from '../utils';

// called when extension is activated
// extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
	
	// let disposable = vscode.commands.registerCommand('outline-map.helloWorld', () => {
	// 	vscode.window.showInformationMessage('Hello World from Outline Map!');
	// });
	
	const outlineView = new OutlineView(context);

	// add event listeners
	// update outline when document is changed
	window.onDidChangeActiveTextEditor(event => {
		const document = event?.document || window.activeTextEditor?.document;
		if (document) outlineView.update(document);
	});

	// cursor move
	window.onDidChangeTextEditorSelection(debounce((event: TextEditorSelectionChangeEvent) => {
		outlineView.focus(event.selections);
		if (config.follow() === 'cursor') {
			outlineView.postMessage({
				type: 'scroll',
				data: {
					follow: 'focus',
				}
			} as ScrollMsg);
		}
	}, 300));

	// scroll
	window.onDidChangeTextEditorVisibleRanges(throttle((event: TextEditorVisibleRangesChangeEvent) => {
		outlineView.updateViewPort(event.visibleRanges[0]);
		if (config.follow() === 'viewport') {
			outlineView.postMessage({
				type: 'scroll',
				data: {
					follow: 'in-view',
				}
			} as ScrollMsg);
		}
	}, 100));

	// edit
	workspace.onDidChangeTextDocument(debounce((event: TextDocumentChangeEvent) => {
		const document = event.document;
		outlineView.update(document);
	}, 300));

	languages.onDidChangeDiagnostics(debounce((event: DiagnosticChangeEvent) => {
		const docUri = window.activeTextEditor?.document.uri || event.uris[0];
		const diagnostics =  languages.getDiagnostics(docUri);
		outlineView.updateDiagnostics(diagnostics);
	}, 300));

	context.subscriptions.push(
		window.registerWebviewViewProvider('outline-map-view', outlineView),

		...commandList.map(command => commands.registerCommand(command.name, command.fn.bind(null, outlineView))),
	);
}

// called when extension is deactivated
// export function deactivate() {}
