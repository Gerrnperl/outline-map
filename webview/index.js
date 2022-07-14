/**
 * @typedef {{
 * 		id: string,
 *		level: string;
 *		message: string;
 *		range: Range;
 *}} Diagnostic
 * @typedef {{
 * 		line: number;
 * 		character: number;
 * }} Position
 * @typedef {{
 * 		start: Position;
 * 		end: Position;
 * }} Range;
 * @typedef {{
 * 		newValue: any;
 *		oldValue: any;
 *		path: string[];
 * }} Change;
 */

// import { SymbolNode } from '../src/outline';
let vscode = acquireVsCodeApi();

let outlineHTML = document.querySelector('#outline-root');

/** @type {{element: OutlineElement, children: OutlineNode[]}} */
let outlineTree;

/** @type {Map<Range, OutlineNode>} */
let indexes;

window.addEventListener('message', event => {
	let message = event.data;

	// console.log(message);
	switch (message.type){
	case 'style':
		style = message.style;
		break;
	case 'build':
		outlineHTML.innerHTML = '';
		buildOutline(message.outline);
		break;
	case 'scroll':
		// console.log(message.range);
		updateVisibleRange(message.range);
		break;
	case 'focus':
		updateFocusPosition(message.position);
		break;
	case 'update':
		updateOutline(message.changes);
		break;
	case 'diagnostics':
		updateDiagnostics(message.diagnostics);
		break;
	}
});


/**
 * Highlight the visible range of the outline
 * Expand a branch when a child node is visible.
 * @param {Range} range 
 */
function updateVisibleRange(range){
	indexes?.forEach((node, itemRange)=>{
		node.open = itemRange.end.line > range.start.line && itemRange.start.line < range.end.line;
		node.highlight = itemRange.start.line > range.start.line && itemRange.start.line < range.end.line;
		if(!node.open && node.focus){
			bubblePropertyUpward(node, 'focus');
		}
		if(!node.open && node.diagnostics.length){
			bubblePropertyUpward(node, 'diagnostics');
		}
		if(node.open && node.fromChild && node.fromChild.focus){
			node.focus = false;
		}
		if(node.open && node.diagnostics.length){
			clearPropertyUpward(node, 'diagnostics');
		}
	});
}

/**
 * Show the cursor's position on outline
 * @param {Position} position 
 */
function updateFocusPosition(position){
	if(!indexes){
		setTimeout(updateFocusPosition, 300, position);
		return;
	}
	let closestNode;
	let closest = Infinity;

	indexes.forEach((node, itemRange)=>{
		let diff = Math.abs(itemRange.start.line - position.line);

		if(diff < closest){
			closest = diff;
			closestNode = node;
		}
		node.focus = false;
	});

	closestNode.focus = true;
	closestNode.element.root.scrollIntoView({behavior: 'smooth', block: 'center'});
}

/**
 * 
 * @param {Change[]} changes 
 */
function updateOutline(changes){
	changes.forEach(change=>{
	// Move to the changed node
		/** @type {OutlineNode} */
		let node = outlineTree;
		let i = 0;

		for (; i < change.path.length - 1; i++){
			node = node[change.path[i]];
		}

		let property = change.path[i];

		if(node === undefined){
			return;
		}

		let oldValue = change.oldValue || node[property];

		node[property] = change.newValue;

		if(property === 'range'){
			let siblingNodes = [].concat(node.parent.children);

			siblingNodes = siblingNodes.splice(siblingNodes.indexOf(node), 1);

			let j = 0;

			for (; j < siblingNodes.length; j++){
				let hit = change.newValue.start.line > siblingNodes[j].range.start.line
						&& change.newValue.start.line < siblingNodes[j + 1].range.start.line;

				if(hit){
					break;
				}
				if(j === 0 && !hit){
					j--;
					break;
				}
			}
			if(siblingNodes[j + 1]){
				node.parent.element.childrenContainer.insertBefore(
					node.element.root,
					siblingNodes[j + 1].element.root
				);
			}
			else{
				node.parent.element.childrenContainer.appendChild(
					node.element.root
				);
			}
			indexes.delete(oldValue);
			indexes.set(change.newValue, node);
		}
	});
}

/**
 * 
 * @param {Diagnostic[]} diagnostics 
 */
function updateDiagnostics(diagnostics){
	if(!indexes){
		setTimeout(updateDiagnostics, 300, diagnostics);
		return;
	}
	// console.log(diagnostics);
	diagnostics.forEach((diagnostic, index)=>{
		let range = diagnostic.range;
		let closest = Infinity;
		let closestNode;

		indexes.forEach((node, itemRange)=>{
			if(index === 0){
				node.diagnostics = [];
			}
			let diff = Math.abs(itemRange.start.line - range.start.line);

			if(diff < closest){
				closest = diff;
				closestNode = node;
			}
			node.focus = false;
		});

		closestNode.pushDiagnostics(diagnostic);
		// console.log(closestNode);
	});
}

