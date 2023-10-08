/* eslint-disable @typescript-eslint/no-non-null-assertion */

export class SwitchButton extends HTMLElement {
	private _button: HTMLButtonElement;
	private _icon: HTMLSpanElement;
	private _active = false;

	private iconOff: string | null;
	private iconOn: string | null;


	private highlight = true;

	// If not, the state should be changed by the parent
	private auto = false;
	private name: string;

	private init() {
		const desc = this.getAttribute('desc') || 'default';
		const TEMPLATE = /*html*/`
			<button
				class="switch-button input-switch ${this.name}-switch"
				title="${desc}"
			>
				<span
					class="icon codicon codicon-${this.iconOff}"
				></span>
			</button>
			<style>${STYLE}</style>
		`;
		// this.attachShadow({ mode: 'open' });
		// this.shadowRoot!.innerHTML = TEMPLATE;
		this.innerHTML = TEMPLATE;
	}

	constructor() {
		super();

		this.iconOff = this.getAttribute('icon-off') || this.getAttribute('icon') || null;
		this.iconOn = this.getAttribute('icon-on') || null;
		this.highlight = this.hasAttribute('highlight');
		this.auto = this.hasAttribute('auto');
		this.name = this.getAttribute('name') || 'default';
		
		this.init();
		
		this._button = this.querySelector('button')!;
		this._icon = this.querySelector('span')!;
		this._button.addEventListener('click', () => {
			if (this.auto) {
				this.active = !this.active;
			}
			this.dispatchEvent(new CustomEvent('s-change', { 
				detail: {
					active: this.active,
					name: this.name,
				},
				bubbles: true 
			}));
		});
	}

	public get active(): boolean {
		return this._active;
	}

	public set active(value: boolean) {
		this._active = value;
		if (this.iconOn && this.iconOff) {
			this._icon.classList.toggle(`codicon-${this.iconOn}`, this._active);
			this._icon.classList.toggle(`codicon-${this.iconOff}`, !this._active);
		}
		if (this.highlight) {
			this._button.classList.toggle('active', this._active);
		}
	}
}

const STYLE = /*css*/`
.input-switch {
	width: 18px;
	flex: 0 0 18px;
	height: 18px;
	border-radius: 3px;
	padding: 1px;
	margin-left: 2px;
	display: flex;
	justify-content: center;
	align-items: center;
	background: transparent;
	color: var(--vscode-editorWidget-foreground);
	cursor: pointer;
}

.input-switch:hover {
	background: var(--vscode-inputOption-hoverBackground);
}
.input-switch.active {
	background: var(--vscode-inputOption-activeBackground);
	color: var(--vscode-inputOption-activeForeground);
}
`;