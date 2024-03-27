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

import { ContextCommandList, OutlineViewCommandList, WorkspaceCommandList } from './commands';
import { FocusMsg, PinStatus, ScrollMsg, Sortby } from '../common';
import { config } from './config';
import { debounce, throttle } from '../utils';
import { WorkspaceSymbols } from './workspace';
import { RegionCompletionProvider, RegionProvider } from './region';

let workspaceSymbols = undefined as WorkspaceSymbols | undefined;
let regionSymbolProvider = undefined as RegionProvider | undefined;
let regionCompletionProvider = undefined as RegionCompletionProvider | undefined;

export function activate(context: ExtensionContext) {
	restoreContext(context);
	if (config.workspaceEnabled()) {
		initWorkspaceSymbols(context);
	}
	if (config.regionEnabled()) {
		initRegionSymbolProvider();
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
		registerDocumentSwitchEvent(outlineView),
		registerCursorMoveEvent(outlineView),
		registerScrollEvent(outlineView),
		registerEditEvent(outlineView),
		registerDiagnosticEvent(outlineView),
		...OutlineViewCommandList.map(command => commands.registerCommand(command.name, command.fn.bind(null, outlineView, context.globalState))),
		...WorkspaceCommandList.map(command => commands.registerCommand(command.name, command.fn.bind(null, workspaceSymbols))),
		...ContextCommandList.map(command => commands.registerCommand(command.name, command.fn.bind(null))),
	);
}

/**
 * Restore context from global state
 * @param context 
 */
function restoreContext(context: ExtensionContext) {
	commands.executeCommand('setContext', 'outline-map.sort-by', context.globalState.get('sortBy', Sortby.position));
}

/**
 * Initialize workspace symbols
 * @param context 
 */
function initWorkspaceSymbols(context: ExtensionContext) {
	commands.executeCommand('setContext', 'outline-map.workspace.enabled', true);
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

/**
 * Initialize region symbol provider
 */
function initRegionSymbolProvider() {
	regionSymbolProvider = new RegionProvider();
	regionCompletionProvider = new RegionCompletionProvider();
	// Registering a DocumentSymbolProvider allows to go to
	// regions and tags with vscode's Go to Symbol feature, 
	// but this will pollute the built-in outline and breadcrumbs. 
	// Sometimes the region and tag symbols will override
	// the native symbols in the breadcrumbs.
	// So we only register it when the user wants to.
	if (config.regionRegisterSymbolProvider()) {
		languages.registerDocumentSymbolProvider({ scheme: 'file' }, regionSymbolProvider);
	}
	languages.registerFoldingRangeProvider({ scheme: 'file' }, regionSymbolProvider);
	languages.registerRenameProvider({ scheme: 'file' }, regionSymbolProvider);
	languages.registerCompletionItemProvider({ scheme: 'file' }, regionCompletionProvider);
	workspace.onDidChangeConfiguration(() => {
		regionSymbolProvider?.updateDecorationsConfig();
	});
}


/**
 * Update outline when document is changed
 * @param outlineView 
 * @returns 
 */
function registerDocumentSwitchEvent(outlineView: OutlineView) {
	return window.onDidChangeActiveTextEditor(event => {
		const document = event?.document || window.activeTextEditor?.document;
		outlineView.update(document);
	});
}

/**
 * Update outline when cursor moves
 * @param outlineView 
 * @returns 
 */
function registerCursorMoveEvent(outlineView: OutlineView) {
	return window.onDidChangeTextEditorSelection(debounce((event: TextEditorSelectionChangeEvent) => {
		outlineView.focus(event.selections);
		if (window.activeTextEditor?.visibleRanges) {
			outlineView.updateViewPort(window.activeTextEditor.visibleRanges[0]);
		}
		if (config.follow() === 'cursor') {
			outlineView.postMessage({
				type: 'scroll',
				data: {
					follow: 'focus',
				}
			} as ScrollMsg);
		}
	}, 300));
}

/**
 * Update outline when scroll
 * @param outlineView 
 * @returns 
 */
function registerScrollEvent(outlineView: OutlineView) {
	return window.onDidChangeTextEditorVisibleRanges(throttle((event: TextEditorVisibleRangesChangeEvent) => {
		if (config.follow() === 'viewport') {
			outlineView.updateViewPort(event.visibleRanges[0]);
			outlineView.postMessage({
				type: 'scroll',
				data: {
					follow: 'in-view',
				}
			} as ScrollMsg);
		}
	}, 100));
}

/**
 * Update outline when document is edited
 * @param outlineView 
 * @returns 
 */
function registerEditEvent(outlineView: OutlineView) {
	return workspace.onDidChangeTextDocument(debounce((event: TextDocumentChangeEvent) => {
		const document = event.document;
		outlineView.update(document);
	}, 300));
}

/**
 * Update outline when diagnostics change
 * @param outlineView 
 * @returns 
 */
function registerDiagnosticEvent(outlineView: OutlineView) {
	return languages.onDidChangeDiagnostics(debounce((event: DiagnosticChangeEvent) => {
		const docUri = window.activeTextEditor?.document.uri || event.uris[0];
		const diagnostics = languages.getDiagnostics(docUri);
		outlineView.updateDiagnostics(diagnostics);
	}, 300));
}