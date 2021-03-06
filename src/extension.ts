// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import {OutlineProvider} from './outline';

import { addDepth, reduceDepth, pin, unpin, freeze } from './commands';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated

	// // // The command has been defined in the package.json file
	// // // Now provide the implementation of the command with registerCommand
	// // // The commandId parameter must match the command field in package.json
	// let disposable = vscode.commands.registerCommand('outline-map.helloWorld', () => {
	// 	// The code you place here will be executed every time your command is executed
	// 	// Display a message box to the user
	// 	vscode.window.showInformationMessage('Hello World from Outline Map!');
	// });

	// context.subscriptions.push(disposable);
	// console.log(fetch, global.fetch);
	
	let outlineProvider = new OutlineProvider(context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(outlineProvider.viewType, outlineProvider),
		vscode.commands.registerCommand('outline-map.reduceDepth', reduceDepth.bind(null, outlineProvider)),
		vscode.commands.registerCommand('outline-map.addDepth', addDepth.bind(null, outlineProvider)),
		vscode.commands.registerCommand('outline-map.pin', pin.bind(null, outlineProvider)),
		vscode.commands.registerCommand('outline-map.unpin', unpin.bind(null, outlineProvider)),
		vscode.commands.registerCommand('outline-map.freeze', freeze.bind(null, outlineProvider)),
	);
}

// this method is called when your extension is deactivated
export function deactivate() {}
