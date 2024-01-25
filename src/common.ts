// common types for both viewer and provider

import { DocumentSymbol, Position, Range, SymbolKind } from 'vscode';
import { config } from './extension/config';
import { SymbolKindStr } from './utils';

/**
 * Node of a tree of symbols.
 */
export class SymbolNode {
	/** The kind of the symbol. */
	kind: SymbolKindStr;
	/** The name of the symbol. */
	name: string;
	/** More detail for this symbol, e.g. the signature of a function. */
	detail: string;
	/** The range enclosing this symbol not including leading/trailing whitespace but everything else, e.g. comments and code. */
	range: {start: Position, end: Position};
	/**
	 * The range that should be selected and reveal when this symbol is being picked, e.g. the name of a function.
	 * Must be contained by the {@linkcode DocumentSymbol.range range}.
	 */
	selectionRange: {start: Position, end: Position};
	/** Indicates if the node is expanded. */
	expand: boolean;
	/** Indicates if the node is in viewport. */
	inView: boolean;
	/** Indicates if the node is focused. */
	focus: boolean;
	/** Children of this symbol, e.g. properties of a class. */
	children: SymbolNode[];
	/** The path to the node. */
	selector: string[];

	diagnosticStats = new DiagnosticStats();

	/**
	 * Creates a new SymbolNode.
	 * @param docSymbol The DocumentSymbol to create the SymbolNode from.
	 */
	constructor (docSymbol: DocumentSymbol) {
		this.kind = SymbolKind[docSymbol.kind] as SymbolKindStr;
		this.name = docSymbol.name;
		this.detail = docSymbol.detail;
		this.expand = false;
		this.inView = false;
		this.focus = false;
		this.range = {
			start: new Position(docSymbol.range.start.line, docSymbol.range.start.character),
			end: new Position(docSymbol.range.end.line, docSymbol.range.end.character),
		};
		this.selectionRange = {
			start: new Position(docSymbol.selectionRange.start.line, docSymbol.selectionRange.start.character),
			end: new Position(docSymbol.selectionRange.end.line, docSymbol.selectionRange.end.character),
		};
		this.children = [];
		this.selector = ['#outline-root'];
		this.mapCustomSymbol();
	}


	/**
	 * Create custom symbol kinds.
	 * 
	 * The custom symbol kinds are used to represent the regions and tags in the document.
	 * The kind information is stored in the detail of the DocumentSymbol by the RegionSymbolProvider.
	 * 
	 * This function should be called after the DocumentSymbol is mapped to a SymbolNode.
	 */
	mapCustomSymbol() {
		// RegionSymbolProvider use 'Number' as a placeholder for regions and tags.
		if (this.kind !== 'Number') {
			return;
		}
		if (this.detail.startsWith('__om_Region__')) {
			this.kind = '__om_Region__';
			this.detail = this.detail.slice(13);
		}
		else if (this.detail.startsWith('__om_Tag__')) {
			this.kind = '__om_Tag__';
			this.detail = this.detail.slice(10);
		}
	}


	/**
	 * Creates a tree of SymbolNodes from a list of DocumentSymbols.
	 * @param docSymbols The list of DocumentSymbols to create the tree from.
	 * @param parent The parent node of the tree.
	 * @returns The root node of the tree.
	 */
	static fromDocumentSymbols(docSymbols: DocumentSymbol[]) : SymbolNode[] {

		const root: SymbolNode[] = [];
		const hiddenItem = config.hiddenItem();

		// A known issue of vscode is that the DocumentSymbols returned by 
		// command 'vscode.executeDocumentSymbolProvider' does not include the 
		// information of the provider of the symbols.
		//
		// When a document has multiple symbol providers, 
		// the symbols from different providers are not hierarchical.
		// 
		// This function tries to reconstruct the tree.
		// It will move some siblings to be children of a node
		// if the range of the node contains the range of the siblings
		/**
		 * Reconstruct the tree of DocumentSymbols.
		 * @param docSymbols The list of DocumentSymbols to reconstruct, should be sorted by start line.
		 */
		function reconstructTree(docSymbols: DocumentSymbol[]) {
			for (let i = 0; i < docSymbols.length; i++) {
				const docSymbol = docSymbols[i];
				for (let j = i + 1; j < docSymbols.length; j++) {
					const sibling = docSymbols[j];
					if (docSymbol.range.contains(sibling.range)) {
						docSymbol.children.push(sibling);
						docSymbols.splice(j, 1);
						j--;
					}
				}
			}
		}

		// Inner function to recursively transform the DocumentSymbols into SymbolNodes
		function recursiveTransform(docSymbols: DocumentSymbol[], parent: SymbolNode | SymbolNode[]) {
			docSymbols.sort((a, b) => a.range.start.line - b.range.start.line);
			reconstructTree(docSymbols);
			docSymbols.forEach((docSymbol) => {
				const node = new SymbolNode(docSymbol);
				if (hiddenItem.includes(node.kind.toLowerCase())) {
					return;
				}
				if (Array.isArray(parent)) {
					parent.push(node);
					node.selector = node.selector.concat(`[data-key="${node.kind}-${node.name}"]`);
				}
				else {
					node.selector = parent.selector.concat(`[data-key="${node.kind}-${node.name}"]`);
					parent.children.push(node);
				}
				if (docSymbol.children.length > 0) {
					recursiveTransform(docSymbol.children, node);
				}
			});
		}

		recursiveTransform(docSymbols, root);

		return root;
	}

}

