import { workspace } from 'vscode';

function getConfig(key: string, section = 'outline-map') {
	return workspace.getConfiguration(section)?.get(key);
}

export const config = {
	//#region DEPRECATED
	/** 
	 * @deprecated
	 * TODO: REMOVE THIS
	 * User specified color. 
	 */
	color: () => getConfig('color') as { [key: string]: string },
	//#endregion DEPRECATED
	/** When to expand the outline. */
	follow: () => getConfig('follow') as 'cursor' | 'viewport' | 'manual',
	expand: () => getConfig('expand') as 'cursor' | 'viewport' | 'manual' | 'expanded',
	/** Hide specified items. */
	hiddenItem: () => getConfig('hiddenItem') as string[],
	/** The initial maximum depth of the outline. */
	defaultMaxDepth: () => getConfig('defaultMaxDepth') as number,
	customFont: () => getConfig('customFont') as string,
	customCSS: () => getConfig('customCSS') as string,
	debug: () => getConfig('debug') as boolean,
	regionEnabled: () => getConfig('enabled', 'outline-map.region') as boolean,
	findRefEnabled: () => getConfig('enabled', 'outline-map.findRef') as boolean,
	findRefUseFindImpl: () => getConfig('uesFindImpl', 'outline-map.findRef') as boolean,
	regionRegisterSymbolProvider: () => getConfig('registerSymbolProvider', 'outline-map.region') as boolean,
	regionHighlight: () => getConfig('highlight', 'outline-map.region') as boolean,
	regionHighlightStyle: () => getConfig('highlightStyle', 'outline-map.region') as {
		key?: object,
		name?: object,
		description?: object,
	},
	regionStart: () => getConfig('startRegion', 'outline-map.region') as string,
	regionEnd: () => getConfig('endRegion', 'outline-map.region') as string,
	tag: () => getConfig('tag', 'outline-map.region') as string,
	workspaceEnabled: () => getConfig('enabled', 'outline-map.workspace') as boolean,
	fixedFiles: () => getConfig('fixedFiles', 'outline-map.workspace') as number,
	closeFileTimeout: () => getConfig('closeFileTimeout', 'outline-map.workspace') as number,
};