# Outline Map

EN | [中文](README_ZH_CN.md)

![overview](screenshots/overview.png)

A visual, interactive outline map that combines the clarity of the outline with the intuitive overview of the minimap. Enhanced version of vscode built-in outline.

![version](https://img.shields.io/visual-studio-marketplace/v/gerrnperl.outline-map?color=8bf7c7&logo=visualstudio&style=flat-square)
![installs](https://img.shields.io/visual-studio-marketplace/i/gerrnperl.outline-map?color=56b6c2&logo=visualstudiocode&style=flat-square)
![rating](https://img.shields.io/visual-studio-marketplace/stars/gerrnperl.outline-map?color=97dbf3&style=flat-square)


## Features

### Follow

Automatically scroll, expand and collapse the outline tree when the cursor moves or the viewport scrolls.

![follow](screenshots/follow.gif)

### Navigation

You can navigate to the symbol by clicking on the outline node like the built-in outline.

Keyboard navigation is also supported.

![navigation](screenshots/nav.gif)

### Diagnostics

Show diagnostics of the current file.

![Flag diagnostics](screenshots/diagnostics.gif)

### Search

default keybinding: `<Alt-l>`

Search for symbols in the current file. You can use the following syntax to achieve different search effects:

- `/<exp>`: Normal search
- `=<exp>`: Regex
- `?<exp>`: Fuzzy search

You can append `@` to filter by symbol kind before the search expression.

![Search](screenshots/search.gif)

### Region and tag

Supports region and tag syntax

You can define regions to group code symbols anywhere in the code (usually comments), or tags to mark locations.

#### Grammar 

```md
#region <name> <comment>
#tag <name> <comment>
#endregion <name>
```

#### Features
- Allows customizing identifiers for regions and labels.
- Tag syntax highlighting (semantic highlighting needs to be enabled)
- Region folding

![region and tag](screenshots/region.png)

---

## Configuration
Changes will take effect after restarting the outline view

### Customization

- `outline-map.color`: Color table for specific symbols

- `outline-map.customFont`: Custom font for the outline. 
    
    Syntax: `[ <family-name> | <generic-family> ]#`
  
- `outline-map.customCSS`: Custom css for the outline. The css will be injected into the outline's webview.

### Behavior

- `outline-map.follow`: Scroll the outline when the cursor moves or the viewport scrolls

- `outline-map.hiddenItem`: Choose items you do not want to see in the outline.

- `outline-map.defaultMaxDepth`: Set the default maximum depth of the outline tree. Set this to non-zero to enable the depth button `>` & `<`.

### Region and tag

- `outline-map.region.enabled`: Enable region and tag support
  
- `outline-map.region.startRegion`: The start of a region.

- `outline-map.region.endRegion`: The end of a region.

- `outline-map.region.tag`: The start of a tag.

- `outline-map.region.highlight`: Enable region and tag syntax highlighting

## Commands
- `outline-map.toggleSearch`: Switch the visibility of search and navigation field. Default keybinding: `<Alt-l>`

- `outline-map.addDepth` | `outline-map.reduceDepth`: Add / Reduce a level to the outline tree. Only works when `outline-map.defaultMaxDepth` is set to non-zero.
  
- `outline-map.pin` | `outline-map.unpin` | `outline-map.freeze` : Pin / Unpin / Freeze the outline tree.

---

## Suggestion: move view to secondary side panel (vscode ^1.64)

> Outline Map relies on vscode or other extensions to provide symbol information
> 
>  Refer to the following links for more information: [vscode-code-outline/  language-support](https://github.com/patrys/vscode-code-outline#language-support)

---

**Enjoy!**
