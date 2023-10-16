/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { CancellationToken, Command, DocumentSymbol, Event, EventEmitter, Memento, Position, ProviderResult, ThemeColor, ThemeIcon, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri, workspace } from 'vscode';
import { ColorTable, SymbolKindStr, mapIcon } from '../utils';
import { SymbolNode } from '../common';
import { config } from './config';
import 'minimatch';
import { minimatch } from 'minimatch';
import { OutlineTree } from './outline';

/**
 * The SymbolItem is a simplified version of DocumentSymbol
 * and can be serialized to JSON
 */
interface SymbolItem {
	type: 'symbol';
	name: string;
	detail: string;
	kind: SymbolKindStr;
	range: {
		start: {
			line: number;
			char: number;
		};
		end: {
			line: number;
			char: number;
		};
	};
	children: SymbolItem[];
}

interface FileItem {
	type: 'file'
	uri: Uri;
	name: string;
	children: SymbolItem[];
}

interface ConfigItem {
	file: string;
	symbol: string;
}



/**
 * The SymbolTreeItem is a wrapper of SymbolItem and FileItem
 * 
 * This is used to display the symbol list in the tree view
 */
export class SymbolTreeItem extends TreeItem {
	uri: Uri;
	inner: SymbolItem | FileItem;
	children: SymbolTreeItem[] = [];
	// parent?: SymbolTreeItem | null = null;
	contextValue?: string | undefined;
	iconPath?: string | Uri | { light: string | Uri; dark: string | Uri; } | ThemeIcon | undefined;

	command?: Command | undefined;

	/**
	 * 
	 * @param inner The SymbolItem or FileItem
	 * @param uri The uri of the file
	 * @param recursive If true, the children will be mapped to SymbolTreeItem
	 */
	constructor(inner: SymbolItem | FileItem, uri: Uri, recursive = true/*, parent?: SymbolTreeItem | null*/) {
		super(inner.name, inner.children.length > 0 ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None);
		this.inner = inner;
		this.uri = uri;
		this.contextValue = inner.type;
		if (inner.type === 'file') {
			// this.iconPath = new ThemeIcon('file');
			this.tooltip = inner.uri.path;
		}
		else {
			this.iconPath = new ThemeIcon(mapIcon(inner.kind), new ThemeColor(ColorTable[inner.kind]));
			this.command = {
				title: 'Jump to',
				command: 'editor.action.goToLocations',
				arguments: [
					this.uri,
					new Position(
						inner.range.start.line,
						inner.range.start.char
					),
					[],
					'goto',
					''
				],
			};
		}
		if (recursive) {
			this.children = inner.children.map(child => new SymbolTreeItem(child, uri));
		}
		// this.parent = parent;
	}
}

/**
 * Maintain workspace fixed symbol list
 */
export class WorkspaceSymbols implements TreeDataProvider<SymbolTreeItem>{

	state: Memento;

	IncludeSymbols = new Set<SymbolKindStr>(['__om_Tag__', '__om_Region__']);

	IncludeNames:ConfigItem[] = [];

	excludes:ConfigItem[] = [];

	entryMap = new Map<string, SymbolItem[]>();

	workspaceFolders: Uri[] = [];

	constructor(state: Memento, workspaceFolders: Uri[]) {
		this.state = state;
		this.entryMap = new Map<string, SymbolItem[]>();
		this.workspaceFolders = workspaceFolders;
		this.updateConfig();
		const entry = this.state.get<Map<string, SymbolItem[]>>('workspace-symbols');
		if (entry) {
			this.entryMap = new Map<string, SymbolItem[]>(entry);
			// remove empty entry
			for (const [uri, children] of entry) {
				if (children.length === 0) {
					this.entryMap.delete(uri);
				}
			}
		}

	}

