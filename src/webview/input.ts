/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { SwitchButton } from './components/switchButton';
import { InputArea } from './components/inputArea';
import { SymbolKindStr, throttle } from '../utils';

customElements.define('switch-button', SwitchButton);
customElements.define('input-area', InputArea);

export enum Mode {
	Nav = '',
	Normal = '/',
	Regex = '=',
	Fuzzy = '?',
}

const QuickNavKey = '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

const InputContainerHTML = /*html*/`
<div id="input-container">
	<div id="input-area-container">
		<input-area
			name="input-text"
			id="input-area"
			style="height: auto;overflow-y:hidden; display: flex;font-size: var(--vscode-font-size);flex: 1;"
		></input-area>
		<div class="input-controllers" id="inner-controllers">
			<switch-button id="regex-switch" name="regex" icon="regex" highlight
				desc="Regex mode(=)"
			></switch-button>
			<switch-button id="fuzzy-switch" name="fuzzy" icon="zap" highlight
				desc="Fuzzy mode(?)"
			></switch-button>
		</div>
	</div>
	<div class="input-controllers" id="outer-controllers">
		<switch-button id="nav-switch" name="nav"
			icon-off="clear-all" icon-on="search"
			desc="Nav mode, use arrow keys to navigate"
		></switch-button>
	</div>
</div>
`;

export class Input {
	private inputArea: InputArea;
	private regexSwitch: SwitchButton;
	private fuzzySwitch: SwitchButton;
	private navSwitch: SwitchButton;
	private static mode: Mode = Mode.Nav;
	private searcher: Searcher | null = null;
	private lastSearch = '';
	private quickNavs : Map<string, TreeNode> | null = null;
	constructor() {
		// todo: better tips
		const container = (new DOMParser())
			.parseFromString(InputContainerHTML, 'text/html')
			.body
			.firstElementChild as HTMLDivElement;

		this.inputArea = container.querySelector<InputArea>('#input-area')!;

		this.regexSwitch = container.querySelector<SwitchButton>('#regex-switch')!;
		this.fuzzySwitch = container.querySelector<SwitchButton>('#fuzzy-switch')!;
		this.navSwitch = container.querySelector<SwitchButton>('#nav-switch')!;
		container.addEventListener('s-change', (event) => {
			const name: string = (event as CustomEvent).detail.name;
			const map: Record<string, Mode>	= {
				regex: Mode.Regex,
				fuzzy: Mode.Fuzzy,
				nav: Mode.Nav,
			};
			this.autoSwitchMode(map[name] as Mode);
			if (name !== 'nav') {
				this.search();
			}
			this.inputArea.focus();
		});

		document.body.insertBefore(container, document.body.firstElementChild);

		this.initKeyEvent();
		this.initInputEvent();
	}

	start() {
		this.inputArea.focus();
		this.inputArea.clear(Mode.Normal);
	}

	intoQuickNav() {
		this.enterNav();
		if (!this.searcher) return;
		this.quickNavs = this.searcher.setQuickNavKey();
	}

	/**
	 * Init key event when press key in input area.
	 * This handler includes:
	 * - keyboard navigation in nav mode
	 * - finish search input and switch to quick nav mode
	 * - finish search and return to normal mode
	 * - keyboard navigation in quick nav mode
	 */
	private initKeyEvent() {
		this.inputArea.addEventListener('keydown', (e) => {
			if (this.quickNavs) {
				this.jump(e.key);
			}
			else if (this.inputArea.mode === Mode.Nav) {
				this.nav(e.key);
			}
			else if (e.key === 'Enter') {
				this.intoQuickNav();
			}
			else if (e.key === 'Escape') {
				this.stopSearch();
			}
		});
	}

	/**
	 * Init input event when input in input area.
	 * This handler includes:
	 * - start search mode
	 * - search when input
	 * - stop search when input is empty
	 */
	private initInputEvent() {
		this.inputArea.addEventListener('input', () => {
			const value = this.inputArea.value;
			if (this.quickNavs) {
				this.inputArea.clear();
				return;
			}
			if (value.length === 0) {
				this.stopSearch();
				return;
			}
			if (this.inputArea.mode === Mode.Nav) {
				this.enterNav();
				return;
			}
			if (this.inputArea.value.length === 2 && this.inputArea.value[1] === '@') {
				// todo: open symbol kind picker
			}
			this.exitNav();
			this.search();
		});
	}

