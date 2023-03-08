import { workspace } from 'vscode';

function getConfig(key: string, section = 'outline-map') {
	return workspace.getConfiguration(section)?.get(key);
}

export const config = {
	/** User specified color. */
	color: () => getConfig('color') as { [key: string]: string },
	/** When to expand the outline. */
	follow: () => getConfig('follow') as 'cursor' | 'viewport' | 'manual',
	/** Hide specified items. */
	hiddenItem: () => getConfig('hiddenItem') as string[],
	/** The initial maximum depth of the outline. */
	defaultMaxDepth: () => getConfig('defaultMaxDepth') as number,
	customFont: () => getConfig('customFont') as string,
	customCSS: () => getConfig('customCSS') as string,
	debug: () => getConfig('debug') as boolean,
};