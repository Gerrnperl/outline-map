/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DeleteOp, InsertOp, MoveOp, ScrollMsg, Msg, ChangeDepthMsg , SymbolNode, UpdateOp, UpdateMsg, ConfigMsg, GotoMsg, FocusMsg, ClearMsg } from '../common';

const vscode = acquireVsCodeApi();

import 'overlayscrollbars/overlayscrollbars.css';
import { OverlayScrollbars } from 'overlayscrollbars';

import './main.scss';
import { Input } from './input';
import '@vscode/codicons/dist/codicon.css';
import { ColorTable, SymbolKindList, mapIcon } from '../utils';

/**
 * The root element of the outline
 */
const {root, input} = init();

let maxDepth = Infinity;

let debug = false;

/**
 * Handler of Message from backend
 */
const SMsgHandler = {
	update: (msg: UpdateMsg) => {
		msg.data.patches.forEach(patch => {
			const target = document.querySelector(patch.selector) as HTMLDivElement | null;
			const siblingContainer = document.querySelector(`${patch.selector}>.outline-children`) || root;
			if (!target) return;

			switch (patch.type) {
			case 'update':
				PatchHandler.update(patch as UpdateOp, target);
				break;
			case 'move':
				PatchHandler.move(patch as MoveOp, siblingContainer);
				break;
			case 'insert':
				PatchHandler.insert(patch as InsertOp, siblingContainer);
				target.classList.toggle('leaf', false);
				target.dataset.expand = 'true';
				break;
			case 'delete':
				PatchHandler.delete(patch as DeleteOp, siblingContainer);
				target.classList.toggle('leaf', siblingContainer?.children.length === 0);
				break;
			}
		});
	},
	scroll: (msg: ScrollMsg) => {
		const target = 0.33;
		// scroll the first node in viewport to the `target` of the screen
		const node = document.querySelector(`.${msg.data.follow}`) as HTMLDivElement | null;
		if (!node) return;
		const rect = node.getBoundingClientRect();
		const offset = rect.top + window.scrollY - window.innerHeight * target;		
		// smooth scroll
		window.scrollTo({
			top: offset,
			behavior: 'smooth'
		});
	},

	config: (msg: ConfigMsg) => {
		// TODO: Color configuration is deprecated
		// The following injection code should be removed
		// #region DEPRECATED
		const color = msg.data.color as { [key: string]: string };
		const colorStyle = document.querySelector('#color-style') as HTMLStyleElement;

		colorStyle.innerHTML = '';
		for (const key in color) {
			if (!Object.prototype.hasOwnProperty.call(color, key)) continue;
			
			if (key === 'focusingItem' || key === 'visibleRange') {
				colorStyle.innerHTML += `:root {--${key}-color: ${color[key]}}`;
				continue;
			}

			colorStyle.innerHTML += `[data-kind="${key}" i] {color: ${color[key]}}`;
		}
		//#endregion DEPRECATED
		maxDepth = msg.data.depth as number || Infinity;
		debug = msg.data.debug as boolean || false;
	},
	changeDepth: (msg: ChangeDepthMsg) => {
		maxDepth = Math.max(1, maxDepth + msg.data.delta);
		new Toast(`Depth: ${maxDepth}`, 3000);
	},
	switchSearchField: (toggle: boolean) => {
		const inputContainer = document.querySelector('#input-container') as HTMLDivElement;
		if (inputContainer.classList.contains('active') && toggle) {
			inputContainer.classList.toggle('active', false);
		}
		else {
			inputContainer.classList.toggle('active', true);
			input.start();
		}
	},
	clear: (description: string) => {
		const container = document.querySelector('.outline-children') as HTMLDivElement;
		container.innerHTML = '';
		const noOutline = document.querySelector('#no-outline') as HTMLDivElement;
		noOutline.innerText = description;
	}
};

/**
 * Apply patch to DOM
 */
