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
	// SnippetString,
} from 'vscode';

export class SymbolNode {
	constructor() {

	}
}

export class OutlineProvider implements WebviewViewProvider  {

	context: ExtensionContext;

	outlineTree: OutlineTree | undefined;

	#view: WebviewView | undefined;

	#extensionUri: Uri;

	constructor(context: ExtensionContext) {
		this.context = context;
		this.#extensionUri = context.extensionUri;
		this.#initEventListeners();
	}

	#initEventListeners(){
		window.onDidChangeVisibleTextEditors(async (event)=>{
			this.outlineTree = new OutlineTree(event[0].document);
			// if(window.activeTextEditor){
			// 	console.log(await this.getSymbols(window.activeTextEditor.document));
			// }
		});
	}

	#render(webview: Webview):string{
		return '';
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

		webviewView.webview.html = this.#render(webviewView.webview);

		// webviewView.webview.onDidReceiveMessage(data => {
		// 	switch (data.type) {
		// 		case 'colorSelected':
		// 			window.activeTextEditor?.insertSnippet(new SnippetString(`#${data.value}`));
		// 			break;
		// 	}
		// });
	}

};

class OutlineTree{

	textDocument: TextDocument;
	symbols: SymbolInformation[] | undefined;

	constructor(textDocument: TextDocument){
		this.textDocument = textDocument;
		this.getSymbols(textDocument).then(
			symbolInformation=>{
				this.symbols = symbolInformation;
			},
			reason=>{
				console.error(reason);
			});
		
	}

	getSymbols(textDocument: TextDocument): Thenable<SymbolInformation[]> {
		return commands.executeCommand<SymbolInformation[]>(
			"vscode.executeDocumentSymbolProvider",
			textDocument.uri
		);
	};
}