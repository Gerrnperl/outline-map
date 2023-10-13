import {
	CancellationToken,
	DocumentSymbol,
	ProviderResult,
	SymbolInformation,
	TextDocument,
	type DocumentSymbolProvider,
	Range,
	SymbolKind,
	FoldingRangeProvider,
	Event,
	FoldingContext,
	FoldingRange,
	SemanticTokensLegend,
	DocumentSemanticTokensProvider,
	Position,
	SemanticTokens,
	SemanticTokensBuilder} from 'vscode';
import { config } from './config';

interface Region {
	key: Token;
	keyEnd: Token;
	name: Token;
	nameEnd?: Token;
	description?: Token;
	start: Range;
	end: Range;
}

interface Tag {
	key: Token;
	name: Token;
	description?: Token;
	at: Range;
}

interface RegionMatch {
	type: 'region-start' | 'region-end' | 'tag',
	key: Token;
	name?: Token;
	description?: Token;
}

interface Token {
	type: string,
	text: string,
	range: Range,
}

export const tokensLegend = new SemanticTokensLegend(
	[
		'keyword', // for region start, region end, and tag
		'decorator', // for region name and tag name
		'comment', // for region description and tag description
	], ['declaration', 'definition']);


export class RegionProvider implements DocumentSymbolProvider, FoldingRangeProvider, DocumentSemanticTokensProvider {

	/** The document to parse */
	document: TextDocument | undefined;
	documentVersion = 0;

	/** The regions in the document */
	regions: Region[] = [];
	/** The tags in the document */
	tags: Tag[] = [];

	symbols: DocumentSymbol[] = [];

	folding: FoldingRange[] = [];

	semanticTokens: SemanticTokens | null = null;


	/** The string that marks the start of a region */
	startRegion = config.regionStart();
	/** The string that marks the end of a region */
	endRegion = config.regionEnd();
	/** The string that marks a tag */
	tag = config.tag();



	onDidChangeFoldingRanges?: Event<void> | undefined;

	/**
	 * Clear the regions and tags arrays
	 */
	clear() {
		this.regions = [];
		this.tags = [];
		this.symbols = [];
		this.folding = [];
	}

	/**
	 * if the document has changed, update the regions and tags arrays
	 * @param document 
	 */
	update(document: TextDocument) {
		if (document !== this.document || document.version !== this.documentVersion) {
			this.document = document;
			this.documentVersion = document.version;
			this.parseDocument();
		}
	}

	/**
	 * Parse the document and update the regions and tags arrays
	 * @param document 
	 */
	parseDocument() {
		if (!this.document) return;
		this.startRegion = config.regionStart();
		this.endRegion = config.regionEnd();
		this.tag = config.tag();
		this.clear();
		const unpaired: Tag[] = [];
		for (let i = 0; i < this.document.lineCount; i++) {
			const line = this.document.lineAt(i);
			if (line.isEmptyOrWhitespace) continue;
			const match = this.matchLine(line.text, i);
			if (!match) continue;

			if (match.type !== 'region-end' && match.name) {
				(match.type === 'tag' ? this.tags : unpaired).push({ 
					name: match.name,
					at: line.range,
					key: match.key,
					description: match.description,
				});
				continue;
			}
			// for unnamed end tags, use the last unpaired start tag, otherwise find the matching start tag
			let startIndex = unpaired.length - 1;
			if (match.name) {
				for (let j = unpaired.length - 1; j >= 0; j--) {
					if (unpaired[j].name === match.name) {
						startIndex = j;
						break;
					}
				}
				// if no matching start tag is found, skip this end tag
				if (startIndex === -1) continue;
			}

			const startTag = unpaired[startIndex];
			unpaired.splice(startIndex, 1);

			this.regions.push({
				key: startTag.key,
				keyEnd: match.key,
				name: startTag.name,
				nameEnd: match.name,
				start: startTag.at,
				end: line.range,
				description: startTag.description,
			});
		}
		this.updateSymbols();
		this.updateFolding();
		this.updateSemanticTokens();
	}

	/**
	 * Update the symbols array from the regions and tags arrays
	 */
	updateSymbols() {
		for (const region of this.regions) {
			const symbol = new DocumentSymbol(
				region.name.text,
				`__om_Region__${region.description?.text || ''}`,
				SymbolKind.Number,
				new Range(region.start.start, region.end.end),
				new Range(region.name.range.start, region.name.range.end),
			);
			this.symbols.push(symbol);
		}

		for (const tag of this.tags) {
			const symbol = new DocumentSymbol(
				tag.name.text,
				`__om_Tag__${tag.description?.text || ''}`,
				SymbolKind.Number,
				tag.at,
				tag.name.range,
			);
			this.symbols.push(symbol);
		}
	}