/**
 * Bubble a property upward to its parent node when the parent is 'collapsed'
 * 
 * **Note:** It will mark `fromChild: property` on the parent node
 * 
 * **Note:** bubble will stop if the attribute value of the parent node is not a falsy value
 * @param {OutlineNode} node node starting to bubble
 * @param {string} property the name of the property to bubble
 */
function bubblePropertyUpward(node, property){
	let parent = node.parent;

	if(!parent || parent.name === undefined || parent.open){
		return;
	}
	if(!parent.fromChild){
		parent.fromChild = {};
	}
	if(!parent[property]){
		parent[property] = node[property];
		parent.fromChild[property] = true;
		bubblePropertyUpward(parent, property);
	}
	else if(parent[property] instanceof Array && node[property] instanceof Array){
		if(parent[property].length === 0){
			parent[property] = node[property];
			if(!parent.fromChild[property]){
				parent.fromChild[property] = 0;
			}
			parent.fromChild[property] += node[property].length;
			bubblePropertyUpward(parent, property);
		}
	}
}

/**
 * Clear the property bubbled by {@link bubblePropertyUpward}
 * 
 * **Note:** It will set the property value of the parent node to defaultValue
 * 			when property `fromChild` is set
 * 
 * **Note:** The defaultValue will be cloned if it's a object
 * 
 * **Note:** progress will stop when `fromChild` is unset
 * @param {OutlineNode} node node starting to clear
 * @param {string} property the name of the property to clear
 * @param {?any} defaultValue the value to set to the property
 */
function clearPropertyUpward(node, property, defaultValue){
	let parent = node.parent;

	if(!parent || parent.name === undefined || !parent.fromChild || !parent.fromChild[property]){
		return;
	}
	if(parent[property] instanceof Array && node[property] instanceof Array){
		parent[property] = [];
		clearPropertyUpward(parent, property, defaultValue);
	}
	else if(parent[property]){
		parent[property] = defaultValue;
		parent.fromChild[property] = false;
	}
}

/**
 * 
 * @param {SymbolNode} outline 
 * @param {?OutlineNode} parent
 * @return {OutlineNode}
 */
function buildOutline(outline, parent){
	if (!parent && outline.type === 'File' && outline.name === '__root__'){
		// Create the root
		indexes = new Map();
		let root = document.createElement('div');

		root.className = 'outline-node outline-internal outline-root';
		outlineHTML.appendChild(root);

		// A minified OutlineNode
		outlineTree = {
			element: {
				root: root,
				childrenContainer: root,
			},
			children: [],
		};
		// console.log(outline);

		outline.children.sort((symbolA, symbolB) =>{
			return symbolA.range.start.line - symbolB.range.end.line;
		});

		for (const child of outline.children){
			let node = buildOutline(child, outlineTree);

			outlineTree.children.push(node);
			root.appendChild(node.element.root);
		}
		return outlineTree;
	}
	let outlineNode = new OutlineNode(outline);

	indexes.set(outlineNode.range, outlineNode);

	// set the reverse pointer point to parent for retrospective
	outlineNode.parent = parent;
	if (outline.children.length > 0){
		// Is not a leaf node
		outlineNode.children = outline.children;
	}
	return outlineNode;
}

class OutlineNode{

	element = new OutlineElement();
	/** @type {string} */		_name = undefined;
	/** @type {string} */		_type = undefined;
	/** @type {boolean} */		_open = undefined;
	/** @type {boolean} */		_visibility = undefined;
	/** @type {boolean} */		_highlight = undefined;
	/** @type {boolean} */		_focus = undefined;
	/** @type {Diagnostic[]} */	_diagnostics = [];
	/** @type {OutlineNode[]} */	_children = [];
	/** @type {OutlineNode} */	parent = [];
	/** @type {Range} */		_range;
	/**
	 * 
	 * @param {SymbolNode} outline 
	 */
	constructor(outline){
		this.name = outline.name;
		this.type = outline.type.toLowerCase();
		this.highlight = false;
		this.focus = false;
		this.open = outline.open;
		this.display = outline.display;
		this.range = outline.range;
		this.element.label.addEventListener('click', () => {
			vscode.postMessage({
				type: 'goto',
				range: this.range,
			});
		});
	}
	get name(){
		return this._name;
	}
	set name(name){
		this._name = name;
		this.element.name.innerText = name;
		this.element.name.title = `${name} [${this.type}]`;
	}
	get type(){
		return this._type;
	}
	set type(type){
		type = type.toLocaleLowerCase();
		let color = style[type].color;

		this._type = type;
		this.element.root.setAttribute('type', type);
		this.element.root.setAttribute('style', `--color: ${color}`);
		this.element.icon.className = `codicon codicon-symbol-${type}`;
		this.element.name.title = `${this.name} [${type}]`;
	}
	get open(){
		return this._open;
	}
	set open(open){
		this._open = open;
		this.element.root.setAttribute('open', open.toString());
	}
	get range(){
		return this._range;
	}
	set range(range){
		this._range = range;
	}
	get visibility(){
		return this._visibility;
	}
	set visibility(visibility){
		this._visibility = visibility;
		this.element.root.setAttribute('visibility', visibility.toString());
	}
	get highlight(){
		return this._highlight;
	}
	set highlight(highlight){
		this._highlight = highlight;
		this.element.root.setAttribute('highlight', highlight.toString());
	}
	get focus(){
		return this._focus;
	}
	set focus(focus){
		this._focus = focus;
		this.element.root.setAttribute('focus', focus.toString());
	}
	get diagnostics(){
		return this._diagnostics;
	}
	set diagnostics(diagnostics){
		this._diagnostics = [];
		this.element.label.removeAttribute('diagnostic-Hint');
		this.element.label.removeAttribute('diagnostic-Information');
		this.element.label.removeAttribute('diagnostic-Warning');
		this.element.label.removeAttribute('diagnostic-Error');
		this.pushDiagnostics(...diagnostics);
	}
	get children(){
		return this._children;
	}
	set children(children){
		let childrenContainer = document.createElement('div');

		childrenContainer.className = 'outline-children';
		this.element.childrenContainer && this.element.root.removeChild(this.element.childrenContainer);
		this.element.root.appendChild(childrenContainer);
		this.element.childrenContainer = childrenContainer;

		this._children = [];
		this.appendChildren(...children);
	}
	/**
	 * 
	 * @param  {...SymbolNode} children 
	 */
	appendChildren(...children){
		children.sort((symbolA, symbolB) => {
			return symbolA.range.start.line - symbolB.range.start.line;
		});
		for (const child of children){
			let childNode = buildOutline(child, this);

			this._children.push(childNode);
			this.element.childrenContainer.appendChild(childNode.element.root);
		}
	}

