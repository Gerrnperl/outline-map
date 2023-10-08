/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Mode } from '../input';

export class InputArea extends HTMLElement {
	private _textarea: HTMLTextAreaElement;
	private _mode: Mode = Mode.Nav;
	private init() {
		const TEMPLATE = /*html*/`
			<textarea
				name="input-text"
				id="input-text"
				style="height: calc(var(--vscode-font-size) + 10px);overflow-y:hidden;"
			></textarea>
			<div class="highlight"></div>
			<style>${STYLE}</style>
		`;
		this.innerHTML = TEMPLATE;
	}

	constructor() {
		super();

		this.init();

		this._textarea = this.querySelector('textarea')!;
		this._textarea.addEventListener('input', ()=>{
			this.adjustHeight();
			this.updateMode();
		});
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
		this._textarea.style.height = this._textarea.scrollHeight + 'px';
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
		console.log(this._mode);
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
	
	/**
	 * clear the input area and set the mode to the given mode
	 * @param mode 
	 */
	clear(mode: Mode = Mode.Nav) {
		this._textarea.value = mode as string;
		this.adjustHeight();
		this.mode = mode;
	}

}

const STYLE = /*css*/`
#input-text {
	background: transparent;
	color: var(--vscode-input-foreground);
	padding: 3px 0 3px 6px;
	font-size: 14px;
	width: 100%;
	resize: none;
}

#input-text:focus {
	outline: none;
}
`;