	//#region Config
	/**
	 * Write exclude name to the configuration
	 * @param name 
	 * @param target 
	 * @param [withUri=false] if true, the uri will be appended to the name
	 */
	excludeName(symbol: SymbolTreeItem, target: 'global' | 'workspace' | 'folder', withUri = false) {
		const excluding = {} as ConfigItem;
		const uri = this.mapDocumentUri(symbol.uri);
		if (symbol.inner.type === 'symbol') {
			excluding.symbol = symbol.inner.name;
		}
		if (symbol.inner.type === 'file' || withUri) {
			excluding.file = uri;
		}
		const config = workspace.getConfiguration('outline-map.workspace');
		const inspect = config.inspect<ConfigItem[]>('excludes');
		const configInTarget = inspect?.[
			target === 'global' ? 'globalValue' :
				'workspaceValue'
		] || [];
		// The configuration target or a boolean value. 
		// - If true updates Global settings. 
		// - If false updates Workspace settings.
		// - If undefined or null updates to Workspace folder settings
		//	 if configuration is resource specific, otherwise to Workspace settings.
		config.update('excludes', [...configInTarget, excluding], 
			target === 'global' ? true :
				target === 'workspace' ? false :
					null
		).then(()=>{
			if (symbol.inner.type === 'file') {
				this.removeDocuments([symbol.uri]);
			}
			else {
				this.reloadSymbolsOf(symbol.uri);
			}
		});
	}

	/**
	 * Load the configuration to this.IncludeNames and this.excludes
	 */
	updateConfig() {
		const config = workspace.getConfiguration('outline-map.workspace');
		this.excludes = config.get<ConfigItem[]>('excludes') || [];
		this.IncludeNames = config.get<ConfigItem[]>('IncludeNames') || [];
		const IncludeSymbols = config.get<SymbolKindStr[]>('IncludeSymbols') || [];
		this.IncludeSymbols = new Set<SymbolKindStr>(IncludeSymbols);
	}

	/**
	 * Check if the symbol or file can match the configs
	 * @param symbol 
	 * @returns 
	 */
	matchConfig(symbol: SymbolTreeItem, configs: ConfigItem[]): boolean {
		const uri = this.mapDocumentUri(symbol.uri);
		const name = symbol.inner.name;
		if (symbol.inner.type === 'file') {
			for (const config of configs) {
				if (config.symbol) { // This is a symbol exclude
					continue;
				}
				if (minimatch(uri, config.file)) {
					return true;
				}
			}
		}
		else {
			for (const config of configs) {
				if (!config.symbol) { // This is a file exclude
					continue;
				}
				if (minimatch(name, config.symbol) && (!config.file || minimatch(uri, config.file))) {
					return true;
				}
			}
		}
		return false;
	}
	//#endregion Config

	//#region UpdateSymbols
	init() {
		this.state.update('workspace-symbols', []);
	}

	/**
	 * Update the workspace symbol list to the state and fire the event
	 */
	apply() {
		this.state.update('workspace-symbols', [...this.entryMap]);
		this._onDidChangeTreeData.fire();
	}

	/**
	 * If the uri is in the workspace folders
	 * remove the workspace folder part
	 * @param uri 
	 */
	mapDocumentUri(uri: Uri): string {
		for (const folder of this.workspaceFolders) {
			if (uri.path.startsWith(folder.path)) {
				return uri.path.replace(folder.path, '');
			}
		}
		return uri.path;
	}

	reloadSymbolsOf(uri: Uri) {
		if (!this.entryMap.has(uri.toString())) {
			return;
		}
		workspace.openTextDocument(uri).then(doc => {
			const outline = new OutlineTree(doc);
			outline.updateSymbols().then(()=>{
				this.updateSymbol(outline.getNodes(), uri);
			});
		});
	}

	/**
	 * Update the symbol list of a document
	 * @param symbol 
	 * @param uri 
	 * @returns 
	 */
	updateSymbol(symbol: SymbolNode[], uri: Uri) {
		if (this.matchConfig(new SymbolTreeItem({
			type: 'file',
			children: [] as SymbolItem[],
			uri,
		} as FileItem, uri, false), this.excludes)) {
			return;
		}
		const uriStr = uri.toString();
		const symbolItem = this.mapSymbolNode(symbol, uri);
		if (!symbolItem || symbolItem.length === 0) {
			if (this.entryMap.has(uriStr)) {
				this.entryMap.delete(uriStr);
				this.apply();
			}
			return;
		}
		this.entryMap.set(uriStr, symbolItem);
		this.apply();
	}

