:::mermaid
flowchart LR


	subgraph webview
		direction LR
		subgraph outline-HTML
			direction LR
			icon{{icon}}
			color{{color}}
			label{{name}}
			children-visibility{{children-visibility}}
			self-visibility{{self-visibility}}
			scrollbarRange{{scrollbarRange}}
			editingPosition{{editingPosition}}
			diagnostics-h{{diagnostics: hint, info, warning, error}}
		end
		subgraph outline-tree
			direction LR
			type{{type}} o--o icon & color
			name{{name}} o--o label
			open{{open}} o--o children-visibility
			display{{display}} o--o self-visibility
			highlight{{highlight}} o--o scrollbarRange
			focus{{focus}} o--o editingPosition
			diagnostics{{diagnostics}} o--o diagnostics-h
			children{{children}}
			parent{{parent}}
		end
		subgraph symbolIndexes
			index ==> symbol
		end
		children & parent --> outline-HTML
		build-tree -.-> outline-tree
		build-tree -.-> symbolIndexes
		scroll-tree --> symbolIndexes
		update-tree --> outline-tree & symbolIndexes
		show-diagnostics
		symbol ---- outline-tree
	end
	subgraph vscode
		document[window.activeTextEditor?.document]
	end
	message-port((message-port)) --type:rebuild,outline-tree--o build-tree
	message-port --type:scroll,range--o scroll-tree
	message-port --type:update,changes--o update-tree
	message-port --type:diagnostics,diagnostics--o show-diagnostics
	subgraph extension
		old_outlineTreeRoot
		diff
		subgraph OutlineProvider
			rebuild ==> OutlineTree
			scroll
			update-diagnostics
			document --> edit

		end
		rebuild --> init
		subgraph OutlineTree
			outlineTreeRoot
			buildOutline
			init -.OutlineTreeRoot.-> rebuild & outlineTreeRoot
		end

		SymbolNode>SymbolNode]
	end
	edit ==> OutlineTree -.-> old_outlineTreeRoot
	init -.OutlineTreeRoot.-> edit
	OutlineTree & old_outlineTreeRoot --> diff
	edit --o diff
	update-diagnostics <--> languages.getDiagnostics
	update-diagnostics --diagnostics--o message-port
	diff --changes--o message-port
	rebuild --OutlineTreeRoot--o message-port
	scroll --range--o message-port
	subgraph vscode
		direction TB
		document[window.activeTextEditor?.document]
		languages.getDiagnostics
		subgraph vscode-event[event]
			direction LR
			event-switch-tab([window.onDidChangeActiveTextEditor]) --event.document --o rebuild
			event-scroll([window.onDidChangeTextEditorVisibleRanges]) --event.visibleRanges--o scroll
			event-edit([workspace.onDidChangeTextDocument]) --o edit
			event-diagnostics([languages.onDidChangeDiagnostics]) --uri--o update-diagnostics
		end
		subgraph command
			get-symbol[[vscode.executeDocumentSymbolProvider]]
			goto[[editor.action.goToLocations]]
		end
	end

	subgraph extension
		subgraph OutlineProvider
			#init-event --o vscode-event
		end
	end
	init --Document.uri--symbol--o get-symbol --> buildOutline --x SymbolNode --> init

:::
