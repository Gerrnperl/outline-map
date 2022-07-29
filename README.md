# Outline Map

EN | [中文](README_ZH_CN.md)

A visual, interactive outline map that combines the clarity of the outline with the intuitive overview of the minimap. Alternative Minimap.

![version](https://vsmarketplacebadge.apphb.com/version/Gerrnperl.outline-map.svg?color=8bf7c7&style=flat-square&logo=visualstudio)
![installs](https://vsmarketplacebadge.apphb.com/installs/Gerrnperl.outline-map.svg?color=56b6c2&style=flat-square&logo=visualstudiocode)
![rating](https://vsmarketplacebadge.apphb.com/rating-star/Gerrnperl.outline-map.svg?color=97dbf3&style=flat-square)

![trendingWeekly](https://vsmarketplacebadge.apphb.com/trending-weekly/Gerrnperl.outline-map.svg?color=8bf79c&style=flat-square)
![trendingMonthly](https://vsmarketplacebadge.apphb.com/trending-monthly/Gerrnperl.outline-map.svg?color=48bfea&style=flat-square)

## Features

- ### Follow the cursor
![Follow the cursor](images/follow-cursor.gif)
- ### Quick navigation
![Quick navigation](images/quick-navigation.gif)
- ### Flag diagnostics
![Flag diagnostics](images/flag-diagnostics.gif)
- ### Color customization
![Color customization](images/color-customization.png)

---

## Configuration
Changes will take effect after restarting the outline view
- `outline-map.color`: color table for specific symbols
- `outline-map.enableAutomaticIndentReduction`: Enable automatic reduction of child node indent when parent node label goes out of view
  <br/>  ![no-reduceIndent](images/no-reduceIndent.png) -> ![reduceIndent](images/reduceIndent.png)
- `outline-map.follow`: Scroll the outline when the cursor moves or the viewport scrolls
	- `viewport`: When scrolling, the center outline node in the visible area of the editor will be scrolled to the center of the outline view;
	- `cursor` (default): When the cursor position changes, the outline node where the cursor is located will be scrolled to the center of the outline view;
- `outline-map.hiddenItem`: Choose items you do not want to see in the outline.
- `outline-map.defaultMaxDepth`: Set the default maximum depth of the outline tree. Set this to non-zero to enable the depth button `>` & `<`.
- `outline-map.expandOutlineMethod`<br/> Set how to expand outline node.
  - `click` (default): Click the icon of a outline node to expand;<br/>![click-expand](images/click-expand.gif)
  - `hover`: Hover a outline node to expand;

## Commands
- `outline-map.addDepth` | `outline-map.reduceDepth`: Add / Reduce a level to the outline tree. Only works when `outline-map.defaultMaxDepth` is set to non-zero.
- `outline-map.pin` | `outline-map.unpin`: Pin / Unpin the outline tree.

---

## Suggestion: move view to secondary side panel (vscode ^1.64)
![Initialize settings](images/init.gif)

---

> Outline Map relies on (vscode || other extensions) to provide symbol information

---

**Enjoy!**
