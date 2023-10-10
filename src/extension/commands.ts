import { commands } from 'vscode';
import { OutlineView } from './outline';
import { config } from './config';
import { ChangeDepthMsg, FocusMsg, PinSMsg, PinStatus } from '../common';

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
function switchSearchField(outlineProvider: OutlineView) {
	outlineProvider.postMessage({
		type: 'focus',
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

export const commandList: Command[] = [
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
];