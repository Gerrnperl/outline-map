import { commands, WebviewView, workspace } from "vscode";
import { OutlineProvider } from "./outline";

let defaultMaxDepth: number
= workspace.getConfiguration('outline-map')?.get('defaultMaxDepth') 
|| workspace.getConfiguration('outline-map')?.get('maxDepth')
|| 0;

if(defaultMaxDepth > 0){
	commands.executeCommand("setContext", "outline-map.defaultMaxDepthSet", true);
}


function changeDepth(outlineProvider: OutlineProvider, deltaDepth: number=1){
	let view = outlineProvider?.view;
	
	if(view){
		// console.log(view, deltaDepth);
		view.webview.postMessage({
			type: "changeDepth",
			deltaDepth,
		});
	}
}

export function addDepth(outlineProvider: OutlineProvider) {
	changeDepth(outlineProvider, 1);
}

export function reduceDepth(outlineProvider: OutlineProvider) {
	changeDepth(outlineProvider, -1);
}

function switchPin (outlineProvider: OutlineProvider, pinned: boolean) {
	let view = outlineProvider?.view;
	
	if(view){
		view.webview.postMessage({
			type: "pin",
			pinned,
		});
	}

	commands.executeCommand("setContext", "outline-map.pinned", pinned);
}

export function pin (outlineProvider: OutlineProvider) {
	switchPin(outlineProvider, true);
}

export function unpin (outlineProvider: OutlineProvider) {
	switchPin(outlineProvider, false);
}