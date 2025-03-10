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
	SemanticTokensBuilder,
	DecorationOptions,
	TextEditorDecorationType,
	window,
	ThemeColor,
	RenameProvider,
	WorkspaceEdit,
	CompletionItemProvider,
	CompletionContext,
	CompletionItem,
	CompletionList,
	CompletionItemKind,
	SnippetString,
	MarkdownString,
} from 'vscode';
import { config } from '../config';
import './parser';
import { RegionParser, RegionEntry, RegionType } from './parser';
import { $t } from '../../l10n/host';

type RegionPair = [RegionEntry, RegionEntry];

export class RegionProvider
implements DocumentSymbolProvider, FoldingRangeProvider, RenameProvider
{
	/** The document to parse */
	document: TextDocument | undefined;
	documentVersion = 0;

	/** The regions in the document */
	regions: RegionPair[] = [];
	/** The tags in the document */
	tags: RegionEntry[] = [];

	symbols: DocumentSymbol[] = [];

	folding: FoldingRange[] = [];

	// decorations: TextEditorDecorationType[] = [];
	keyDecorationType: TextEditorDecorationType;
	nameDecorationType: TextEditorDecorationType;
	descriptionDecorationType: TextEditorDecorationType;

	/** The string that marks the start of a region */
	startRegion = config.regionStart();
	/** The string that marks the end of a region */
	endRegion = config.regionEnd();
	/** The string that marks a tag */
	tag = config.tag();

	renamingRegionOrTag?: RegionPair | RegionEntry;

	onDidChangeFoldingRanges?: Event<void> | undefined;

	private parser: RegionParser;

	constructor() {
		const regionHighlightStyle = config.regionHighlightStyle();
		this.keyDecorationType = window.createTextEditorDecorationType(
			regionHighlightStyle?.key || {
				color: new ThemeColor('symbolIcon.keywordForeground'),
			}
		);
		this.nameDecorationType = window.createTextEditorDecorationType(
			regionHighlightStyle?.name || {
				color: new ThemeColor('symbolIcon.variableForeground'),
			}
		);
		this.descriptionDecorationType = window.createTextEditorDecorationType(
			regionHighlightStyle?.description || {}
		);
		this.parser = new RegionParser(
			new Map([
				[this.startRegion, RegionType.RegionOpen],
				[this.endRegion, RegionType.RegionClose],
				[this.tag, RegionType.Tag],
			])
		);
	}

	updateDecorationsConfig() {
		const regionHighlightStyle = config.regionHighlightStyle();
		this.keyDecorationType.dispose();
		this.keyDecorationType = window.createTextEditorDecorationType(
			regionHighlightStyle?.key || {
				color: new ThemeColor('symbolIcon.keywordForeground'),
			}
		);
		this.nameDecorationType.dispose();
		this.nameDecorationType = window.createTextEditorDecorationType(
			regionHighlightStyle?.name || {
				color: new ThemeColor('symbolIcon.variableForeground'),
			}
		);
		this.descriptionDecorationType.dispose();
		this.descriptionDecorationType = window.createTextEditorDecorationType(
			regionHighlightStyle?.description || {}
		);
	}

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
	update(document: TextDocument, cancel?: CancellationToken) {
		if (
			document !== this.document ||
      document.version !== this.documentVersion
		) {
			this.document = document;
			this.documentVersion = document.version;
			this.parseDocument(cancel);
		}
	}

	/**
   * Parse the document and update the regions and tags arrays
   * @param document
   */
	parseDocument(cancel?: CancellationToken) {
		if (!this.document) return;

		this.startRegion = config.regionStart();
		this.endRegion = config.regionEnd();
		this.tag = config.tag();
		this.parser = new RegionParser(
			new Map([
				[this.startRegion, RegionType.RegionOpen],
				[this.endRegion, RegionType.RegionClose],
				[this.tag, RegionType.Tag],
			])
		);

		this.clear();
		const unpaired: RegionEntry[] = [];
		const regions: RegionPair[] = [];
		const tags: RegionEntry[] = [];

		for (let i = 0; i < this.document.lineCount; i++) {
			if (cancel && cancel.isCancellationRequested) {
				return;
			}
			const line = this.document.lineAt(i);
			if (line.isEmptyOrWhitespace) continue;
			const match = this.matchLine(line.text, i);
			if (!match) continue;

			if (match.type.value !== RegionType.RegionClose && match.identifier) {
				(match.type.value === RegionType.Tag ? tags : unpaired).push(match);
				continue;
			}
			// for unnamed end tags, use the last unpaired start tag, otherwise find the matching start tag
			let startIndex = unpaired.length - 1;
			if (match.identifier) {
				startIndex = -1;
				for (let j = unpaired.length - 1; j >= 0; j--) {
					if (unpaired[j].identifier?.value === match.identifier.value) {
						startIndex = j;
						break;
					}
				}
				// if no matching start tag is found, skip this end tag
				if (startIndex === -1) continue;
			}

			const startTag = unpaired[startIndex];
			if (!startTag) continue;
			unpaired.splice(startIndex, 1);

			regions.push([startTag, match]);
		}
		this.regions = regions;
		this.tags = tags;
		this.updateSymbols();
		this.updateFolding();
		this.updateDecorations();
	}

	/**
   * Update the symbols array from the regions and tags arrays
   */
	updateSymbols() {
		for (const region of this.regions) {
			const identifierToken = region[0].identifier;
			if (!identifierToken) continue;

			const symbol = new DocumentSymbol(
				identifierToken.value,
				`__om_Region__${region[0].description?.value ?? ''}`,
				// As we can not extend the SymbolKind enum,
				// here we use `SymbolKind.Number` as a replacement.
				// And store the real SymbolKind in the detail field.
				SymbolKind.Number,
				// Full range of the region is
				// the range that spans from the start of the first region
				// to the end of the second region
				region[0].range.union(region[1].range),
				// Selection range is the range that should be revealed when this symbol is selected
				// It is the range of the identifier token if it exists, otherwise the range of the first region
				identifierToken?.range ?? region[0].range
			);
			this.symbols.push(symbol);
		}

		for (const tag of this.tags) {
			const identifierToken = tag.identifier;
			if (!identifierToken) continue;
			const symbol = new DocumentSymbol(
				identifierToken.value,
				`__om_Tag__${tag.description?.value ?? ''}`,
				SymbolKind.Number,
				tag.range,
				identifierToken.range ?? tag.range
			);
			this.symbols.push(symbol);
		}
	}

	/**
   * Update the folding ranges from the regions array
   */
	updateFolding() {
		for (const region of this.regions) {
			this.folding.push(
				new FoldingRange(region[0].range.start.line, region[1].range.end.line)
			);
		}
	}

	updateDecorations() {
		const editor = window.activeTextEditor;
		if (!editor) return;
		const keyDecorations: DecorationOptions[] = [];
		const nameDecorations: DecorationOptions[] = [];
		const descriptionDecorations: DecorationOptions[] = [];
		for (const region of this.regions) {
			if (!region[0].identifier) continue;

			const getHoverMessage = (index: 0 | 1) => {
				const hoverMessage = new MarkdownString();

				hoverMessage.supportThemeIcons = true;
				hoverMessage.isTrusted = true;

				hoverMessage.appendCodeblock(
					`(Region) ${region[0].identifier?.value || region[1].identifier?.value}`,
					'js'
				);
				hoverMessage.appendMarkdown(
					`${
						region[0].description?.value || region[1].description?.value || ''
					}\n\n`
				);

				const GoToPairArgs = encodeURIComponent(
					JSON.stringify({
						pos: region[1 - index].identifier?.range.start,
					})
				);

				const command = `command:outline-map.context.goToLocation?${GoToPairArgs}`;


				const commandLabel = $t(
					'Jump to {anchor} ({line})',
					{
						anchor: index === 0 ? $t('end') : $t('start'),
						line: $t('Line {line}', {
							line: region[1 - index].identifier?.range.start.line,
						}),
					}
				);

				hoverMessage.appendMarkdown(
					`[${commandLabel}](${command})`
				);

				return hoverMessage;
			};

			const hoverMessage1 = getHoverMessage(0);
			const hoverMessage2 = getHoverMessage(1);

			keyDecorations.push(
				{ range: region[0].type.range, hoverMessage: hoverMessage1 },
				{ range: region[1].type.range, hoverMessage: hoverMessage2 }
			);
			nameDecorations.push({
				range: region[0].identifier.range,
				hoverMessage: hoverMessage1,
			});
			if (region[1].identifier) {
				nameDecorations.push({
					range: region[1].identifier.range,
					hoverMessage: hoverMessage2,
				});
			}
			if (region[0].description) {
				descriptionDecorations.push({ range: region[0].description.range });
			}
			if (region[1].description) {
				descriptionDecorations.push({ range: region[1].description.range });
			}
		}
		// this.tags.forEach((tag) => {
		for (const tag of this.tags) {
			if (!tag.identifier) continue;

			const hoverMessage = new MarkdownString();

			hoverMessage.supportThemeIcons = true;
			hoverMessage.isTrusted = true;

			hoverMessage.appendCodeblock(`(Tag) ${tag.identifier.value}`, 'js');
			hoverMessage.appendMarkdown(`${tag.description?.value || ''}\n\n`);

			keyDecorations.push({ range: tag.type.range, hoverMessage });
			nameDecorations.push({
				range: tag.identifier.range,
				hoverMessage,
			});
			if (tag.description) {
				descriptionDecorations.push({ range: tag.description.range });
			}
		}

		editor.setDecorations(this.keyDecorationType, keyDecorations);
		editor.setDecorations(this.nameDecorationType, nameDecorations);
		editor.setDecorations(
			this.descriptionDecorationType,
			descriptionDecorations
		);
	}

	provideFoldingRanges(
		document: TextDocument,
		context: FoldingContext,
		token: CancellationToken
	): ProviderResult<FoldingRange[]> {
		if (token.isCancellationRequested) return;
		this.update(document, token);
		return this.folding;
	}

	provideDocumentSymbols(
		document: TextDocument,
		token: CancellationToken
	): ProviderResult<DocumentSymbol[] | SymbolInformation[]> {
		if (token.isCancellationRequested) return;
		this.update(document, token);
		return this.symbols;
	}

	prepareRename(
		document: TextDocument,
		position: Position,
		token: CancellationToken
	): ProviderResult<Range | { placeholder: string; range: Range }> {
		if (token.isCancellationRequested) return;
		this.update(document, token);

		const findRegion = (regions: RegionPair[]) => {
			for (const region of regions) {
				if (region[0].identifier?.range.contains(position)) {
					return [region[0], region[0].identifier.range] as const;
				}
				if (region[1].identifier?.range.contains(position)) {
					return [region[1], region[1].identifier.range] as const;
				}
			}
		};

		const findTag = (tags: RegionEntry[]) => {
			for (const tag of tags) {
				if (tag.identifier?.range.contains(position)) {
					return [tag, tag.identifier.range] as const;
				}
			}
		};
		const [regionOrTag, rangeToRename] =
      findTag(this.tags) || findRegion(this.regions) || [];
		if (regionOrTag) {
			this.renamingRegionOrTag = regionOrTag;
			return rangeToRename;
		}
		throw new Error('No region or tag found at position');
	}

	provideRenameEdits(
		document: TextDocument,
		position: Position,
		newName: string,
		token: CancellationToken
	): ProviderResult<WorkspaceEdit> {
		if (token.isCancellationRequested) return;
		const regionOrTag = this.renamingRegionOrTag;
		if (!regionOrTag) return;
		const edit = new WorkspaceEdit();

		if (regionOrTag instanceof Array) {
			if (regionOrTag[0].identifier) {
				edit.replace(document.uri, regionOrTag[0].identifier.range, newName);
			}
			if (regionOrTag[1].identifier) {
				edit.replace(document.uri, regionOrTag[1].identifier.range, newName);
			}
		} else {
			if (regionOrTag.identifier) {
				edit.replace(document.uri, regionOrTag.identifier.range, newName);
			}
		}

		this.renamingRegionOrTag = undefined;
		return edit;
	}

	/**
   * Match a line against the region and tag patterns
   * @param line the line to match
   * @param n the line number
   * @returns a RegionMatch object if the line matches, otherwise null
   */
	private matchLine(line: string, n: number): RegionEntry | null {
		this.parser.parse(line, n);
		const result = this.parser.emit();
		return result;
	}
}

