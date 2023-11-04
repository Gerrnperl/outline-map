/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { CancellationToken, Command, Disposable, DocumentSymbol, Event, EventEmitter, Memento, Position, ProviderResult, ThemeColor, ThemeIcon, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri, commands, workspace } from 'vscode';
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
	uri: string;
	name: string;
	children: SymbolItem[];
	order: number;
	lastClick?: number;
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
			const paths = inner.name?.split('/');
			this.label = paths.pop();
			
			if (paths[0] === '') {
				this.description = paths.join('/');
			}
			else {
				this.description = paths.join('/');
			}
			this.tooltip = uri.path;
			this.iconPath = ThemeIcon.File;
			this.resourceUri = uri;
		}
		else {
			this.iconPath = new ThemeIcon(mapIcon(inner.kind), new ThemeColor(ColorTable[inner.kind]));
			this.command = {
				title: 'Jump to',
				command: 'outline-map.workspace.goToLocation',
				arguments: [
					this.uri.toString(),
					new Position(
						inner.range.start.line,
						inner.range.start.char
					)
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

	IncludeNames: ConfigItem[] = [];

	excludes: ConfigItem[] = [];

	entryMap = new Map<string, FileItem>();

	filepathMap = new Map<string, SymbolTreeItem>();

	workspaceFolders: Uri[] = [];
	constructor(state: Memento, workspaceFolders: Uri[]) {
		this.state = state;
		this.entryMap = new Map<string, FileItem>();
		this.workspaceFolders = workspaceFolders;
		this.updateConfig();
		// this.init();
		const entry = this.state.get<Map<string, FileItem>>('workspace-symbols');
		if (entry) {
			this.entryMap = new Map<string, FileItem>(entry);
			// remove empty entry
			for (const [uri, file] of entry) {
				if (file.children.length === 0) {
					this.entryMap.delete(uri);
				}
			}
		}
		this.skipCloseTime();

	}

	goToLocation(uri: string, position: Position) { 
		if (!this.entryMap.has(uri)) {
			return;
		}
		this.entryMap.get(uri)!.lastClick = Date.now();
		if (config.fixedFiles() !== 0 && this.entryMap.get(uri)!.order >= config.fixedFiles()) {
			this.updateOrder();
		}
		if (config.closeFileTimeout() > 0) {
			this.checkCloseFile();
		}
		commands.executeCommand('editor.action.goToLocations', Uri.parse(uri), position, [], 'goto', '');
	}

	/**
	 * Update the order of the workspace symbols
	 */
	updateOrder() {
		const order = Array.from(this.entryMap.entries())
			.sort((a, b) => {
				return (b[1].lastClick || 0) - (a[1].lastClick || 0);
			})
			.map(item => item[0]);
		order.forEach((uri, index) => {
			this.entryMap.get(uri)!.order = index;
		});
		this._onDidChangeTreeData.fire();
	}

	
	/**
	 * Update the last click time of each file to skip the time when vscode is closed
	 */
	skipCloseTime() {
		const now = Date.now();
		const deltaTime = now - this.state.get<number>('time-stamp', now);
		this.entryMap.forEach(file => {
			file.lastClick = file.lastClick ? file.lastClick + deltaTime : 0;
		});
		this.updateCurrentTime();
	}
	
	// If we set the exit time in the deactivate event or the dispose method, 
	// this will not succeed (it looks like the state.update is called, 
	// but the callback that sets the completion is not called)
	// Update the time-stamp for `skipCloseTime` periodically
	updateCurrentTime() {
		this.state.update('time-stamp', Date.now()).then(()=>{
			setTimeout(()=>{
				this.updateCurrentTime();
			}, 1000);
		});
	}


	checkCloseFile() {
		const timeout = config.closeFileTimeout() * 1000;
		if (timeout <= 0) {
			return;
		}
		const now = Date.now();
		const toDelete: string[] = [];
		this.entryMap.forEach((file, uri) => {
			if (file.lastClick && (now - file.lastClick) > timeout) {
				toDelete.push(uri);
			}
		});
		if (toDelete.length > 0) {
			this.removeDocuments(toDelete.map(uri => Uri.parse(uri)));
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
		).then(() => {
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
		if (this.workspaceFolders.length === 1) {
			return uri.path.replace(this.workspaceFolders[0].path, '');
		}
		for (const folder of this.workspaceFolders) {
			if (uri.path.startsWith(folder.path)) {
				const workspaceName = folder.path.split('/').pop() || '';
				return uri.path.replace(folder.path, workspaceName);
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
			outline.updateSymbols().then(() => {
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
		const uriStr = uri.toString();
		let file = this.entryMap.get(uriStr);
		if (!file) {
			file = {
				type: 'file',
				name: this.mapDocumentUri(uri),
				children: [] as SymbolItem[],
				uri: uriStr,
				order: this.entryMap.size,
				lastClick: 0,
			};
		}
		if (this.matchConfig(new SymbolTreeItem(file, uri, false), this.excludes)) {
			return;
		}
		const symbolItem = this.mapSymbolNode(symbol, uri);
		if (!symbolItem || symbolItem.length === 0) {
			if (this.entryMap.has(uriStr)) {
				this.entryMap.delete(uriStr);
				this.apply();
			}
			return;
		}
		file.children = symbolItem;
		this.entryMap.set(uriStr, file);
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
				this.updateOrder();
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
				const childItem = map(child);
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
			const item = map(sym);
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
		const result = Array.from(this.entryMap.values())
			.sort((a, b) => a.order - b.order);
		return result.map(item => {
			const treeItem = new SymbolTreeItem(item, Uri.parse(item.uri));
			return treeItem;
		});
	}
	//#endregion TreeDataProvider

}