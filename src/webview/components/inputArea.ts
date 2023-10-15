/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { SymbolKindList, SymbolKindStr, camelToDash, mapIcon } from '../../utils';
import { Mode } from '../input';

export class InputArea extends HTMLElement {
	private _textarea: HTMLTextAreaElement;
	private _mode: Mode = Mode.Nav;

	private _filtering = false;

	private _filterEle: HTMLDivElement;

	private _filterFocusing = 0;

	private _filterList: HTMLDivElement;

	private symbolElements: HTMLLIElement[] = [];

	public filteredSymbol: SymbolKindStr | null = null;

	private init() {
		function symbolList() {
			return SymbolKindList.map(k => {
				return /*html*/`
					<li class="symbol-item" data-symbol="${k}">
						<span class="icon codicon codicon-${mapIcon(k)}" data-kind="${k}"></span>
						<span class="symbol-name">${camelToDash(k)}</span>
					</li>
				`;
			});
		}
		const TEMPLATE = /*html*/`
			<div id="symbol-filter">
				<span class="icon codicon codicon-pencil"></span>
			</div>
			<textarea
				name="input-text"
				id="input-text"
				style="height: calc(var(--vscode-font-size) + 10px);overflow-y:hidden;"
				title="Navigate to symbol by 🢐⬍🢒(append @ to filter symbols or /=? to search)"
			></textarea>
			<div class="highlight"></div>
			<div id="symbol-list">
				<ul>
					${symbolList().join('')}
				</ul>
			</div>
			<style>${STYLE}</style>
		`;
		this.innerHTML = TEMPLATE;
	}

	constructor() {
		super();

		this.init();

		this._textarea = this.querySelector('textarea')!;
		this._filterEle = this.querySelector('#symbol-filter')!;
		this._filterList = this.querySelector('#symbol-list')!;
		this.symbolElements = Array.from(this.querySelectorAll('.symbol-item'));
		this.symbolElements[0].classList.add('focused');
		this.symbolElements.forEach(ele => {
			ele.addEventListener('click', () => {
				this.setFilteredSymbol(ele.dataset.symbol! as SymbolKindStr);
				this._textarea.focus();
			});
		});

		this._textarea.addEventListener('keydown', (e) => {
			if (this.filtering) {
				// prevent the input from being handled by the parent
				e.stopPropagation();
				switch (e.key) {
				case 'ArrowDown':
					e.preventDefault();
					this.updateFocusing(1);
					break;
				case 'ArrowUp':
					e.preventDefault();
					this.updateFocusing(-1);
					break;
				case 'Enter':
					e.preventDefault();
					this.symbolElements[this._filterFocusing].click();
					break;
				}
			}

			if ((this.filtering || this.filteredSymbol) && this.searchText.length === 0
				&& ['Backspace', 'Delete'].includes(e.key)
			) {
				this.exitFiltering();
			}
		});
		this._textarea.addEventListener('input', (e)=>{
			this.adjustHeight();
			if (this.filtering) {
				this.filter(this.searchText);
			}
			if (this.filtering || this._textarea.value[0] === '@') {
				// prevent the input from being handled by the parent
				e.stopPropagation();
				e.preventDefault();
				this.filtering = true;
				return;
			}
			this.updateMode();
		});
	}

	setFilteredSymbol(symbol: SymbolKindStr) {
		this.filteredSymbol = symbol;
		this._filterEle.querySelector('.icon')!.className = 
			`icon codicon codicon-${mapIcon(this.filteredSymbol)}`;
		this._filterEle.title = `Search for ${this.filteredSymbol}`;
		this.filtering = false;
		this.filter('');
		this._textarea.value = '';
	}

	exitFiltering() {
		this.filtering = false;
		this.filter('');
		this._filterEle.querySelector('.icon')!.className =
			'icon codicon codicon-pencil';
		this._textarea.value = this.mode as string;
		this._filterEle.classList.toggle('active', false);
		this.filteredSymbol = null;
	}

	/**
	 * pass the focus to the inner textarea
	 */ 
	focus(options?: FocusOptions | undefined): void {
		this._textarea.focus(options);
	}

	/**
	 * adjust the height of the textarea to fit the content
	 */
	adjustHeight() {
		this._textarea.style.height = '0px';
		this._textarea.style.height = `calc(4px + ${this._textarea.scrollHeight}px)`;
	}


	/**
	 * Update the mode according to the first character of the input.
	 * If the first character is not '/', '?', or '=', 
	 * clear input and set the mode to 'nav'.
	 */
	private updateMode() {
		if (
			this._textarea.value.length > 0 && 
			['/', '?', '='].includes(this._textarea.value[0])
		) {
			this.mode = this._textarea.value[0] as Mode;
		}
		else {
			this.clear(Mode.Nav);
		}
	}

	
	/**
	 * clear the input area and set the mode to the given mode
	 * @param mode 
	 */
	clear(mode: Mode = Mode.Nav) {
		this._textarea.value = mode as string;
		this.adjustHeight();
		this.mode = mode;
	}

