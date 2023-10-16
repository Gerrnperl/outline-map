import {
	ExtensionContext,
	window,
	commands,
	workspace,
	TextDocumentChangeEvent,
	TextEditorSelectionChangeEvent,
	TextEditorVisibleRangesChangeEvent,
	languages,
	DiagnosticChangeEvent,
	Position
} from 'vscode';

import { OutlineView } from './outline';

import { OutlineViewCommandList, WorkspaceCommandList } from './commands';
import { ScrollMsg } from '../common';
import { config } from './config';
import { debounce, throttle } from '../utils';
import { RegionProvider, tokensLegend } from './region';
import { WorkspaceSymbols } from './workspace';

// called when extension is activated
// extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
	
	// let disposable = vscode.commands.registerCommand('outline-map.helloWorld', () => {
	// 	vscode.window.showInformationMessage('Hello World from Outline Map!');
	// });
	commands.executeCommand('setContext', 'outline-map.workspace.enabled', true);
	let workspaceSymbols = undefined as WorkspaceSymbols | undefined;
	if (config.workspaceEnabled()) {
		workspaceSymbols = new WorkspaceSymbols(context.workspaceState, workspace.workspaceFolders?.map(folder => folder.uri) || []);
		const treeView = window.createTreeView('outline-map-workspace', {
			treeDataProvider: workspaceSymbols,
			showCollapseAll: true,
		});	
		context.subscriptions.push(
			// File delete
			workspace.onDidDeleteFiles(event => {
				workspaceSymbols?.removeDocuments(event.files);
			}),
			// File rename
			workspace.onDidRenameFiles(event => {
				workspaceSymbols?.renameDocuments(event.files);
			}),

			// config change
			workspace.onDidChangeConfiguration(event => {
				workspaceSymbols?.updateConfig();
			}),
			treeView,
		);
	}

	const outlineView = new OutlineView(context, workspaceSymbols);


	context.subscriptions.push(
		window.registerWebviewViewProvider('outline-map-view', outlineView),
		//#region event

		// add event listeners
		// update outline when document is changed
		window.onDidChangeActiveTextEditor(event => {
			const document = event?.document || window.activeTextEditor?.document;
			if (document) outlineView.update(document);
		}),

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
		}, 300)),

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
		}, 100)),

		// edit
		workspace.onDidChangeTextDocument(debounce((event: TextDocumentChangeEvent) => {
			const document = event.document;
			outlineView.update(document);
		}, 300)),

		languages.onDidChangeDiagnostics(debounce((event: DiagnosticChangeEvent) => {
			const docUri = window.activeTextEditor?.document.uri || event.uris[0];
			const diagnostics =  languages.getDiagnostics(docUri);
			outlineView.updateDiagnostics(diagnostics);
		}, 300)),

		//#endregion event
		//#region command
		...OutlineViewCommandList.map(command => commands.registerCommand(command.name, command.fn.bind(null, outlineView))),
		...WorkspaceCommandList.map(command => commands.registerCommand(command.name, command.fn.bind(null, workspaceSymbols))),
		//#endregion command
	);

	if (config.regionEnabled()) {
		const regionSymbolProvider = new RegionProvider();
		languages.registerDocumentSymbolProvider({ scheme: 'file' }, regionSymbolProvider);
		languages.registerFoldingRangeProvider({ scheme: 'file' }, regionSymbolProvider);
		if (config.regionHighlight()) {
			languages.registerDocumentSemanticTokensProvider({ scheme: 'file' }, regionSymbolProvider, tokensLegend);
		}
	}

}

// called when extension is deactivated
// export function deactivate() {}