	/**
	 * Remove the symbol list of a document
	 * Called when the files / folders are deleted
	 * @param uris 
	 */
	removeDocuments(uris: readonly Uri[]) {
		let changed = false;
		for (const uri of uris) {
			const uriStr = uri.toString();
			if (this.entryMap.has(uriStr)) {
				this.entryMap.delete(uriStr);
				changed = true;
			}
		}
		if (changed) {
			this.apply();
		}
	}
	
	/**
	 * Rename a document
	 */
	renameDocuments(files: readonly {
		readonly oldUri: Uri;
		readonly newUri: Uri;
	}[]
	) {
		let changed = false;
		for (const file of files) {
			const oldUri = file.oldUri.toString();
			const newUri = file.newUri.toString();
			if (this.entryMap.has(oldUri)) {
				changed = true;
				const children = this.entryMap.get(oldUri)!;
				this.entryMap.delete(oldUri);
				this.entryMap.set(newUri, children);
			}
		}
		if (changed) {
			this.apply();
		}
	}

	/**
	 * Map SymbolNode to SymbolItem and
	 * filter the symbol by kind and name
	 * @param symbol 
	 * @param uri 
	 * @returns 
	 */
	mapSymbolNode(symbol: SymbolNode[], uri: Uri): SymbolItem[] | null {
		const map = (symbol: SymbolNode): SymbolItem | null => {
			const result = {
				type: 'symbol' as const,
				name: symbol.name,
				detail: symbol.detail,
				kind: symbol.kind,
				range: {
					start: {
						line: symbol.range.start.line,
						char: symbol.range.start.character,
					},
					end: {
						line: symbol.range.end.line,
						char: symbol.range.end.character,
					},
				},
				children: [] as SymbolItem[],
			};
			const symbolTreeItem = new SymbolTreeItem(result, uri, false);
			// Remove the symbol if it is excluded
			if (this.matchConfig(symbolTreeItem, this.excludes)) {
				return null;
			}
			for (const child of symbol.children) {
				const childItem = map(child); //map(child, result);
				if (childItem) {
					result.children.push(childItem);
				}
			}
			// Remove the symbol if it has no children and not in the include list
			if (
				result.children.length === 0 &&
				!this.IncludeSymbols.has(symbol.kind) &&
				!this.matchConfig(symbolTreeItem, this.IncludeNames)
			) {
				return null;
			}
			return result;
		};
		const symbolItem: SymbolItem[] = [];
		for (const sym of symbol) {
			const item = map(sym); //map(sym, null);
			if (item) {
				symbolItem.push(item);
			}
		}
		return symbolItem;
	}

	//#endregion UpdateSymbols
	//#region TreeDataProvider

	private _onDidChangeTreeData: EventEmitter<SymbolTreeItem | undefined | null | void> = new EventEmitter<SymbolTreeItem | undefined | null | void>();
	onDidChangeTreeData?: Event<void | SymbolTreeItem | SymbolTreeItem[] | null | undefined> | undefined = this._onDidChangeTreeData.event;
	getTreeItem(element: SymbolTreeItem): TreeItem | Thenable<TreeItem> {
		return element;
	}
	getChildren(element?: SymbolTreeItem | undefined): ProviderResult<SymbolTreeItem[]> {
		if (element) {
			return element.children;
		}
		const result = Array.from(this.entryMap.entries()).map(([uri, children]) => {
			const uriParsed = Uri.parse(uri);
			const fileItem: FileItem = {
				type: 'file' as const,
				uri: uriParsed,
				name: this.mapDocumentUri(uriParsed).slice(1),
				children,
			};
			return fileItem;
		});
		console.log('file-items', result);
		return result.map(item => new SymbolTreeItem(item, item.uri));
	}
	//#endregion TreeDataProvider

}