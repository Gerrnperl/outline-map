# Outline Map

EN | [中文](README_ZH_CN.md)

![overview](screenshots/overview.png)

A visual, interactive outline map that combines the clarity of the outline with the intuitive overview of the minimap. Enhanced version of vscode built-in outline.

![version](https://vsmarketplacebadge.apphb.com/version/Gerrnperl.outline-map.svg?color=8bf7c7&style=flat-square&logo=visualstudio)
![installs](https://vsmarketplacebadge.apphb.com/installs/Gerrnperl.outline-map.svg?color=56b6c2&style=flat-square&logo=visualstudiocode)
![rating](https://vsmarketplacebadge.apphb.com/rating-star/Gerrnperl.outline-map.svg?color=97dbf3&style=flat-square)

![trendingWeekly](https://vsmarketplacebadge.apphb.com/trending-weekly/Gerrnperl.outline-map.svg?color=8bf79c&style=flat-square)
![trendingMonthly](https://vsmarketplacebadge.apphb.com/trending-monthly/Gerrnperl.outline-map.svg?color=48bfea&style=flat-square)

## Features

- ### Automatically scroll, expand and collapse the outline tree
![follow](screenshots/follow.gif)
- ### Navigate through the outline
![navigation](screenshots/nav.gif)
- ### Flag diagnostics
![Flag diagnostics](screenshots/diagnostics.gif)
- ### Search the outline (`<Alt-l>`)
    - `/<exp>`: Normal
    - `?<exp>`: RegExp
  -  `?<exp>`: Fuzzy

![Search](screenshots/search.gif)

---

## Configuration
Changes will take effect after restarting the outline view
- `outline-map.color`: color table for specific symbols

- `outline-map.follow`: Scroll the outline when the cursor moves or the viewport scrolls

- `outline-map.hiddenItem`: Choose items you do not want to see in the outline.

- `outline-map.defaultMaxDepth`: Set the default maximum depth of the outline tree. Set this to non-zero to enable the depth button `>` & `<`.

- `outline-map.customFont`: Custom font for the outline. Syntax: `[ <family-name> | <generic-family> ]#`
  
- `outline-map.customCSS`: Custom css for the outline. The css will be injected into the outline's webview.

## Commands
- `outline-map.focusOutline`: Focus outline and start searching or navigating

- `outline-map.addDepth` | `outline-map.reduceDepth`: Add / Reduce a level to the outline tree. Only works when `outline-map.defaultMaxDepth` is set to non-zero.
  
- `outline-map.pin` | `outline-map.unpin` | `outline-map.freeze` : Pin / Unpin / Freeze the outline tree.

---

## Suggestion: move view to secondary side panel (vscode ^1.64)
![Initialize settings](images/init.gif)

> Outline Map relies on (vscode || other extensions) to provide symbol information
> 
>  Refer to the following links for more information: [vscode-code-outline/  language-support](https://github.com/patrys/vscode-code-outline#language-support)

---

**Enjoy!**
