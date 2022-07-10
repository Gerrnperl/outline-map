import { PathLike } from 'fs';
import { readFile, rename } from 'fs/promises';
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
	workspace,
	Position
	// SnippetString,
} from 'vscode';

export class SymbolNode {

	type: string;
	range: Range;
	name: string;
	details: string;

	// if false, all of the children will not be visible
	open: boolean;
	// if false, only this node itself will not be visible
	display: boolean;

	highlight: boolean;

	children: Array<SymbolNode>;

	constructor(symbolInfo: DocumentSymbol) {
		this.type = SymbolKind[symbolInfo.kind];
		this.range = symbolInfo.range;
		this.name = symbolInfo.name;
		this.details = symbolInfo?.detail;
		this.open = true;
		this.children = [];
		this.display = true;
		this.highlight = false;
	}

	appendChildren(...child: SymbolNode[]) {
		this.children.push(...child);
	}

}

export class OutlineProvider implements WebviewViewProvider {

	viewType = 'outline-map-view';

	context: ExtensionContext;

	outlineRoot: SymbolNode | undefined;

	#view: WebviewView | undefined;

	#extensionUri: Uri;


	indexes: Map<number, SymbolNode> | undefined;

	constructor(context: ExtensionContext) {
		this.context = context;
		this.#extensionUri = context.extensionUri;

		this.#initEventListeners();

	}

	#initEventListeners() {
		window.onDidChangeActiveTextEditor(event => {
			if (event) {
				this.#rebuild(event.document);
			}
		}, this);
		window.onDidChangeTextEditorVisibleRanges(event => {
			let oldOutlineRoot = JSON.parse(JSON.stringify(this.outlineRoot));
			let range = event.visibleRanges[0];
			let lastKey = -1;
			let visibleRangeStart: number = 0;
			let visibleRangeEnd: number = 0;
			let index = 0;
			
			this.indexes?.forEach((symbolNode, key)=>{
				if(!visibleRangeStart && lastKey < range.start.line && key >= range.start.line){
					visibleRangeStart = index - 1;
				}
				if(!visibleRangeEnd && lastKey < range.end.line && key >= range.end.line){
					visibleRangeEnd = index - 1;
				}
				lastKey = key;
				symbolNode.open = !!symbolNode.range.intersection(range);
				if(symbolNode.open && visibleRangeStart!== 0 && visibleRangeEnd === 0){
					symbolNode.highlight = true;
				}
				else {
					symbolNode.highlight = false;
				}
				index++;
			});
			let changes = diff(oldOutlineRoot, this.outlineRoot);
			if (changes) {
				this.#view?.webview.postMessage({
					type: 'update',
					changes: changes,
				});
			}
			
		});
		workspace.onDidChangeTextDocument(event => {
			let newOutline = new OutlineTree(event.document);
			newOutline.init().then(newOutlineRoot => {
				this.indexes = newOutline.indexes;
				if(this.outlineRoot?.children.length !== newOutlineRoot.children.length && window.activeTextEditor){
					this.#rebuild(window.activeTextEditor.document);
					return;
				}
				let changes = diff(this.outlineRoot, newOutlineRoot);
				if (changes) {
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
		outlineTree.init().then((outlineRoot) => {
			this.indexes = outlineTree.indexes;
			this.outlineRoot = outlineRoot;

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
			if (window.activeTextEditor) {
				this.#rebuild(window.activeTextEditor.document);
			}
		});

		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.type) {
				case 'goto':
					let start = new Position(data.range[0].line, data.range[0].character);
					commands.executeCommand('editor.action.goToLocations', window.activeTextEditor?.document.uri, start, [], 'goto', '');
			}
		});
	}

};


class OutlineTree {

	textDocument: TextDocument;
	symbols: DocumentSymbol[] | undefined;

	outlineRoot: SymbolNode | undefined;

	indexes: Map<number, SymbolNode>;

	constructor(textDocument: TextDocument) {
		this.textDocument = textDocument;
		this.indexes = new Map<number, SymbolNode>();
	}

	init(): Promise<SymbolNode> {
		return new Promise((resolve, reject) => {
			this.getSymbols(this.textDocument).then(
				symbolInformation => {
					// console.log(symbolInformation);
					
					this.symbols = symbolInformation;

					this.outlineRoot = new SymbolNode({ 'name': '__root__', kind: SymbolKind.File } as DocumentSymbol);
					this.outlineRoot.display = false;
					this.buildOutline(this.symbols, this.outlineRoot);
					
					resolve(this.outlineRoot);
				},
				reason => {
					reject(reason);
				});
		});

	}

	async getSymbols(textDocument: TextDocument): Promise<DocumentSymbol[]> {
		let result = await commands.executeCommand<DocumentSymbol[]>(
			"vscode.executeDocumentSymbolProvider",
			textDocument.uri
		);
		console.log(result);
		
		
		return result;
	};

	buildOutline(symbols: DocumentSymbol[], parent: SymbolNode) {
		symbols.sort((symbolA, symbolB) => {
			return symbolA.range.start.line - symbolB.range.start.line;
		});
		symbols?.forEach(symbol => {
			let symbolNode = new SymbolNode(symbol);
			this.indexes.set(symbol.range.start.line, symbolNode);
			parent.appendChildren(symbolNode);
			this.buildOutline(symbol.children, symbolNode);
		});
	}

}

function diff(oldObj: any, newObj: any): Change[] | void {
	let changes: Change[] = [];

	function isSameObject(obj1: object, obj2: object): boolean {
		return JSON.stringify(obj1) === JSON.stringify(obj2);
	}

	function isEqual(a:any, b:any):boolean {
		return a === b || (typeof (a) === 'number' && isNaN(a) && typeof (b) === 'number' && isNaN(b));
	}

	function isObject(obj: any) {
		let type = typeof obj;
		return obj !== null && (type === 'object' || type === 'function');
	}

	function _diff(oldObj: any, newObj: any, paths: string[]): Change[] | void {
		if (isSameObject(oldObj, newObj)) {
			return;
		}
		for (const key in newObj) {
			if (Object.prototype.hasOwnProperty.call(newObj, key)) {
				const a = oldObj[key];
				const b = newObj[key];
				if (isObject(a) && isObject(b)) {
					let clonePaths = paths.concat(key);
					_diff(a, b, clonePaths);
				}
				else if (!isEqual(a, b)) {
					let clonePaths = paths.concat(key);
					changes.push({ path: clonePaths, newValue: b, oldValue: a });
				}
			}
		}
		for (const key in oldObj) {
			if (
				Object.prototype.hasOwnProperty.call(oldObj, key)
				&& !Object.prototype.hasOwnProperty.call(newObj, key)
			) {
				let clonePaths = paths.concat(key);
				changes.push({ path: clonePaths, newValue: undefined, oldValue: oldObj[key] });
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