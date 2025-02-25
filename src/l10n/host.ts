import { l10n } from 'vscode';
export function injectL10nBundle() {
	const l10nBundle = l10n.bundle;
	const str = l10nBundle ? JSON.stringify(l10nBundle) : 'undefined';
	return `
    <script>
      const __l10nBundle = ${str};
    </script>
  `;
}

export const $t = l10n.t;