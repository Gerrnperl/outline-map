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
	Position,
	languages,
	DiagnosticSeverity
	// SnippetString,
} from 'vscode';

interface Change {
	path: string[];
	newValue: any;
	oldValue?: any;
}

interface Diagnostic {
	level: string;
	message: string;
}

let hiddenItem:string[] = [];

export class SymbolNode {

	type: string;
	range: {start: Position, end: Position};
	name: string;
	details: string;

	// if false, all of the children will not be visible
	open: boolean;
	// if false, only this node itself will not be visible
	display: boolean;

	highlight: boolean;

	children: Array<SymbolNode>;

	diagnostics: Array<Diagnostic>;

	constructor(symbolInfo: DocumentSymbol) {
		this.type = SymbolKind[symbolInfo.kind];
		this.range = {
			start: symbolInfo.range?.start,
			end: symbolInfo.range?.end,
		};
		this.name = symbolInfo.name;
		this.details = symbolInfo?.detail;
		this.open = true;
		this.children = [];
		this.display = true;
		this.highlight = false;
		this.diagnostics = [];
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

	lastSelectedLine: number | undefined;

	indexes: Map<number, SymbolNode>;

	constructor(context: ExtensionContext) {
		this.context = context;
		this.#extensionUri = context.extensionUri;

		this.#initEventListeners();
		this.indexes = new Map<number, SymbolNode>();
	}

	handleDiagnostics = (uri:Uri)=>{
		let diagnostics = languages.getDiagnostics(uri);
		let fmtDiagnostics = 
		diagnostics.map(diagnostic=>{
			let id = `${diagnostic.code}-${diagnostic.range.start.line}`;
			return {
				id,
				level: DiagnosticSeverity[diagnostic.severity],
				message: diagnostic.message,
				range: {
					start: diagnostic.range.start,
					end: diagnostic.range.end,
				}
			}
		})
		
		this.#view?.webview.postMessage({
			type: 'diagnostics',
			diagnostics: fmtDiagnostics,
		})
	}

	#initEventListeners() {
		// switch tabs
		window.onDidChangeActiveTextEditor(event => {
			let document = event?.document || window.activeTextEditor?.document;
			document && this.#rebuild(document);

			setTimeout(()=>{
				if(window.activeTextEditor?.document.uri){
					this.handleDiagnostics(window.activeTextEditor?.document.uri);
				}
			}, 500);
		}, this);
		// scroll
		window.onDidChangeTextEditorVisibleRanges(event => {
			let range = event.visibleRanges[0];
			range && this.#view?.webview.postMessage({
				type: 'scroll',
				range: {
					start: range.start,
					end: range.end,
				},
			})
			
		});

		window.onDidChangeTextEditorSelection(event=>{
			if(event.selections[0].start.line !== this.lastSelectedLine){
				this.lastSelectedLine = event.selections[0].start.line;
				this.#view?.webview.postMessage({
					type: 'focus',
					position: event.selections[0].start,
				})
			}
		});
		// edit
		workspace.onDidChangeTextDocument(event => {
			if(event.contentChanges[0] && event.contentChanges[0].range.start.line !== this.lastSelectedLine){
				this.lastSelectedLine = event.contentChanges[0].range.start.line;
				this.#view?.webview.postMessage({
					type: 'focus',
					position: event.contentChanges[0].range.start,
				})
			}
			// console.log('EDIT', event.contentChanges, event.reason);
			let newOutline = new OutlineTree(window.activeTextEditor?.document || event.document);
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
		
		// Diagnostics
		languages.onDidChangeDiagnostics(event=>{
			let activeUri = window.activeTextEditor?.document.uri!;
			if(event.uris.includes(activeUri)){
				this.handleDiagnostics(activeUri);
			}
		});

	}

	#rebuild(textDocument: TextDocument) {
		let outlineTree = new OutlineTree(textDocument);
		outlineTree.init().then((outlineRoot) => {
			this.outlineRoot = outlineRoot;

			this.#view?.webview.postMessage({
				type: 'build',
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
					<div id="outline-root"></div>
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
				this.loadStyle();
				this.loadConfig()
				this.#rebuild(window.activeTextEditor.document);
			}
		});

		this.#view.onDidChangeVisibility(()=>{
			if(this.#view?.visible && window.activeTextEditor){
				this.loadStyle();
				this.loadConfig();
				this.#rebuild(window.activeTextEditor.document);
			}
		})

		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.type) {
				case 'goto':
					let start = new Position(data.range.start.line, data.range.start.character);
					commands.executeCommand('editor.action.goToLocations', window.activeTextEditor?.document.uri, start, [], 'goto', '');
			}
		});
	}

	loadStyle(){
		let colors = workspace.getConfiguration('outline-map')?.get('color');
		if(colors){
			this.#view?.webview.postMessage({
				type: 'style',
				style: colors,
			});
		}
	}

	loadConfig(){
		let enableAutomaticIndentReduction
			= workspace.getConfiguration('outline-map')?.get('enableAutomaticIndentReduction');
		let follow 
			= workspace.getConfiguration('outline-map')?.get('follow');
		hiddenItem
			= workspace.getConfiguration('outline-map')?.get('hiddenItem') ?? [];
		this.#view?.webview.postMessage({
			type: 'config',
			config: {
				enableAutomaticIndentReduction,
				follow,
			},
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
					if(!symbolInformation){
						reject('Failed to get symbols');
						return;
					}
					
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

	// Get symbols of the document
	async getSymbols(textDocument: TextDocument): Promise<DocumentSymbol[]> {

		
		let result = await commands.executeCommand<DocumentSymbol[]>(
			"vscode.executeDocumentSymbolProvider",
			textDocument.uri
		);

		// console.log(result);
		
		return result;
	};

	buildOutline(symbols: DocumentSymbol[], parent: SymbolNode) {
		symbols.sort((symbolA, symbolB) =>{
			return symbolA.range.start.line - symbolB.range.end.line;
		});
		symbols?.forEach(symbol => {
			if(hiddenItem.includes(SymbolKind[symbol.kind].toLocaleLowerCase())){
				return;
			}
			let symbolNode = new SymbolNode(symbol);
			parent.appendChildren(symbolNode);
			this.buildOutline(symbol.children, symbolNode);
		});
	}

}

/**
 * Get the changes between two object;
 * 
 * @param oldObj 
 * @param newObj 
 * @returns An Array contains description of changes,
 *  each change contains the path to access the data & the new value
 */
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

		if(oldObj instanceof Array && newObj instanceof Array
			&& oldObj.length !== newObj.length
		){
			changes.push({path: paths, newValue: newObj, oldValue: oldObj});
			return;
		}

		
		if(paths.at(-1) === 'range'){
			changes.push({ path: paths, newValue: {start: newObj.start, end: newObj.end}});
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
				// CASE: the data exists in the old object but has been deleted
				let clonePaths = paths.concat(key);
				changes.push({ path: clonePaths, newValue: undefined, oldValue: oldObj[key] });
			}
		}
	}
	_diff(oldObj, newObj, []);
	return changes.length > 0 ? changes : undefined;
}

