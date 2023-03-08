enum Mode {
	Nav = '',
	Normal = '/',
	Regex = '=',
	Fuzzy = '?',
}

const QuickNavKey = '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export class Input {
	private inputEle: HTMLInputElement;
	private static mode: Mode = Mode.Normal;
	private searcher: Searcher | null = null;
	private lastSearch = '';
	private quickNavs : Map<string, TreeNode> | null = null;
	constructor() {
		this.inputEle = document.createElement('input');
		this.inputEle.type = 'text';
		this.inputEle.id = 'outline-input';
		// placeholder
		this.inputEle.title = '/: search; =: regex; ?: fuzzy;';
		document.body.appendChild(this.inputEle);
		this.inputEle.addEventListener('keydown', (e) => {
			switch (e.key) {
			case 'Enter':
				if (Input.mode !== Mode.Nav) {
					this.intoQuickNav();
				}
				break;
			case 'Escape':
				if (Input.mode !== Mode.Nav) {
					this.stopSearch();
				}
				break;
			default:
				if (this.quickNavs) {
					this.jump(e.key);
				}
				else if (Input.mode === Mode.Nav){
					this.nav(e.key);
				}
				break;
			}
		});
		this.inputEle.addEventListener('input', (e) => {
			const input = e.target as HTMLInputElement;
			const mode = input.value[0];
			if (mode === '/') {
				Input.mode = Mode.Normal;
			} else if (mode === '=') {
				Input.mode = Mode.Regex;
			} else if (mode === '?') {
				Input.mode = Mode.Fuzzy;
			} else {
				Input.mode = Mode.Nav;
				input.value = '';
				return;
			}
			if (input.value.length > 1) {
				document.querySelector('#outline-root')?.classList.toggle('searching', true);
				if (this.searcher && input.value.startsWith(`${Input.mode}${this.lastSearch}`)) {
					this.searcher.search(input.value.slice(1));
				}
				else {
					this.searcher = new Searcher(document.querySelector('#outline-root') as HTMLDivElement, input.value.slice(1));
				}
				this.lastSearch = input.value.slice(1);
			}
			else {
				this.stopSearch();
			}
		});
	}

	start() {
		this.inputEle.focus();
		this.inputEle.value = Mode.Normal;
	}

	intoQuickNav() {
		this.inputEle.value = '';
		Input.mode = Mode.Nav;
		if (!this.searcher) return;
		this.quickNavs = this.searcher.setQuickNavKey();
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
			this.inputEle.focus();
		}, 90);
	},100);

	private jump(key: string) {
		this.inputEle.value = Input.mode;
		if(!this.quickNavs) return;
		const node = this.quickNavs.get(key);
		if (!node) return;
		const element = node.element;
		(element.querySelector('.outline-label') as HTMLElement)?.click();
		this.stopSearch();
		return;
	}

	stopSearch() {
		this.searcher?.deconstruct();
		this.searcher = null;
		this.lastSearch = '';
		this.inputEle.value = Input.mode;
		this.quickNavs = null;
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