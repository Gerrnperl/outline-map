// import {SymbolNode} from '../src/outline'; // Only for type intelligence

let root = document.querySelector('#outline-root');

let outlineRoot;

window.addEventListener('message', event=>{
	let message = event.data;
	switch(message.type) {
		case 'style':
			style = message.style;
			break;
		case 'rebuild':
			rebuildOutline(message.outline);
			break;
		case 'update':
			let changes = message.changes;
			console.log(changes);
			updateOutline(changes);
			break;
	}
});

/**
 * 
 * @param {SymbolNode} outlineTree 
 * @param {?HTMLDivElement} parent
 * @return {?HTMLDivElement}
 */
function renderOutline(outlineTree, parent){
	if(!parent && outlineTree.type === 'File' && outlineTree.name === '__root__'){
		let root = document.createElement('div');
		root.className = 'outline-node outline-internal outline-root';
		renderOutline(outlineTree, root);
		return root;
	}
	for (const item of outlineTree.children) {
		let isLeaf = item.children?.length === 0;
		let node = renderNode(item, parent, isLeaf);
		item.element = node;

		if(!isLeaf){
			renderChildren(item, node);
		}

	}

}

function renderNode(item, parent, isLeaf) {
	let type = item.type.toLowerCase();
	let color = style[type].color;

	let node = document.createElement('div');
	node.className = `outline-node outline-${isLeaf ? 'leaf' : 'internal'} outline-${item.type}`;
	parent.appendChild(node);
	node.setAttribute('style', `--color: ${color}`);

	let thisLabel = document.createElement('div');
	thisLabel.className = `outline-label outline-${item.type}`;
	thisLabel.setAttribute('visible', item.display);
	thisLabel.innerHTML = `
		<span class="codicon codicon-symbol-${type}" title="${type}"></span>
		<span class="symbol-name">${item.name}</span>
	`;
	node.appendChild(thisLabel);
	node.label = thisLabel;
	return node;
}

function renderChildren(item, node){
	let type = item.type.toLowerCase();
	if(type === 'file'){
		rebuildOutline(outlineRoot);
		return;
	}

	if(node.childrenContainer){
		node.removeChild(node.childrenContainer);
	}
	let childrenContainer = document.createElement('div');
	childrenContainer.setAttribute('visible', item.open);
	childrenContainer.className = 'outline-children';
	node.appendChild(childrenContainer);
	node.childrenContainer = childrenContainer;

	renderOutline(item, childrenContainer);
}

function rebuildOutline(outline){
	let outlineElement = renderOutline(outline);
	root.innerHTML = '';
	root.appendChild(outlineElement);
	outlineRoot = outline;
}

function updateOutline(changes){
	changes.forEach(change=>{
		// Move to the changed node
		let secondLastPointer = outlineRoot;
		let i = 0;
		for (; i < change.path.length-2; i++) {
			const key = change.path[i];
			secondLastPointer = secondLastPointer[key];
		}
		pointer = secondLastPointer[change.path[i++]];

		// Modify & update
		let modifyKey = change.path[i];
		
		switch (modifyKey) {
			case 'type':
				let isLeaf = pointer.children?.length === 0;
				let type = change.newValue.toLowerCase();
				let color = style[type].color;
				pointer.element.className = `outline-node outline-${isLeaf ? 'leaf' : 'internal'} outline-${type}`;
				pointer.element.setAttribute('style', `--color: ${color}`);

				pointer.element.label.className = `outline-label outline-${type}`;

				let icon = pointer.element.label.querySelector('.codicon');
				icon.className = `codicon codicon-symbol-${type}`;
				icon.title = type;

				break;
			case 'name':
				let name = pointer.element.label.querySelector('.symbol-name');
				name.innerHTML = change.newValue;

				break;
			case 'open':
				pointer.element.childrenContainer.setAttribute('visible', item.open);
				break;
		
			default:
				break;
		}

		if(!isNaN(+modifyKey) && change.path[i-1] === 'children'){
			// case children
			// secondLastPointer is directing to the changed children
			secondLastPointer.children[change.path[i]] = change.newValue;
			renderChildren(secondLastPointer, secondLastPointer.element);
		}
		else{
			pointer[change.path[i]] = change.newValue;
		}
	});
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