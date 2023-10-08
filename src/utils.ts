
export const SymbolKindList = [
	'File', 'Module', 'Namespace', 'Package', 'Class', 'Method', 
	'Property', 'Field', 'Constructor', 'Enum', 'Interface', 
	'Function', 'Variable', 'Constant', 'String', 'Number', 
	'Boolean', 'Array', 'Object', 'Key', 'Null', 'EnumMember', 
	'Struct', 'Event', 'Operator', 'TypeParameter'
];

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