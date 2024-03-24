import { Memento, Position, Uri, commands } from 'vscode';
import { OutlineView } from './outline';
import { config } from './config';
import { ChangeDepthMsg, FocusMsg, PinSMsg, PinStatus, Sortby } from '../common';
import { SymbolTreeItem, WorkspaceSymbols } from './workspace';


export interface Command {
	name: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	fn: (...args: any[]) => any;
}


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

function setSortBy(outlineProvider: OutlineView, sortBy: Sortby, state: Memento) {
	state.update('sortBy', sortBy);
	commands.executeCommand('setContext', 'outline-map.sort-by', sortBy);
	outlineProvider.sort(sortBy);
}

// export
function setSortByPosition(outlineProvider: OutlineView, state: Memento) {
	setSortBy(outlineProvider, Sortby.position, state);
}

// export
function setSortByName(outlineProvider: OutlineView, state: Memento) {
	setSortBy(outlineProvider, Sortby.name, state);
}

// export
function setSortByKind(outlineProvider: OutlineView, state: Memento) {
	setSortBy(outlineProvider, Sortby.kind, state);
}

if (config.defaultMaxDepth() > 0) {
	// if defaultMaxDepth is set, set the context to true
	// so that the Add/Reduce Depth buttons are visible
	commands.executeCommand('setContext', 'outline-map.defaultMaxDepthSet', true);
}

// Set initial pin status as unpinned
commands.executeCommand('setContext', 'outline-map.pin-status', PinStatus.unpinned);

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
		name: 'outline-map.unfreeze',
		fn: unpin,
	},
	{
		name: 'outline-map.toggleSearch',
		fn: switchSearchField,
	},
	{
		name: 'outline-map.focusSearch',
		fn: focusSearchField,
	},
	{
		name: 'outline-map.sortByPosition',
		fn: setSortByPosition,
	},
	{
		name: 'outline-map.sortByName',
		fn: setSortByName,
	},
	{
		name: 'outline-map.sortByKind',
		fn: setSortByKind,
	},
	{
		name: 'outline-map.sortByPositionChecked',
		fn: () => undefined,
	},
	{
		name: 'outline-map.sortByNameChecked',
		fn: () => undefined,
	},
	{
		name: 'outline-map.sortByKindChecked',
		fn: () => undefined,
	},

];


// export
function workspaceCloseFile(workspaceSymbols: WorkspaceSymbols, item: SymbolTreeItem) {
	workspaceSymbols.removeDocuments([item.uri]);
}

function workspaceExcludeName(target: 'global' | 'workspace' | 'folder', withUri: boolean, workspaceSymbols: WorkspaceSymbols, item: SymbolTreeItem) {
	workspaceSymbols.excludeName(item, target, withUri);
}

function workspaceGotoLocation(workspaceSymbols: WorkspaceSymbols, uri: string, pos: Position) {
	workspaceSymbols.goToLocation(uri, pos);
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
	},
	{
		name: 'outline-map.workspace.goToLocation',
		fn: workspaceGotoLocation,
	},
];