	/**
	 * Search when input in input area.
	 */
	private search() {
		const value = this.inputArea.value;
		const pattern = this.inputArea.searchText;
		const outlineRoot = document.querySelector<HTMLDivElement>('#outline-root')!;
		outlineRoot.classList.toggle('searching', true);
		// When adding at the end, we can reuse the last search result to improve performance
		// As the most common case is adding at the end, this may improve performance a lot
		// In regex mode, we can't reuse the last search result.
		const reuse = value.startsWith(this.lastSearch) && this.inputArea.mode !== Mode.Regex;
		const config = {
			pattern,
			mode: this.inputArea.mode || Mode.Normal,
			filter: this.inputArea.filteredSymbol,
		};
		if (this.searcher && reuse) {
			this.searcher.search(config);
		}
		else {
			this.searcher = new Searcher(outlineRoot, config);
		}
		this.lastSearch = value;
	}

	/**
	 * Automatically change mode according to current mode and input.
	 * Return true if mode is set to given mode.
	 * / = --?--> ?, ? --?--> /
	 * / ? --=--> =, = --=--> /
	 * / = ? --x--> x, x --x--> /
	 * 
	 * @param mode 
	 */
	private autoSwitchMode(mode: Mode): boolean {
		this.fuzzySwitch.active = mode === Mode.Fuzzy && mode !== this.inputArea.mode;
		this.regexSwitch.active = mode === Mode.Regex && mode !== this.inputArea.mode;
		if (mode === Mode.Nav && this.inputArea.mode !== Mode.Nav) {
			this.stopSearch();
			return false;
		}
		this.exitNav();
		if (mode === Mode.Normal || this.inputArea.mode === mode) {
			// to Normal mode
			this.inputArea.mode = Mode.Normal;
			return mode === Mode.Normal;
		}
		// to Regex or Fuzzy mode
		this.inputArea.mode = mode;
		return true;
	}

	// Do some preparation when enter nav mode
	private enterNav() {
		this.navSwitch.active = true;
		this.fuzzySwitch.active = false;
		this.regexSwitch.active = false;
		this.inputArea.clear();
	}

	// Do some preparation when exit nav mode
	private exitNav() {
		this.navSwitch.active = false;
	}

	private nav = throttle((key: string) => {
		let focusingItem = document.body.querySelector('.focus');
		if (!focusingItem) {
			focusingItem = document.body.querySelector('.outline-node');
		}
		switch (key) {
		case 'ArrowUp': {
			let prev = focusingItem?.previousElementSibling;
			if (!prev) {
				prev = focusingItem?.parentElement?.parentElement;
			}
			(prev?.querySelector('.outline-label') as HTMLDivElement)?.click();
			break;
		}
		case 'ArrowDown': {
			let next = focusingItem?.nextElementSibling;
			while (!next && focusingItem) {
				focusingItem = focusingItem?.parentElement?.parentElement as HTMLDivElement | null;
				next = focusingItem?.nextElementSibling as HTMLDivElement | null;
			}
			(next?.querySelector('.outline-label') as HTMLDivElement)?.click();
			break;
		}
		case 'ArrowLeft': {
			const parent = focusingItem?.parentElement?.parentElement;
			(parent?.querySelector('.outline-label') as HTMLDivElement)?.click();
			break;
		}
		case 'ArrowRight': {
			const children = focusingItem?.querySelector('.outline-children') as HTMLDivElement | null;
			if (children?.children.length) {
				((children.children[0] as HTMLDivElement)?.querySelector('.outline-label') as HTMLDivElement)?.click();
			}
			break;
		}}
		setTimeout(() => {
			this.inputArea.focus();
		}, 90);
	},100);

	private jump(key: string) {
		this.stopSearch();
		if(!this.quickNavs) return;
		const node = this.quickNavs.get(key);
		if (!node) return;
		const element = node.element;
		element.querySelector<HTMLElement>('.outline-label')?.click();
		this.quickNavs = null;
		return;
	}

	stopSearch() {
		this.searcher?.deconstruct();
		this.searcher = null;
		this.lastSearch = '';
		this.enterNav();
		document.querySelector('#outline-root')?.classList.toggle('searching', false);
	}

}

class TreeNode {
	children: TreeNode[];
	parent: TreeNode | null;
	element: HTMLElement;
	private matched = true;
	private matchedChildren = true;

	constructor(element: HTMLDivElement, parent?: TreeNode) {
		this.element = element;
		this.parent = parent || null;
		this.children = [];
		parent?.addChild(this);
		const children = element.querySelector('.outline-children');
		if (!(children?.children)) return;
		for (const child of Array.from(children.children)) {
			new TreeNode(child as HTMLDivElement, this);
		}
	}