/**
 * A completion provider for regions and tags
 */
export class RegionCompletionProvider implements CompletionItemProvider {
	startRegion = config.regionStart();
	endRegion = config.regionEnd();
	tag = config.tag();
	addCommentLineCommand = {
		command: 'editor.action.addCommentLine',
		title: 'Toggle Line Comment',
	};

	get regionCompletionItem() {
		const insertText = new SnippetString(
			`${this.startRegion} $\{1:name} $\{2:description}\n$0\n${this.endRegion} $\{1:name}`
		);
		const mdDocument = new MarkdownString(
			$t('Insert a region pair to fold the content between them')
		);
		const detail = $t('Code Region (Outline-Map)');
		mdDocument.appendCodeblock(
			`${this.startRegion} name description\n...\n${this.endRegion} name`
		);
		const item = new CompletionItem(this.startRegion, CompletionItemKind.Issue);
		item.insertText = insertText;
		item.documentation = mdDocument;
		item.detail = detail;
		return item;
	}

	get tagCompletionItem() {
		const insertText = new SnippetString(
			`${this.tag} $\{1:name} $\{2:description}`
		);
		const mdDocument = new MarkdownString(
			$t('Insert a tag to mark a specific point in the source code')
		);
		const detail = $t('Code Tag (Outline-Map)');
		mdDocument.appendCodeblock(`${this.tag} name description`);
		const item = new CompletionItem(this.tag, CompletionItemKind.Issue);
		item.insertText = insertText;
		item.documentation = mdDocument;
		item.detail = detail;
		return item;
	}

	provideCompletionItems(
		document: TextDocument,
		position: Position,
		token: CancellationToken,
		context: CompletionContext
	): ProviderResult<CompletionItem[] | CompletionList<CompletionItem>> {
		if (token.isCancellationRequested) return;
		const currentLine = document.lineAt(position.line).text.trim();

		const regionCompletionItem = this.regionCompletionItem;
		const tagCompletionItem = this.tagCompletionItem;

		if (
			this.startRegion.startsWith(currentLine) ||
      this.tag.startsWith(currentLine)
		) {
			regionCompletionItem.command = this.addCommentLineCommand;
			tagCompletionItem.command = this.addCommentLineCommand;
		}

		return [regionCompletionItem, tagCompletionItem];
	}
}