/**
 * The diagnostic stats of a node.
 */
export class DiagnosticStats {
	private errorCount = 0;
	private warningCount = 0;
	private hasErrorInChildren = false;
	private hasWarnInChildren = false;

	/**
	 * Reset the stats. 
	 */
	clear() {
		this.errorCount = 0;
		this.warningCount = 0;
		this.hasErrorInChildren = false;
		this.hasWarnInChildren = false;
	}

	/**
	 * Update the stats.
	 */
	add(type: 'error' | 'warning', inChildren = false) {
		if (inChildren) {
			if (type === 'error') {
				this.hasErrorInChildren = true;
			}
			else {
				this.hasWarnInChildren = true;
			}
		}
		else {
			if (type === 'error') {
				this.errorCount++;
			}
			else {
				this.warningCount++;
			}
		}
	}
	/**
	 * Get the most severe diagnostic stat.
	 * The order is: warningInChild < warning < errorInChild < error
	 * Set the count to -1 if there is no error or warning but there is error or warning in children.
	 */
	getStat(): {type: 'error' | 'warning' | 'none', count: number} {
		if (this.errorCount > 0) {
			return {type: 'error', count: this.errorCount};
		}
		if (this.hasErrorInChildren) {
			return {type: 'error', count: -1};
		}
		if (this.warningCount > 0) {
			return {type: 'warning', count: this.warningCount};
		}
		if (this.hasWarnInChildren) {
			return {type: 'warning', count: -1};
		}
		return {type: 'none', count: 0};
	}
}

export interface Msg {
	type: 'update' | 'config' | 'focus' | 'scroll' | 'changeDepth' | 'pin' | 'goto' | 'clear';
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	data: any;
}

export interface UpdateMsg extends Msg{
	type: 'update';
	data: {
		patches: Op[];
	};
}

export interface ConfigMsg extends Msg{
	type: 'config';
	data: {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		[key: string]: any;
	}
}

export interface FocusMsg extends Msg{
	type: 'focus';
	toggle: boolean;
}

export interface ScrollMsg extends Msg{
	type: 'scroll';
	data: {
		follow: 'in-view' | 'focus';
	};
}

export interface ChangeDepthMsg extends Msg{
	type: 'changeDepth';
	data: {
		delta: number;
	};
}

export interface GotoMsg extends Msg{
	type: 'goto';
	data: {
		position: Position;
	};
}

export interface ClearMsg extends Msg{
	type: 'clear';
	data: {
		description: string;
	}
}

export enum PinStatus {
	unpinned,
	pinned,
	frozen,
}

export interface PinSMsg {
	type: 'pin';
	data: {
		pinStatus: PinStatus;
	};
}

export type OpType = 'update' | 'delete' | 'insert' | 'move';

export interface Op {
	/** Locate the node to patch. */
	selector: string; 
	/** The type of operation. */
	type: OpType;
}

export interface UpdateOp extends Op {
	type: 'update';
	/** Effected property. */
	property: string;
	/** The new value. */
	value: string | boolean | number | null | undefined;
}

export interface MoveOp extends Op {
	type: 'move';
	/** The node to move. */
	nodes: SymbolNode[];
	/** The node to insert before, if null, insert at the end. */
	before: SymbolNode | null;
}

export interface DeleteOp extends Op {
	type: 'delete';
	/** The node to delete. */
	nodes: SymbolNode[];
}

export interface InsertOp extends Op {
	type: 'insert';
	/** The node to insert before, if null, insert at the end. */
	before: SymbolNode | null;
	/** The new node. */
	nodes: SymbolNode[];
}

