enum Mode {
	Nav = '',
	Normal = '/',
	Regex = '=',
	Fuzzy = '?',
}

const QuickNavKey = '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export class Input {
	private inputArea: HTMLTextAreaElement;
	private regexSwitch: HTMLButtonElement;
	private fuzzySwitch: HTMLButtonElement;
	private navSwitch: HTMLButtonElement;
	private static mode: Mode = Mode.Normal;
	private searcher: Searcher | null = null;
	private lastSearch = '';
	private quickNavs : Map<string, TreeNode> | null = null;
	constructor() {
		// todo: better tips
		const inputContainerHTML = /*html*/`
			<div id="input-container">
				<div id="input-area">
					<textarea
						name="input-text"
						id="input-text"
						style="height: calc(var(--vscode-font-size) + 10px);overflow-y:hidden;"
					></textarea>
					<div class="input-controllers" id="inner-controllers"></div>
				</div>
				<div class="input-controllers" id="outer-controllers">
			</div>
		`;

		const container = (new DOMParser())
			.parseFromString(inputContainerHTML, 'text/html')
			.body
			.firstElementChild as HTMLDivElement;

		this.inputArea = container.querySelector('#input-text') as HTMLTextAreaElement;

		const inner = container.querySelector('#inner-controllers') as HTMLDivElement;
		const outer = container.querySelector('#outer-controllers') as HTMLDivElement;

		this.regexSwitch = this.initSwitch({
			name: 'regex', mode: Mode.Regex, icon: 'regex', inner: true,
			desc: 'Regex mode(=)'
		});
		this.fuzzySwitch = this.initSwitch({
			name: 'fuzzy', mode: Mode.Fuzzy, icon: 'zap', inner: true, 
			desc: 'Fuzzy mode(?)'
		});
		this.navSwitch = this.initSwitch({
			name: 'nav', mode: Mode.Nav, icon: 'clear-all', inner: false, 
			desc: 'Nav mode, use arrow keys to navigate'
		});

		inner.appendChild(this.regexSwitch);
		inner.appendChild(this.fuzzySwitch);
		outer.appendChild(this.navSwitch);

		document.body.insertBefore(container, document.body.firstElementChild);

		this.initKeyEvent();
		this.initInputEvent();
	}

	start() {
		this.inputArea.focus();
		this.inputArea.value = Mode.Normal;
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
			else if (Input.mode === Mode.Nav) {
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
		this.inputArea.addEventListener('input', (e) => {
			const input = e.target as HTMLTextAreaElement;
			const value = input.value;
			if (this.quickNavs) {
				input.value = '';
				return;
			}
			if (value.length === 0 && Input.mode !== Mode.Nav) {
				this.stopSearch();
				return;
			}
			const mode = input.value[0];
			if (!['/', '=', '?'].includes(mode)) {
				this.enterNav();
				return;
			}
			this.exitNav();
			Input.mode = mode as Mode;
			input.style.height = '0px';
			input.style.height = (input.scrollHeight) + 'px';
			this.search();
		});
	}

	/**
	 * Search when input in input area.
	 */
	private search() {
		const value = this.inputArea.value;
		const pattern = value.slice(1);
		const outlineRoot = document.querySelector('#outline-root') as HTMLDivElement;
		outlineRoot.classList.toggle('searching', true);
		// When adding at the end, we can reuse the last search result to improve performance
		// As the most common case is adding at the end, this may improve performance a lot
		// In regex mode, we can't reuse the last search result.
		const reuse = value.startsWith(this.lastSearch) && Input.mode !== Mode.Regex;
		if (this.searcher && reuse) {
			this.searcher.search(pattern);
		}
		else {
			this.searcher = new Searcher(outlineRoot, pattern);
		}
		this.lastSearch = value;
	}

	/**
	 * Init a mode switch button.
	 * Return the button element.
	 * 
	 * @param config a config object
	 * @param config.name name of the mode, used as class name
	 * @param config.mode mode of the button
	 * @param config.icon icon, the codicon name, without codicon- prefix
	 * @param config.inner whether the button is in the input area
	 * @param config.desc description of the mode, will be shown when hover
	 * @returns 
	 */
	private initSwitch(config: {
		name: string,
		mode: Mode, 
		icon: string, 
		inner: boolean, 
		desc: string
	}) {
		// mode switch button/*style*/`
		const switchEle = document.createElement('button');
		switchEle.classList.add(
			'input-switch',
			config.inner ? 'inner-switch' : 'outer-switch',
			`${config.name}-switch`,
		);
		switchEle.innerHTML = /*html*/`<span class="codicon codicon-${config.icon}"></span>`;
		switchEle.title = config.desc;
		switchEle.addEventListener('click', () => {
			this.autoSwitchMode(config.mode);
			if (config.mode !== Mode.Nav) {
				this.search();
			}
			this.inputArea.focus();
		});
		return switchEle;
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
		this.fuzzySwitch.classList.toggle('active', mode === Mode.Fuzzy && mode !== Input.mode);
		this.regexSwitch.classList.toggle('active', mode === Mode.Regex && mode !== Input.mode);
		if (mode === Mode.Nav && Input.mode !== Mode.Nav) {
			this.stopSearch();
			return false;
		}
		this.exitNav();
		if (mode === Mode.Normal || Input.mode === mode) {
			// to Normal mode
			Input.mode = Mode.Normal;
			this.inputArea.value = '/' + this.inputArea.value.slice(1);
			return mode === Mode.Normal;
		}
		// to Regex or Fuzzy mode
		Input.mode = mode;
		this.inputArea.value = Input.mode as string + this.inputArea.value.slice(1);
		return true;
	}

	// Do some preparation when enter nav mode
	private enterNav() {
		const navIcon = this.navSwitch.querySelector('.codicon') as HTMLSpanElement;
		navIcon.classList.toggle('codicon-clear-all', false);
		navIcon.classList.toggle('codicon-search', true);
		this.fuzzySwitch.classList.toggle('active', false);
		this.regexSwitch.classList.toggle('active', false);
		Input.mode = Mode.Nav;
		this.inputArea.value = '';
		this.inputArea.style.height = '0px';
		this.inputArea.style.height = (this.inputArea.scrollHeight) + 'px';
	}

	// Do some preparation when exit nav mode
	private exitNav() {
		const navIcon = this.navSwitch.querySelector('.codicon') as HTMLSpanElement;
		navIcon.classList.toggle('codicon-clear-all', true);
		navIcon.classList.toggle('codicon-search', false);
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
		(element.querySelector('.outline-label') as HTMLElement)?.click();
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

	static getMode() {
		return Input.mode;
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
		const keyLabel = this.element.querySelector('.quick-nav') as HTMLSpanElement | null;
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
			const keyLabel = this.element.querySelector('.quick-nav') as HTMLSpanElement | null;
			if (keyLabel) {
				keyLabel.style.display = 'inline-block';
				keyLabel.innerHTML = key;
			}
		}
		if (this.matchedChildren) {
			this.children.forEach((child) => child.setQuickNavKey(quickNavs));
		}
	}

	match(search: RegExp | string) {
		if (!this.matched) return false;
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const name = this.element.querySelector('.symbol-name')!;
		if (search instanceof RegExp) {
			const matched = name.textContent?.match(search);
			if (matched) {
				name.innerHTML = name.textContent?.replace(search, `<b>${matched[0]}</b>`) || '';
			}
			this.matched = !!matched;
		}
		else {
			const matched = name.textContent?.indexOf(search);
			if (matched !== -1) {
				name.innerHTML = name.textContent?.replace(search, `<b>${search}</b>`) || '';
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

class Searcher {
	private tree: TreeNode;
	private searchReg: RegExp | string | null = null;

	constructor(root: HTMLDivElement, searchInit: string) {
		this.tree = new TreeNode(root);
		this.search(searchInit);
	}

	search(search: string) {
		switch (Input.getMode()) {
		case Mode.Normal:
			this.searchReg = search;
			break;
		case Mode.Regex:
			try {
				this.searchReg = new RegExp(search);
			} catch (e) {
				this.searchReg = null;
			}
			break;
		case Mode.Fuzzy:
			this.searchReg = new RegExp(search.split('').join('.*?'));
			break;
		default:
			this.searchReg = null;
			break;
		}
		if (this.searchReg) {
			this.searchTree(this.tree, this.searchReg);
		}
	}

	private searchTree(node: TreeNode, search: RegExp | string): boolean {
		const matched = node.match(search);
		let matchedChildren = false;
		for (const child of node.children) {
			const matched = this.searchTree(child, search);
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

// eslint-disable-next-line @typescript-eslint/ban-types
function throttle(func: Function, limit: number){
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let inThrottle: any = false;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return function(this: any, ...args: any[]){
		if (!inThrottle){
			func.apply(this, args);
			inThrottle = true;
			setTimeout(() => inThrottle = false, limit);
		}
	};
}