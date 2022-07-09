import { PathLike } from 'fs';
import { readFile } from 'fs/promises';
import {
	commands,
	SymbolInformation,
	SymbolKind,
	TextDocument,
	ExtensionContext,
	window,
	WebviewViewProvider,
	CancellationToken,
	WebviewView,
	WebviewViewResolveContext,
	Uri,
	Webview,
	DocumentSymbol,
	Range,
	ThemeIcon,
	workspace
	// SnippetString,
} from 'vscode';

export class SymbolNode {

	type: string;
	start: number;
	width: number;
	name: string;
	details: string;

	// if false, all of the children will not be visible
	open: boolean;
	// if false, only this node itself will not be visible
	display: boolean;

	children: Array<SymbolNode>;

	constructor(symbolInfo: DocumentSymbol) {
		this.type = SymbolKind[symbolInfo.kind];
		this.start = symbolInfo?.range?.start.line;
		this.width = symbolInfo?.range?.end.line
				   - symbolInfo?.range?.start.line;
		this.name = symbolInfo.name;
		this.details = symbolInfo?.detail;
		this.open = true;
		this.children = [];
		this.display = true;
	}

	appendChildren(...child: SymbolNode[]){
		this.children.push(...child);
	}

}

export class OutlineProvider implements WebviewViewProvider {

	viewType = 'outline-map-view';

	context: ExtensionContext;

	outlineRoot: SymbolNode | undefined;

	#view: WebviewView | undefined;

	#extensionUri: Uri;

	constructor(context: ExtensionContext) {
		this.context = context;
		this.#extensionUri = context.extensionUri;

		this.#initEventListeners();
		// console.log(window.activeTextEditor);

	}