const PatchHandler = {
	update: (patch: UpdateOp, target: HTMLDivElement) => {
		target.dataset[patch.property] = patch.value?.toString();
	},
	move: (patch: MoveOp, siblingContainer: Element) => {
		const sibling = Array.from(siblingContainer?.children || []);
		const nodes = patch.nodes.map(node => 
			matchKey(sibling, node) as HTMLDivElement
		);

		const before = matchKey(sibling, patch.before);
		
		nodes.forEach(node => {
			siblingContainer?.insertBefore(node, before);
		});
	},
	insert: (patch: InsertOp, siblingContainer: Element) => {
		const sibling = Array.from(siblingContainer?.children || []);
		const before = matchKey(sibling, patch.before);
		const depth = +((siblingContainer.parentElement as HTMLDivElement | null)?.style.getPropertyValue('--depth') || '0') + 1;

		patch.nodes.forEach(node => {			
			siblingContainer?.insertBefore(renderSymbolNode(node,depth), before);
		});
	},
	delete: (patch: DeleteOp, siblingContainer: Element) => {
		const sibling = Array.from(siblingContainer?.children || []);
		patch.nodes.forEach(node => {
			const element = matchKey(sibling, node);
			element?.remove();
		});
	}
};

/**
 * Match element by node
 */
function matchKey(elements: Element[], node: SymbolNode | null): Element | null {
	if (!node) return null;
	const key = `${node.kind}-${node.name}`;
	return elements.find(element => (element as HTMLDivElement).dataset.key === key) || null;
}

/**
 * Initialize the outline
 * @returns The root element of the outline
 */
function init() {
	const root = document.createElement('div');
	root.id = 'outline-root';
	root.innerHTML = /*html*/`
		<div class="outline-children"></div>
	`;

	const noOutline = document.createElement('div');
	noOutline.id = 'no-outline';
	noOutline.innerText = 'The active editor cannot provide outline information.';
	
	document.body.appendChild(root);
	document.body.appendChild(noOutline);

	const style = document.createElement('style');
	style.innerHTML = SymbolKindList.map(sym => 
		`[data-kind="${sym}" i] {color: var(--vscode-${ColorTable[sym].replace('.', '-')})}`
	).join('\n');

	document.body.appendChild(style);

	OverlayScrollbars(document.body, {
		overflow: {
			x: 'hidden',
			y: 'visible-scroll',
		},
		scrollbars: {
			autoHide: 'leave',
			autoHideDelay: 300,
		}
	});

	window.addEventListener('message', event => {
		const message = event.data as Msg;
		debug && console.log('[Outline-Map] Received message', message);
		switch (message.type) {
		case 'update':
			noOutline.innerHTML = '';
			SMsgHandler.update(message as UpdateMsg);
			break;
		case 'scroll':
			SMsgHandler.scroll(message as ScrollMsg);
			break;
		case 'config':
			SMsgHandler.config(message as ConfigMsg);
			break;
		case 'changeDepth':
			SMsgHandler.changeDepth(message as ChangeDepthMsg);
			break;
		case 'focus':
			SMsgHandler.switchSearchField((message as FocusMsg).toggle);
			break;
		case 'clear':
			SMsgHandler.clear((message as ClearMsg).data.description);
			break;
		}
	});

	const input = new Input();	

	return {root, input};
}

/**
 * Render symbolNode to DOM element
 */
