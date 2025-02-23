import { Range } from 'vscode';

/**
 * Token types in a region/tag
 * 
 * A region or tag is composed of three parts:
 * - leading keyword
 * - tag identifier
 * - description
 */
export enum RegionTokenType {
  Leading,
  Identifier,
  Description,
}

/**
 * A token in a region/tag
 */
type RegionToken = {
  type: RegionTokenType;
  text: string;
  range: Range;
};

export enum RegionType {
  Invalid,
  RegionOpen,
  RegionClose,
  Tag,
}

export interface RegionEntry {
  type: RegionType;
  identifier: string;
  description: string;
  tokens: RegionToken[];
	range: Range;
}

/**
 * State representation of the region parser state machine
 * 
 */
type RegionParserState =
  | {
      done: false;
      next: (this: RegionParser, char: string) => RegionParserState;
    }
  | {
      done: true;
    };

/**
 * A parser for regions and tags
 * 
 * The parser is a state machine that parses regions and tags
 * 
 * A region or tag is composed of three parts:
 * - leading keyword
 * - tag identifier
 * - description
 * 
 * The leading keyword is a keyword that indicates the start of a region or tag,
 * and it could exist at the end of other strings without space separation.
 * 
 * The tag identifier is a string that identifies the region or tag. 
 * EndRegion tag closes a region according to the tag identifier,
 * or it closes the last opened region if tag identifier is empty.
 * 
 * The description is a string that describes the region or tag,
 * all characters after the tag identifier are considered as the description.
 * 
 */
export class RegionParser {
	private readonly leading: Map<string, RegionType>;
	private state: RegionParserState;
	private pendingState: RegionParserState | null = null;
	private buffer = '';
	private result: RegionEntry;
	private currentLine = 0;
	private tokenStart = 0;
	private tokenEnd = 0;
	constructor(leading: Map<string, RegionType>) {
		this.leading = leading;
		this.state = {
			done: false,
			next: this.parseLeading,
		};
		this.buffer = '';
		this.result = {
			type: RegionType.Invalid,
			identifier: '',
			description: '',
			tokens: [],
			range: new Range(0, 0, 0, 0),
		};
	}

	/**
	 * Parse a string input
	 * 
	 * @param input Input chars, could be a line or a part of a line
	 * @param line Optional line number to indicate the output token range
	 */
	parse(input: string, line?: number) {
		this.currentLine = line ?? 0;
		for (const char of input) {
			this.tokenEnd++;
			if (this.state.done) {
				break;
			}
			this.state = this.state.next.call(this, char);
		}
	}

	/**
	 * Finish parsing and emit the result
	 * 
	 * @returns The parsed region/tag
	 */
	emit() {
		this.parse('\n');
		const result = this.result;
		this.reset();
		return result;
	}

	/**
	 * Reset the parser state
	 */
	reset() {
		this.state = {
			done: false,
			next: this.parseLeading,
		};
		this.buffer = '';
		this.result = {
			type: RegionType.Invalid,
			identifier: '',
			description: '',
			tokens: [],
			range: new Range(0, 0, 0, 0),
		};
		this.currentLine = 0;
		this.tokenStart = 0;
		this.tokenEnd = 0;
	}

	/**
	 * Set a leading keyword
	 * 
	 * @param leadingString Leading keyword string
	 * @param type Leading keyword type
	 */
	setLeading(leadingString: string, type: RegionType): void;
	/**
	 * Set leading keywords
	 * 
	 * @param leading Leading keywords
	 */
	setLeading(leading: Map<string, RegionType>): void;
	setLeading(leading: Map<string, RegionType> | string, type?: RegionType): void {
		if (typeof leading === 'string' && type !== undefined) {
			this.leading.set(leading, type);
			return;
		}
		if (typeof leading === 'string') {
			throw new Error('Invalid arguments');
		}
		this.leading.clear();
		for (const [key, value] of leading) {
			this.leading.set(key, value);
		}
		this.reset();
	}

	/**
	 * Stage a field value for the current region entry
	 * 
	 * @param field The field to be staged in the result
	 * @param value The value associated with the field
	 */
	private stage<K extends keyof RegionEntry>(
		field: K,
		value: RegionEntry[K]
	): void {
		this.result[field] = value;
		const tokenType = (() => {
			switch (field) {
			case 'type':
				return RegionTokenType.Leading;
			case 'identifier':
				return RegionTokenType.Identifier;
			case 'description':
				return RegionTokenType.Description;
			default:
				throw new Error('Unreachable');
			}
		})();
		this.result.tokens.push({
			type: tokenType,
			text: this.buffer,
			range: new Range(this.currentLine, this.tokenStart, this.currentLine, this.tokenEnd - 1),
		});

		this.result.range = this.mergeRanges(this.result.tokens);

		this.tokenStart = this.tokenEnd;
	}

	private mergeRanges(tokens: RegionToken[]): Range {
		if (tokens.length === 0) {
			return new Range(0, 0, 0, 0);
		}
		const start = tokens[0].range.start;
		const end = tokens[tokens.length - 1].range.end;
		return new Range(start, end);
	}

	private isSpace(char: string): boolean {
		return [' ', '\t', '\n', '\r', '\f', '\v'].includes(char);
	}

	private isNewline(char: string): boolean {
		return ['\n', '\r'].includes(char);
	}

	private eof(): RegionParserState {
		return {
			done: true,
		};
	}

	private parseLeading(char: string): RegionParserState {
		const escapeState = this.handleEscape(char, this.parseLeading);
		if (escapeState) {
			return escapeState;
		}
		if (this.isSpace(char)) {
			const matchedLeading = Array.from(this.leading.keys()).find((leading) => {
				return this.buffer.endsWith(leading);
			});
			if (!matchedLeading) {
				this.buffer = '';
				this.tokenStart = this.tokenEnd;
				return {
					done: false,
					next: this.parseLeading,
				};
			}
			const type = this.leading.get(matchedLeading) ?? RegionType.Invalid;
			this.stage('type', type);
			this.buffer = '';
			return {
				done: false,
				next: this.parseTag,
			};
		} else {
			this.buffer += char;
			return {
				done: false,
				next: this.parseLeading,
			};
		}
	}

	private parseTag(char: string): RegionParserState {
		const escapeState = this.handleEscape(char, this.parseTag);
		if (escapeState) {
			return escapeState;
		}
		if (this.isSpace(char)) {
			this.stage('identifier', this.buffer);
			this.buffer = '';
			return {
				done: false,
				next: this.parseDescription,
			};
		}
		this.buffer += char;
		return {
			done: false,
			next: this.parseTag,
		};
	}

	private parseDescription(char: string): RegionParserState {
		if (this.isNewline(char)) {
			this.stage('description', this.buffer);
			this.buffer = '';
			return this.eof();
		}
		this.buffer += char;
		return {
			done: false,
			next: this.parseDescription,
		};
	}

	private handleEscape(
		char: string,
		callback: (char: string) => RegionParserState
	): RegionParserState | void {
		if (char === '\\') {
			this.pendingState = {
				done: false,
				next: callback,
			};
			return {
				done: false,
				next: this.parseEscape,
			};
		}
		return;
	}

	private parseEscape(char: string): RegionParserState {
		this.buffer += char;
		if (this.pendingState) {
			const currentState = this.pendingState;
			this.pendingState = null;
			return currentState;
		}
		return this.eof();
	}
}