	deconstruct() {
		this.children.forEach((child) => child.deconstruct());
		this.children = [];
		this.parent = null;
		this.element.classList.remove('matched');
		this.element.classList.remove('matched-children');
		this.element.dataset.quickNav = '';
		const name = this.element.querySelector('.symbol-name');
		if (name) {
			name.innerHTML = name.textContent || '';
		}
		const keyLabel = this.element.querySelector<HTMLSpanElement>('.quick-nav');
		if (keyLabel) {
			keyLabel.style.display = 'none';
			keyLabel.innerHTML = '';
		}
	}


	setQuickNavKey(quickNavs: Map<string, TreeNode>) {
		if (quickNavs.size >= QuickNavKey.length) return;
		if (this.matched) {
			const key = QuickNavKey[quickNavs.size];
			quickNavs.set(key, this);
			this.element.dataset.quickNav = key;
			const keyLabel = this.element.querySelector<HTMLSpanElement>('.quick-nav');
			if (keyLabel) {
				keyLabel.style.display = 'inline-block';
				keyLabel.innerHTML = key;
			}
		}
		if (this.matchedChildren) {
			this.children.forEach((child) => child.setQuickNavKey(quickNavs));
		}
	}

	match(search: RegExp | string, symbol: SymbolKindStr | null = null) {
		if (!this.matched) return false;
		if (symbol && symbol !== this.element.dataset.kind) {
			this.matched = false;
			this.element.classList.toggle('matched', false);
			return false;
		}
		const name = this.element.querySelector('.symbol-name')!;
		if (!name.textContent) return false;
		if (search instanceof RegExp) {
			const matched = name.textContent.match(search);
			if (matched) {
				name.innerHTML = name.textContent?.replace(search, `<b>${matched[0]}</b>`) || '';
			}
			this.matched = !!matched;
		}
		else {
			// use automatic case insensitive
			// if there is uppercase in search, use case sensitive
			const isCaseSensitive = search.toLowerCase() !== search;
			let matched;
			let str;
			if (isCaseSensitive) {
				matched = name.textContent.indexOf(search);
				str = search;
			}
			else {
				matched = name.textContent.toLowerCase().indexOf(search.toLowerCase());
				str = name.textContent.substring(matched, matched + search.length);
			}
			
			if (matched !== -1) {
				name.innerHTML = name.textContent?.replace(str, `<b>${str}</b>`) || '';
			}
			this.matched = matched !== -1;
		}
		
		this.element.classList.toggle('matched', this.matched);
		return this.matched;
	}

	setMatchedChildren(matched: boolean) {
		this.matchedChildren = matched;
		this.element.classList.toggle('matched-children', matched);
	}

	addChild(child: TreeNode) {
		this.children.push(child);
	}

}

interface SearchConfig {
	pattern: string,
	mode: Mode,
	filter: SymbolKindStr | null,
}

class Searcher {
	private tree: TreeNode;
	private searchReg: RegExp | string | null = null;

	constructor(root: HTMLDivElement, init: SearchConfig) {
		this.tree = new TreeNode(root);
		this.search(init);
	}

	search(config: SearchConfig) {
		const isCaseSensitive = config.pattern.toLowerCase() !== config.pattern;
		switch (config.mode) {
		case Mode.Normal:
			this.searchReg = config.pattern;
			break;
		case Mode.Regex:
			try {
				this.searchReg = new RegExp(config.pattern, isCaseSensitive ? 'u' : 'ui');
			} catch (e) {
				this.searchReg = null;
			}
			break;
		case Mode.Fuzzy:
			this.searchReg = new RegExp(config.pattern.split('').join('.*?'), isCaseSensitive ? 'u' : 'ui');
			break;
		default:
			this.searchReg = null;
			break;
		}
		if (this.searchReg) {
			this.searchTree(this.tree, this.searchReg, config.filter);
		}
	}

	private searchTree(node: TreeNode, search: RegExp | string, symbol: SymbolKindStr | null = null): boolean {
		const matched = node.match(search, symbol);
		let matchedChildren = false;
		for (const child of node.children) {
			const matched = this.searchTree(child, search, symbol);
			matchedChildren = matchedChildren || matched;
		}
		node.setMatchedChildren(matchedChildren);
		return matched || matchedChildren;
	}

	setQuickNavKey() {
		const quickNavs = new Map<string, TreeNode>();
		this.tree.setQuickNavKey(quickNavs);
		return quickNavs;
	}

	deconstruct() {
		this.tree.deconstruct();
	}
}

