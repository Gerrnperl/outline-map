import { Memento, commands } from 'vscode';
import { OutlineView } from './outline';
import { config } from './config';
import { ChangeDepthMsg, FocusMsg, PinSMsg, PinStatus } from '../common';
import { SymbolTreeItem, WorkspaceSymbols } from './workspace';

function changeDepth(outlineProvider: OutlineView, deltaDepth = 1) {
	outlineProvider.postMessage({
		type: 'changeDepth',
		data: {
			delta: deltaDepth,
		},
	} as ChangeDepthMsg);
}

// export 
function addDepth(outlineProvider: OutlineView) {
	changeDepth(outlineProvider, 1);
}

// export
function reduceDepth(outlineProvider: OutlineView) {
	changeDepth(outlineProvider, -1);
}


function switchPin(outlineProvider: OutlineView, pinStatus: PinStatus) {
	outlineProvider.pin(pinStatus);
	commands.executeCommand('setContext', 'outline-map.pin-status', pinStatus);
}

// export 
function pin(outlineProvider: OutlineView) {
	switchPin(outlineProvider, PinStatus.pinned);
}

// export 
function unpin(outlineProvider: OutlineView) {
	switchPin(outlineProvider, PinStatus.unpinned);
}

// export 
function freeze(outlineProvider: OutlineView) {
	switchPin(outlineProvider, PinStatus.frozen);
}

// export
function switchSearchField(outlineProvider: OutlineView, state: Memento) {
	state.update('searchField', !state.get('searchField', false));
	outlineProvider.postMessage({
		type: 'focus',
		toggle: true,
	} as FocusMsg);
}

// export
function focusSearchField(outlineProvider: OutlineView, state: Memento) {
	state.update('searchField', true);
	outlineProvider.postMessage({
		type: 'focus',
		toggle: false,
	} as FocusMsg);
}

if (config.defaultMaxDepth() > 0) {
	// if defaultMaxDepth is set, set the context to true
	// so that the Add/Reduce Depth buttons are visible
	commands.executeCommand('setContext', 'outline-map.defaultMaxDepthSet', true);
}

// Set initial pin status as unpinned
commands.executeCommand('setContext', 'outline-map.pin-status', PinStatus.unpinned);


export interface Command {
	name: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	fn: (...args: any[]) => any;
}

export const OutlineViewCommandList: Command[] = [
	{
		name: 'outline-map.reduceDepth',
		fn: reduceDepth,
	},
	{
		name: 'outline-map.addDepth',
		fn: addDepth,
	},
	{
		name: 'outline-map.pin',
		fn: pin,
	},
	{
		name: 'outline-map.unpin',
		fn: unpin,
	},
	{
		name: 'outline-map.freeze',
		fn: freeze,
	},
	{
		name: 'outline-map.toggleSearch',
		fn: switchSearchField,
	},
	{
		name: 'outline-map.focusSearch',
		fn: focusSearchField,
	},
];


// export
function workspaceCloseFile(workspaceSymbols: WorkspaceSymbols, item: SymbolTreeItem) {
	workspaceSymbols.removeDocuments([item.uri]);
}

function workspaceExcludeName(target: 'global' | 'workspace' | 'folder', withUri: boolean, workspaceSymbols: WorkspaceSymbols, item: SymbolTreeItem) {
	workspaceSymbols.excludeName(item, target, withUri);
}

export const WorkspaceCommandList: Command[] = [
	{
		name: 'outline-map.workspace.closeFile',
		fn: workspaceCloseFile,
	},
	{
		name: 'outline-map.workspace.deleteSymbol',
		fn: workspaceExcludeName.bind(null, 'workspace', true),
	},
	{
		name: 'outline-map.workspace.excludeGlobally',
		fn: workspaceExcludeName.bind(null, 'global', false),
	},
	{
		name: 'outline-map.workspace.excludeInWorkspace',
		fn: workspaceExcludeName.bind(null, 'workspace', false),
	},
	{
		name: 'outline-map.workspace.excludeInFolder',
		fn: workspaceExcludeName.bind(null, 'folder', false),
	}
];