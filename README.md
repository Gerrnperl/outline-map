# Outline Map

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

## Set the view container position
![Initialize settings](images/init.gif)

---

## Configuration
Changes will take effect after restarting the outline view
- `outline-map.color`: color table for specific symbols
- `outline-map.enableAutomaticIndentReduction`: Enable automatic reduction of child node indent when parent node label goes out of view
  -  ![no-reduceIndent](images/no-reduceIndent.png) -> ![reduceIndent](images/reduceIndent.png)
- `outline-map.follow`: Scroll the outline when the cursor moves or the viewport scrolls
	- `viewport`: When scrolling, the center outline node in the visible area of the editor will be scrolled to the center of the outline view;
	- `cursor` (default): When the cursor position changes, the outline node where the cursor is located will be scrolled to the center of the outline view;
- `outline-map.hiddenItem`: Choose items you do not want to see in the outline.
---

**Enjoy!**
