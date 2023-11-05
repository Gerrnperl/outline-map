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
import { FocusMsg, ScrollMsg } from '../common';
import { config } from './config';
import { debounce, throttle } from '../utils';
import { WorkspaceSymbols } from './workspace';
import { RegionProvider } from './region';

let workspaceSymbols = undefined as WorkspaceSymbols | undefined;
let regionSymbolProvider = undefined as RegionProvider | undefined;

// called when extension is activated
// extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {

	commands.executeCommand('setContext', 'outline-map.workspace.enabled', true);
	if (config.workspaceEnabled()) {
		workspaceSymbols = new WorkspaceSymbols(context.workspaceState, workspace.workspaceFolders?.map(folder => folder.uri) || []);
		const treeView = window.createTreeView('outline-map-workspace', {
			treeDataProvider: workspaceSymbols,
			showCollapseAll: true,
		});
		context.subscriptions.push(
			workspace.onDidDeleteFiles(event => { // File delete
				workspaceSymbols?.removeDocuments(event.files);
			}),
			workspace.onDidRenameFiles(event => { // File rename
				workspaceSymbols?.renameDocuments(event.files);
			}),
			workspace.onDidChangeConfiguration(event => { // config change
				workspaceSymbols?.updateConfig();
			}),
			treeView,
		);
	}

	if (config.regionEnabled()) {
		regionSymbolProvider = new RegionProvider();
		// Registering a DocumentSymbolProvider allows to go to
		// regions and tags with vscode's Go to Symbol feature, 
		// but this will pollute the built-in outline and breadcrumbs. 
		// Sometimes the region and tag symbols will override
		// the native symbols in the breadcrumbs.
		// So we only register it when the user wants to.
		config.regionRegisterSymbolProvider() &&
			languages.registerDocumentSymbolProvider({ scheme: 'file' }, regionSymbolProvider);
		languages.registerFoldingRangeProvider({ scheme: 'file' }, regionSymbolProvider);
		workspace.onDidChangeConfiguration(() => {
			regionSymbolProvider?.updateDecorationsConfig();
		});
	}

	const outlineView = new OutlineView({
		context,
		workspaceSymbols,
		// if we have registered the region symbol provider,
		// we don't need to pass the region provider to the outline view for manual update.
		regionProvider: config.regionRegisterSymbolProvider() ? undefined : regionSymbolProvider,
		initialSearch: context.globalState.get('searchField', false),
	});


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
			const diagnostics = languages.getDiagnostics(docUri);
			outlineView.updateDiagnostics(diagnostics);
		}, 300)),

		//#endregion event
		//#region command
		...OutlineViewCommandList.map(command => commands.registerCommand(command.name, command.fn.bind(null, outlineView, context.globalState))),
		...WorkspaceCommandList.map(command => commands.registerCommand(command.name, command.fn.bind(null, workspaceSymbols))),
		//#endregion command
	);



}