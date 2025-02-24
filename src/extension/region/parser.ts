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

export interface RegionToken<T extends RegionTokenType> {
  type: T;
  value: T extends RegionTokenType.Leading
		? RegionType
		: string;
  text: string;
  range: Range;
}

export enum RegionType {
  Invalid,
  RegionOpen,
  RegionClose,
  Tag,
}

export interface RegionEntry {
  type: RegionToken<RegionTokenType.Leading>;
  identifier?: RegionToken<RegionTokenType.Identifier>;
  description?: RegionToken<RegionTokenType.Description>;
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
	private result: Partial<RegionEntry>;
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
		this.result = {};
	}

	/**
   * Parse a string input
   *
   * @param input Input chars, could be a line or a part of a line
   * @param line Optional line number to indicate the output token range
   */
	parse(input: string, line?: number) {
		this.currentLine = line ?? this.currentLine;
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
		if (!result.type || result.type.value === RegionType.Invalid) {
			return null;
		}
		return result as Required<RegionEntry>;
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
		this.result = {};
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
	setLeading(
		leading: Map<string, RegionType> | string,
		type?: RegionType
	): void {
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
	private stage<K extends Exclude<keyof RegionEntry, 'range'>>(
		field: K,
		value: K extends 'type' ? RegionType : string
	): void {
		const range = new Range(
			this.currentLine,
			this.tokenStart,
			this.currentLine,
			this.tokenEnd - 1
		);
		switch (field) {
		case 'type':
			this.result.type = {
				type: RegionTokenType.Leading,
				value: value as RegionType,
				text: this.buffer,
				range,
			};
			break;
		case 'identifier':
			this.result.identifier = {
				type: RegionTokenType.Identifier,
				value: value as string,
				text: this.buffer,
				range,
			};
			break;
		case 'description':
			this.result.description = {
				type: RegionTokenType.Description,
				value: value as string,
				text: this.buffer,
				range,
			};
			break;
		default:
			throw new Error(`Unhandled field: ${field}`);
		}
		this.result.range = this.mergeRanges([
			this.result.type,
			this.result.identifier,
			this.result.description,
		].filter(Boolean) as RegionToken<RegionTokenType>[]);
		this.tokenStart = this.tokenEnd;
	}

	private mergeRanges(tokens: RegionToken<RegionTokenType>[]): Range {
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

	/**
	 * **[state]** Leading keyword
	 * 
	 * Consume the next input character:
	 * - **SPACE**: 
	 * 	- if buffer does not end with a leading keyword, reset buffer and switch to `Leading keyword`
	 * 	- else emit `Leading keyword` and re-consume in `After leading keyword`
	 * - **otherwise**: append to buffer and switch to `Leading keyword`
 	 *
	 */
	private parseLeading(char: string): RegionParserState {
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
			this.tokenStart = this.tokenEnd - matchedLeading.length - 1;
			const type = this.leading.get(matchedLeading) ?? RegionType.Invalid;
			this.stage('type', type);
			this.buffer = '';
			return this.parseAfterLeading(char);
		}
		else {
			this.buffer += char;
			return {
				done: false,
				next: this.parseLeading,
			};
		}
	}

	/**
	 * **[state]** After leading keyword
	 * 
	 * Consume the next input character:
	 * - **SPACE**: continue consuming in `After leading keyword`
	 * - **NEWLINE**: emit `Invalid` and switch to `EOF`
	 * - **otherwise**: switch to `Tag`
	 *
	 */
	private parseAfterLeading(char: string): RegionParserState {
		if (this.isSpace(char)) {
			return {
				done: false,
				next: this.parseAfterLeading,
			};
		} 
		if (this.isNewline(char)) {
			return this.eof();
		}
		return this.parseIdentifier(char);
	}

	/**
	 * **[state]** Tag
	 * 
	 * Consume the next input character:
	 * - **SPACE**: emit `Identifier` and switch to `After identifier`
	 * - **otherwise**: append to buffer and continue consuming in `Identifier`
	 *
	 */
	private parseIdentifier(char: string): RegionParserState {
		const escapeState = this.handleEscape(char, this.parseIdentifier);
		if (escapeState) {
			return escapeState;
		}
		if (this.isSpace(char)) {
			this.stage('identifier', this.buffer);
			this.buffer = '';
			return this.parseAfterIdentifier(char);
		}
		this.buffer += char;
		return {
			done: false,
			next: this.parseIdentifier,
		};
	}

	/**
	 * **[state]** After Identifier
	 * 
	 * Consume the next input character:
	 * - **SPACE**: continue consuming in `After Identifier`
	 * - **NEWLINE**: emit `Invalid` and switch to `EOF`
	 * - **otherwise**: switch to `Description`
	 *
	 */
	private parseAfterIdentifier(char: string): RegionParserState {
		if (this.isSpace(char)) {
			return {
				done: false,
				next: this.parseAfterIdentifier,
			};
		}
		if (this.isNewline(char)) {
			return this.eof();
		}
		return this.parseDescription(char);
	}

	/**
	 * **[state]** Description
	 * 
	 * Consume the next input character:
	 * - **NEWLINE**:
	 * 	- if buffer is empty, emit `EOF` and switch to `EOF`
	 * 	- otherwise emit `Description` and switch to `EOF`
	 * - **otherwise**: append to buffer and continue consuming in `Description`
	 *
	 */
	private parseDescription(char: string): RegionParserState {
		if (this.isNewline(char)) {
			if (this.buffer.length === 0) {
				return this.eof();
			}
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