	#initEventListeners() {
		window.onDidChangeActiveTextEditor(event => {
			if (event) {
				this.#rebuild(event.document);
			}
		}, this);
		window.onDidChangeTextEditorVisibleRanges(event => {
			let start = event.visibleRanges[0].start;
			let end = event.visibleRanges[0].end;
			// console.log(start, end);
		});
		workspace.onDidChangeTextDocument(event=>{
			let newOutline = new OutlineTree(event.document);
			newOutline.init().then(newOutlineRoot => {
				let changes = diff(this.outlineRoot, newOutlineRoot);
				if(changes){
					this.outlineRoot = newOutlineRoot;
					this.#view?.webview.postMessage({
						type: 'update',
						changes: changes,
					});
				}
			});
		});
	}

	#rebuild(textDocument: TextDocument) {
		let outlineTree = new OutlineTree(textDocument);
		outlineTree.init().then((outlineRoot)=>{
			this.outlineRoot = outlineRoot;
			// console.log(outlineRoot); // todo: remove this

			this.#view?.webview.postMessage({
				type: 'rebuild',
				outline: outlineRoot,
			});
		});
	}

	async #render(webview: Webview): Promise<string> {
		const scriptUri = webview.asWebviewUri(Uri.joinPath(this.#extensionUri, 'webview', 'index.js'));
		const styleUri = webview.asWebviewUri(Uri.joinPath(this.#extensionUri, 'webview', 'style.css'));
		const codiconsUri = webview.asWebviewUri(Uri.joinPath(this.#extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));
		const toolkitUri = webview.asWebviewUri(Uri.joinPath(this.#extensionUri, 
			"node_modules",
			"@vscode",
			"webview-ui-toolkit",
			"dist",
			"toolkit.js", // A toolkit.min.js file is also available
		));
		// console.log(toolkitUri);
		

		return `
		<!DOCTYPE html>
			<html>
				<head>
					<meta charset="UTF-8">
					<link href="${codiconsUri}" rel="stylesheet" />
					<link href="${styleUri}" rel="stylesheet" />
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<script type="module" src="${toolkitUri}"></script>
					<title>Outline Map</title>
				</head>
				<body>
					<div id="outline-root">Outline Map Initializing</div>
					<script src="${scriptUri}"></script>
				</body>
			</html>
		`;

	}


	resolveWebviewView(
		webviewView: WebviewView,
		context: WebviewViewResolveContext<unknown>,
		token: CancellationToken
	): void | Thenable<void> {

		this.#view = webviewView;

		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,

			localResourceRoots: [
				this.#extensionUri,
			]
		};

		this.#render(webviewView.webview).then(html => {
			webviewView.webview.html = html;
			if(window.activeTextEditor){
				this.#rebuild(window.activeTextEditor.document);
			}
		});

		// webviewView.webview.onDidReceiveMessage(data => {
		// 	switch (data.type) {
		// 		case 'colorSelected':
		// 			window.activeTextEditor?.insertSnippet(new SnippetString(`#${data.value}`));
		// 			break;
		// 	}
		// });
	}

};


class OutlineTree {

	textDocument: TextDocument;
	symbols: DocumentSymbol[] | undefined;

	outlineRoot: SymbolNode | undefined;
 
	constructor(textDocument: TextDocument) {
		this.textDocument = textDocument;

		// console.log(this.textDocument);
	}

	init():Promise<SymbolNode> {
		return new Promise((resolve, reject) => {
			this.getSymbols(this.textDocument).then(
				symbolInformation => {
					console.log(symbolInformation);
					this.symbols = symbolInformation;
	
					this.outlineRoot = new SymbolNode({'name': '__root__', kind: SymbolKind.File} as DocumentSymbol);
					this.outlineRoot.display = false;
					this.buildOutline(this.symbols, this.outlineRoot);
					resolve(this.outlineRoot);
				},
				reason => {
					reject(reason);
				});
		});
		
	}

	getSymbols(textDocument: TextDocument): Thenable<DocumentSymbol[]> {
		return commands.executeCommand<DocumentSymbol[]>(
			"vscode.executeDocumentSymbolProvider",
			textDocument.uri
		);
	};

	buildOutline(symbols: DocumentSymbol[], parent: SymbolNode){
		symbols?.forEach(symbol=>{
			let symbolNode = new SymbolNode(symbol);
			parent.appendChildren(symbolNode);
			this.buildOutline(symbol.children, symbolNode);
		});
	}

	updateCollapse(range: Range){
		let start = range.start.line;
		let end = range.end.line;
		// range.intersection
	}
}

function diff(oldObj: any, newObj: any):Change[]|void{
	let changes:Change[] = [];

	function isSameObject(obj1: object, obj2: object):boolean{
		return JSON.stringify(obj1) === JSON.stringify(obj2);
	}

	function isEqual(a:any, b:any):boolean{
		return a !== b && !(typeof(a) ==='number' && isNaN(a) && typeof(b) ==='number' && isNaN(b));
	}

	function isObject(obj:any){
		let type = typeof obj;
		return obj!==null && (type === 'object' || type === 'function');
	}

	function _diff(oldObj: any, newObj: any, paths: string[]):Change[]|void{
		if(isSameObject(oldObj,newObj)){
			return;
		}
		for (const key in newObj) {
			if (Object.prototype.hasOwnProperty.call(newObj, key)) {
				const a = oldObj[key];
				const b = newObj[key];
				if(isObject(a) && isObject(b)) {
					let clonePaths = paths.concat(key);
					_diff(a, b, clonePaths);
				}
				else if(isEqual(a, b)) {
					let clonePaths = paths.concat(key);
					changes.push({path: clonePaths, newValue: b, oldValue: a});
				}
			}
		}
		for (const key in oldObj) {
			if (
				Object.prototype.hasOwnProperty.call(oldObj, key)
			&& !Object.prototype.hasOwnProperty.call(newObj, key)
			) {
				let clonePaths = paths.concat(key);
				changes.push({path: clonePaths,newValue: undefined, oldValue: oldObj[key]});
			}
		}
	}
	_diff(oldObj, newObj, []);
	return changes.length > 0 ? changes : undefined;
}

interface Change {
	path: string[];
	newValue: any;
	oldValue: any;
}