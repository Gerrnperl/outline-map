/**
 * @file utils.ts
 * @description utils. Include some common functions, types and constants.
 */

/**
 * SymbolKindStr is a string version of vscode.SymbolKind and
 * extended with custom symbol kinds.
 */
export type SymbolKindStr = 
	'File' | 'Module' | 'Namespace' | 'Package' | 'Class' | 'Method' | 
	'Property' | 'Field' | 'Constructor' | 'Enum' | 'Interface' | 
	'Function' | 'Variable' | 'Constant' | 'String' | 'Number' | 
	'Boolean' | 'Array' | 'Object' | 'Key' | 'Null' | 'EnumMember' | 
	'Struct' | 'Event' | 'Operator' | 'TypeParameter' |
	// custom symbol kinds, not in vscode.SymbolKind
	'__om_Tag__' | '__om_Region__';

/**
 * SymbolKindList is a list of all symbol kinds.
 * used for iterating all symbol kinds.
 */
export const SymbolKindList: SymbolKindStr[] = [
	'File', 'Module', 'Namespace', 'Package', 'Class', 'Method', 
	'Property', 'Field', 'Constructor', 'Enum', 'Interface', 
	'Function', 'Variable', 'Constant', 'String', 'Number', 
	'Boolean', 'Array', 'Object', 'Key', 'Null', 'EnumMember', 
	'Struct', 'Event', 'Operator', 'TypeParameter',
	// custom symbol kinds, not in vscode.SymbolKind
	'__om_Tag__', '__om_Region__',
];

/**
 * ColorTable is a map from SymbolKindStr and other keys to vscode.ThemeColor.
 */
export const ColorTable: { [key in SymbolKindStr | 'visibleRange' | 'focusingItem']: string } = {
	File: 'symbolIcon.fileForeground',
	Module: 'symbolIcon.moduleForeground',
	Namespace: 'symbolIcon.namespaceForeground',
	Package: 'symbolIcon.packageForeground',
	Class: 'symbolIcon.classForeground',
	Method: 'symbolIcon.methodForeground',
	Property: 'symbolIcon.propertyForeground',
	Field: 'symbolIcon.fieldForeground',
	Constructor: 'symbolIcon.constructorForeground',
	Enum: 'symbolIcon.enumeratorForeground',
	Interface: 'symbolIcon.interfaceForeground',
	Function: 'symbolIcon.functionForeground',
	Variable: 'symbolIcon.variableForeground',
	Constant: 'symbolIcon.constantForeground',
	String: 'symbolIcon.stringForeground',
	Number: 'symbolIcon.numberForeground',
	Boolean: 'symbolIcon.booleanForeground',
	Array: 'symbolIcon.arrayForeground',
	Object: 'symbolIcon.objectForeground',
	Key: 'symbolIcon.keyForeground',
	Null: 'symbolIcon.nullForeground',
	EnumMember: 'symbolIcon.enumeratorMemberForeground',
	Struct: 'symbolIcon.structForeground',
	Event: 'symbolIcon.eventForeground',
	Operator: 'symbolIcon.operatorForeground',
	TypeParameter: 'symbolIcon.typeParameterForeground',
	__om_Tag__: 'symbolIcon.om_TagForeground',
	__om_Region__: 'symbolIcon.om_RegionForeground',
	visibleRange: 'outlineMap.visibleRangeBackground',
	focusingItem: 'outlineMap.focusingItemBackground',
};

// eslint-disable-next-line @typescript-eslint/ban-types
export function debounce(func: Function, delay: number){
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let timer: any = null;
	
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return function(this: any, ...args: any[]){
		if (timer){
			clearTimeout(timer);
		}
		timer = setTimeout(() => {
			func.apply(this, args);
		}, delay);
	};
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function throttle(func: Function, limit: number){
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

// Camel case to dash case
export function camelToDash(str: string): string {
	return str.replace(/([a-zA-Z])(?=[A-Z])/g, '$1-').toLowerCase();
}

/**
 * get the icon name of a SymbolKind
 * @param kind 
 * @returns 
 */
export function mapIcon(kind: SymbolKindStr): string {
	let iconName = `symbol-${camelToDash(kind)}`;
	// custom symbol
	if (kind === '__om_Region__') {
		iconName = 'folder';
	}
	if (kind === '__om_Tag__') {
		iconName = 'tag';
	}
	return iconName;
}