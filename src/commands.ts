import { WebviewView } from "vscode";
import { OutlineProvider } from "./outline";


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
