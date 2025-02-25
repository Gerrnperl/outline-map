import * as l10n from '@vscode/l10n';
declare const __l10nBundle: { [key: string]: string } | null;

if (__l10nBundle) {
	l10n.config({
		contents: __l10nBundle,
	});
}

export const $t = l10n.t;