	/**
	 * 
	 * @param  {...Diagnostic} diagnostics 
	 */
	pushDiagnostics(...diagnostics){
		for (const diagnostic of diagnostics){
			this._diagnostics.push(diagnostic);

			let count = +this.element.label.getAttribute(`diagnostic-${diagnostic.level}`) || 0;

			this.element.label.setAttribute(`diagnostic-${diagnostic.level}`, count + 1);
		}
	}

}

class OutlineElement{

	root;
	label;
	icon;
	name;
	/** @type {HTMLDivElement | undefined} */
	childrenContainer;
	constructor(){
		let root = document.createElement('div');

		root.classList.add('outline-node');
		let label = document.createElement('div');

		label.classList.add('outline-label');
		let icon = document.createElement('span');
		let name = document.createElement('span');

		name.className = 'symbol-name';
		label.appendChild(icon);
		label.appendChild(name);
		root.appendChild(label);
		this.root = root;
		this.label = label;
		this.icon = icon;
		this.name = name;
	}

}

let style = {
	module: {
		color: 'var(--vscode-symbolIcon-moduleForeground)',
	},
	namespace: {
		color: 'var(--vscode-symbolIcon-namespaceForeground)',
	},
	package: {
		color: 'var(--vscode-symbolIcon-packageForeground)',
	},
	class: {
		color: 'var(--vscode-symbolIcon-classForeground)',
	},
	method: {
		color: 'var(--vscode-symbolIcon-methodForeground)',
	},
	property: {
		color: 'var(--vscode-symbolIcon-propertyForeground)',
	},
	field: {
		color: 'var(--vscode-symbolIcon-fieldForeground)',
	},
	constructor: {
		color: 'var(--vscode-symbolIcon-constructorForeground)',
	},
	enum: {
		color: 'var(--vscode-symbolIcon-enumeratorForeground)',
	},
	interface: {
		color: 'var(--vscode-symbolIcon-interfaceForeground)',
	},
	function: {
		color: 'var(--vscode-symbolIcon-functionForeground)',
	},
	variable: {
		color: 'var(--vscode-symbolIcon-variableForeground)',
	},
	constant: {
		color: 'var(--vscode-symbolIcon-constantForeground)',
	},
	string: {
		color: 'var(--vscode-symbolIcon-stringForeground)',
	},
	number: {
		color: 'var(--vscode-symbolIcon-numberForeground)',
	},
	boolean: {
		color: 'var(--vscode-symbolIcon-booleanForeground)',
	},
	array: {
		color: 'var(--vscode-symbolIcon-arrayForeground)',
	},
	object: {
		color: 'var(--vscode-symbolIcon-objectForeground)',
	},
	key: {
		color: 'var(--vscode-symbolIcon-keyForeground)',
	},
	null: {
		color: 'var(--vscode-symbolIcon-nullForeground)',
	},
	enumMember: {
		color: 'var(--vscode-symbolIcon-enumeratorMemberForeground)',
	},
	struct: {
		color: 'var(--vscode-symbolIcon-structForeground)',
	},
	event: {
		color: 'var(--vscode-symbolIcon-eventForeground)',
	},
	operator: {
		color: 'var(--vscode-symbolIcon-operatorForeground)',
	},
	typeParameter: {
		color: 'var(--vscode-symbolIcon-typeParameterForeground)',
	},
};