function renderSymbolNode(symbolNode: SymbolNode, depth = 0): HTMLDivElement {
	const container = document.createElement('div');
	container.classList.add('outline-node');
	container.dataset.key = `${symbolNode.kind}-${symbolNode.name}`;
	container.dataset.kind = symbolNode.kind;
	container.dataset.name = symbolNode.name;
	container.dataset.detail = symbolNode.detail;
	container.dataset.expand = depth >= maxDepth ? 'false' : symbolNode.expand.toString();
	container.dataset.inview = symbolNode.inView.toString();
	container.dataset.focus = symbolNode.focus.toString();
	container.dataset.range = JSON.stringify(symbolNode.range);
	// container.dataset['vscode-context'] = JSON.stringify({webviewSection: 'outline-item'});
	container.setAttribute(
		'data-vscode-context', 
		JSON.stringify({
			webviewSection: 'outline-item',
			pos: symbolNode.selectionRange.start,
			preventDefaultContextMenuItems: true,
		})
	);
	container.classList.toggle('leaf', symbolNode.children.length === 0);
	container.classList.toggle('expand', depth >= maxDepth ? false : symbolNode.expand);
	container.style.setProperty('--depth', depth.toString());

	container.innerHTML = /*html*/`
	  <div class="outline-label">
		<span class="expand-btn codicon codicon-chevron-right"></span>
	    <span class="symbol-icon codicon codicon-${mapIcon(symbolNode.kind)}"></span>
		<span class="symbol-text" title="[${symbolNode.kind.toLowerCase()}] ${symbolNode.name} ${symbolNode.detail}">
			<span class="symbol-name">${symbolNode.name}</span>
			<span class="symbol-detail">${symbolNode.detail}</span>
		</span>
		<span class="diagnostic"></span>
		<span class="quick-nav"></span>
	  </div>
	  <div class="outline-children"></div>
	`;

	const childrenContainer = container.querySelector('.outline-children') as HTMLDivElement;

	symbolNode.children.forEach(child => {
		const element = renderSymbolNode(child, depth+1);
		childrenContainer.appendChild(element);
	});

	const expandBtn = container.querySelector('.expand-btn') as HTMLSpanElement;
	expandBtn.addEventListener('click', event => {
		event.stopPropagation();
		container.dataset.expand = (container.dataset.expand === 'true' ? 'false' : 'true');
	});

	const label = container.querySelector('.outline-label') as HTMLSpanElement;
	label.addEventListener('click', () => {
		input.stopSearch();
		vscode.postMessage({
			type: 'goto',
			data: {
				position: symbolNode.selectionRange.start,
			}
		} as GotoMsg);
	});


	mutObserver.observe(container, mutObserverConfig);

	return container;
}

function mutationCallback(mutationsList: MutationRecord[], observer: MutationObserver) {
	// observe data-set change
	mutationsList.filter(mutation => mutation.type === 'attributes').forEach(mutation => {
		const element = mutation.target as HTMLDivElement;
		
		switch (mutation.attributeName) {
		case 'data-detail':
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			element.querySelector('.symbol-detail')!.textContent = element.dataset.detail || '';
			break;
		case 'data-expand': {
			const depth = +(element?.style.getPropertyValue('--depth') || '0') + 1;
			
			if (depth > maxDepth) {
				element.classList.toggle('expand', false);
				break;
			}
			element.classList.toggle('expand', element.dataset.expand === 'true');
			break;
		}
		case 'data-inview':
			element.classList.toggle('in-view', element.dataset.inview === 'true');
			break;
		case 'data-focus':
			element.classList.toggle('focus', element.dataset.focus === 'true');
			break;
		case 'data-diagnostictype':
			element.classList.toggle('diagnostic-error', element.dataset['diagnostictype'] === 'error');
			element.classList.toggle('diagnostic-warning', element.dataset['diagnostictype'] === 'warning');
			break;
		case 'data-diagnosticcount': {
			const count = parseInt(element.dataset['diagnosticcount'] || '0');
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			element.querySelector('.diagnostic')!.textContent = 
				count > 9 ? '9+' : 
					count === -1 ? '' :
						count.toString();
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			element.querySelector('.diagnostic')!
				.setAttribute('title', 
					count === -1 ? 
						'Contains elements with problems' : 
						`${count} problems in this element`
				);
			element.classList.toggle('has-diagnostic', count !== 0);
			element.classList.toggle('diagnostic-in-children', count === -1);
			break;
		}}
	});
}

const mutObserverConfig = {
	attributes: true,
	attributeFilter: ['data-detail', 'data-expand', 'data-inview', 'data-focus', 'data-diagnostictype', 'data-diagnosticcount'],
	childList: false,
	subtree: false,
};

const mutObserver = new MutationObserver(mutationCallback);

class Toast{
	message: string;
	duration: number;
	element: HTMLDivElement;

	constructor(message: string, duration = 3000){
		this.message = message;
		this.duration = duration;
		this.element = document.createElement('div');
		this.element.classList.add('toast');
		this.element.innerText = message;
		document.body.appendChild(this.element);
		setTimeout(() => {
			this.remove();
		}, duration);
	}

	remove(){
		this.element.style.opacity = '0';
		setTimeout(() => {
			this.element.remove();
		}, 300);
	}
}