	private filter(pattern: string) {
		// fuzzy match
		const reg = new RegExp(pattern.split('').join('.*'));
		this.symbolElements.forEach(ele => {
			const dash = camelToDash(ele.dataset.symbol!);
			const hidden = !reg.test(dash);
			ele.classList.toggle('hidden', hidden);
			ele.dataset.hidden = hidden.toString();
		});
		this.updateFocusing();
	}

	/**
	 * update the index of the symbol that is being focused
	 * try to move the focus to the next visible symbol
	 * @param move the number of symbols to move, hidden symbols are ignored
	 * @param checkHidden whether to check if all symbols are hidden, 
	 * 						avoid checking when calling recursively
	 */
	private updateFocusing(move = 0, sign = 0, checkHidden = true) {
		const len = this.symbolElements.length;
		sign = move === 0 ? sign : Math.sign(move);
		if (checkHidden && this.querySelector('.symbol-item:not(.hidden)') === null) {
			return;
		}
		this.symbolElements[this._filterFocusing].classList.remove('focused');
		if (this.symbolElements[this._filterFocusing].dataset.hidden === 'true') {
			// (sign || 1) : 
			// automatically move to the "next" symbol if the current one is "turned to" hidden
			this._filterFocusing = (this._filterFocusing + (sign || 1) + len) % len;
			this.updateFocusing(move, sign, false);
			return;
		}
		if (move !== 0) {
			this._filterFocusing = (this._filterFocusing + sign + len) % len;
			// this.updateFocusing(move > 0 ? move - 1 : move + 1, false);
			this.updateFocusing(move - sign, sign, false);
			return;
		}
		// moved to expected position
		this.symbolElements[this._filterFocusing].classList.add('focused');
		this.symbolElements[this._filterFocusing].scrollIntoView({
			block: 'nearest',
		});
	}


	set value(value: string) {
		this._textarea.value = value;
		this.adjustHeight();
		this.updateMode();
	}

	get value(): string {
		return this._textarea.value;
	}

	get searchText(): string {
		return this._textarea.value.slice(1);
	}


	private set filtering(value: boolean) {
		this._filtering = value;
		if (value) {
			this._filterEle.classList.toggle('active', true);
		}
		this._filterList.classList.toggle('active', value);
	}

	private get filtering() {
		return this._filtering;
	}


	set mode(mode: Mode) {
		this._mode = mode;
		this._textarea.value = mode as string + this._textarea.value.slice(1);
		this.dispatchEvent(new CustomEvent('mode-change', {
			detail: {
				mode: this._mode,
			},
			bubbles: true,
		}));
	}

	get mode(): Mode {
		return this._mode;
	}

}

const STYLE = /*css*/`
#input-text {
	background: transparent;
	color: var(--vscode-input-foreground);
	padding: 3px 0 3px 6px;
	font-size: inherit;
	width: 100%;
	resize: none;
	line-break: anywhere;
}

#input-text:focus {
	outline: none;
}

div#symbol-list {
    position: absolute;
	display: none;
	top: calc(11px + 1em);
	min-width: 150px;
    left: 1em;
    background: var(--vscode-dropdown-background);
    border: 1px solid var(--vscode-menu-border);
    color: var(--vscode-dropdown-foreground);
    border-radius: 3px;
    box-shadow: 0 3px 7px 0 rgba(0, 0, 0, .13), 0 1px 2px 0 rgba(0, 0, 0, .11);
	max-height: calc(100vh - 32px);
    overflow: auto;
}

div#symbol-list.active {
	display: block;
}

#symbol-list ul{
	list-style-type: none;
}

#symbol-list .symbol-item {
	display: flex;
	padding: 2px 2px 2px 5px;
	align-items: center;
	gap: 5px;
	font-size: var(--vscode-font-size);
}

#symbol-list .symbol-item.hidden {
	display: none;
}
#symbol-list .symbol-item.focused {
	background: var(--vscode-list-hoverBackground);
}

#symbol-list .symbol-item:hover {
	background: var(--vscode-list-hoverBackground);
}

#symbol-list span.symbol-name {
    font-family: var(--vscode-font-family);
}

div#symbol-filter {
    position: absolute;
    left: 13px;
    top: 9px;
    display: none;
    align-items: center;
    height: 1rem;
    width: 1rem;
    background: var(--vscode-inputOption-activeBackground);
    padding: 1px;
    justify-content: center;
    border-radius: 3px;
}

div#symbol-filter.active {
	display: flex;
}

div#symbol-filter.active ~ #input-text {
	text-indent: calc(1rem + 5px);
}
`;