	/**
	 * Update the folding ranges from the regions array
	 */
	updateFolding() {
		for (const region of this.regions) {
			this.folding.push(new FoldingRange(region.start.start.line, region.end.end.line));
		}
	}

	updateSemanticTokens() {
		const tokensBuilder = new SemanticTokensBuilder(tokensLegend);
		for (const region of this.regions) {
			tokensBuilder.push(
				region.key.range,
				'keyword',
			);
			tokensBuilder.push(
				region.name.range,
				'decorator',
			);
			if (region.description) {
				tokensBuilder.push(
					region.description.range,
					'comment',
				);
			}
			tokensBuilder.push(
				region.keyEnd.range,
				'keyword',
			);
			if (region.nameEnd) {
				tokensBuilder.push(
					region.nameEnd.range,
					'decorator',
				);
			}
		}
		for (const tag of this.tags) {
			tokensBuilder.push(
				tag.key.range,
				'keyword',
			);
			tokensBuilder.push(
				tag.name.range,
				'decorator',
			);
			if (tag.description) {
				tokensBuilder.push(
					tag.description.range,
					'comment',
				);
			}
		}
		this.semanticTokens = tokensBuilder.build();
	}

	provideFoldingRanges(document: TextDocument, context: FoldingContext, token: CancellationToken): ProviderResult<FoldingRange[]> {
		this.update(document);
		return this.folding;
	}

	provideDocumentSymbols(document: TextDocument, token: CancellationToken)
		: ProviderResult<DocumentSymbol[] | SymbolInformation[]> {
		this.update(document);
		return this.symbols;
	}

	provideDocumentSemanticTokens(document: TextDocument, token: CancellationToken): ProviderResult<SemanticTokens> {
		this.update(document);
		return this.semanticTokens;
	}

	/**
	 * Match a line against the region and tag patterns
	 * @param line the line to match
	 * @param n the line number
	 * @returns a RegionMatch object if the line matches, otherwise null
	 */
	private matchLine(line: string, n: number): RegionMatch | null {
		return this.matchStart(line, n) || this.matchEnd(line, n) || this.matchTag(line, n);
	}

	/**
	 * Match a line against the region start pattern
	 * @param line the line to match
	 * @param n the line number
	 * @returns 
	 */
	private matchStart(line: string, n: number): RegionMatch | null {
		const startPattern = new RegExp(`${this.startRegion}[\\t ]+(?<name>[\\S]*)[\\t ]*(?<description>.*)`);
		const matchStart = line.match(startPattern);
		if (!matchStart) {
			return null;
		}
		return this.getTokens(matchStart, this.startRegion, n, 'region-start');
	}

	private matchEnd(line: string, n: number): RegionMatch | null {
		const endPattern = new RegExp(`${this.endRegion}([\t ]+(?<name>[\\S]*))?`);
		const matchEnd = line.match(endPattern);
		if (!matchEnd) {
			return null;
		}
		return this.getTokens(matchEnd, this.endRegion, n, 'region-end');
	}

	private matchTag(line: string, n: number): RegionMatch | null {
		const tagPattern = new RegExp(`${this.tag}[\\t ]+(?<name>[\\S]*)[\\t ]*(?<description>.*)`);
		const matchTag = line.match(tagPattern);
		if (!matchTag) {
			return null;
		}
		return this.getTokens(matchTag, this.tag, n, 'tag');
	}

	/**
	 * Get the tokens from a match
	 * @param match  the match to get tokens from
	 * @param key 
	 * @param n line number
	 * @param type 
	 * @returns 
	 */
	private getTokens(match: RegExpMatchArray, key: string, n: number, type: RegionMatch['type']): RegionMatch {
		let index = match.index || 0; // the beginning of syntax
		const keyToken = {
			type: 'key',
			text: key,
			range: new Range(
				new Position(n, index),
				new Position(n, index + key.length)
			)
		};
		const result: RegionMatch = {
			type,
			key: keyToken,
		};
		const name = match.groups?.name || null;
		if (!name) {
			return result;
		}
		index = (match.index || 0) + match[0].indexOf(match.groups?.name || '', key.length);
		result.name = {
			type: 'name',
			text: name,
			range: new Range(
				new Position(n, index),
				new Position(n, index + name.length)
			)
		};
		const description = match.groups?.description || null;
		if (!description) {
			return result;
		}
		index = (match.index || 0) + match[0].lastIndexOf(description);
		result.description = {
			type: 'description',
			text: description,
			range: new Range(
				new Position(n, index),
				new Position(n, index + description.length)
			)
		};

		return result;
	}

}