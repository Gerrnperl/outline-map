# Change Log

<!-- All notable changes to the "outline-map" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.-->

### [0.0.1] - 2022-07-14
Initial release

### [0.0.2] - 2022-07-14
Update presentation

### [0.1.1] - 2022-07-15

#### Add

- support for vscode.dev

### [0.1.2] - 2022-07-15

#### Fix 
- resource issue

### [0.2.1] - 2022-07-22

#### Add
- configuration: color customization ~ `outline-map.color`

### [0.3.1] - 2022-07-24

#### Add
- configuration: `outline-map.enableAutomaticIndentReduction`
- configuration: `outline-map.follow`

### [0.4.1] - 2022-07-26

#### Add
- configuration: `outline-map.hiddenItem`

### [0.5.1] - 2022-07-27

#### Add
- configuration: `outline-map.maxDepth`

### [0.5.2] - 2022-07-27

#### Add
- two items in configuration: `outline-map.color` : `visibleRange` and `focusingItem` <br/> Now you can specify the background-color of the outline node when it is in the visible range or the outline node is focused.

#### Fix
- background overlap issue

### [0.5.3] - 2022-07-28

#### Fix
- scrolling issue #7
- The issue that outline probability does not update when switching documents

### [0.6.1] - 2022-07-29

#### Add
- command: `outline-map.addDepth` & `outline-map.reduceDepth`
- view action: `<` & `>` for max depth adjustment.<br/> When you scroll / focus on the area whose depth is greater than the set depth, the outline node will not be displayed.<br/>![change depth](./images/changeDepth.gif)
- command: `outline-map.pin` & `outline-map.unpin` ~ issue #8
- view action: `📌`

#### Other
- minimized the size of the extension package(.vsix)
  - removed unnecessary image in the extension package(.vsix)
  - minimized the size of webview file 

### [0.7.1] - 2022-07-29

#### Add
- configuration: `outline-map.expandOutlineMethod`
- click the icon to expand the outline node ~ issue #11

### [0.7.2] - 2022-07-30

#### Add
- Now the max depth will display when you change the max depth (using `<` & `>`) ~ issue #13
- command: `outline-map.freeze`: same as the original `outline-map.pin`

#### Modify
- command `outline-map.pin`: now the outline will scroll automatically to follow the cursor/viewport

### [0.7.3] - 2022-08-02

#### Add
- custom font ~ issue #14

### [0.7.4] - 2022-08-09

#### Add
- `cursor-always-open` ~ issue #16
  
#### Other
- Show `Symbols Not Found` when the file type is not supported ~ issue #17

### [0.8.1] - 2022-10-13

#### Add
- Show symbol details provided by vscode ~ issue #25
  ![details of json](images/details-1.png)
  ![details of rust](images/details-2.png)

- configuration: `outline-map.customCSS` ~ issue #23

#### Fix
- Outline will automatically open when a new child is added now. ~issue #27
  - before
    ![before](images/before.gif)
  - after
    ![after](images/after.gif)

### [1.0.0] - 2023-03-08

#### Add
- Now the outline is closer in appearance to vscode's built-in outline

- Overlap Scrollbar

- Search ~issue #28

#### Remove
- configuration: `outline-map.maxDepth`
    use `outline-map.defaultMaxDepth` instead

- configuration: `outline-map.enableAutomaticIndentReduction`
    the new outline comes with less indent, so this configuration is deprecated. 

- the 'stupid' rotation of the icon of the outline node

- configuration: `outline-map.expandOutlineMethod`

#### Other
- Replaced configuration option `outline-map.follow: "cursor-always-open"` with `outline-map.follow: "manual"

### [1.0.1] - 2023-03-08

#### Fix
typo

### [1.1.0] - 2023-10-10

#### Add

- Filter symbol #47

#### Other

- A better search field

### [1.2.0] - 2023-10-13

#### Add

- Region and tag support #43
  - Region and tag symbols
  - Syntax highlight
  - Region folding

### [1.2.1] - 2023-10-14

#### Fix 

- search field size

### [1.2.2] - 2023-10-21

#### Fix

- Semantic highlight conflict #49

#### Add

- Text decoration for region and tag #49

### [1.3.0] - 2023-11-06

#### Add 

- (preview) Workspace symbols
- zh-cn translations for package.json
- Add option whether to register region provider

#### Fix

- keep expand state when editing
- Keep the visibility of search field #47
- Keep highlight on the closest outline node when the cursor is out of any symbol #34
- Missed message when no symbol found 
- Disable auto-expansion when `follow` to cursor

#### Deprecate

- configuration: `outline-map.color`, use `workbench.colorCustomizations` instead

### [1.3.1] - 2023-11-07

#### Fix

- Now search is case-insensitive (For normal search, case-sensitive is automatically enabled when you type a capital letter)
- A failed search will not cause the outline running into an error state
- Ignore scheme vscode-scm and workThroughSnippet

### [1.3.2] - 2023-11-09

#### Fix

- Overlap items when the height of the outline is not enough #50 [@zcf0508](https://github.com/zcf0508)
- Other minor fixes

### [1.4.0] - 2024-03-24

#### Add

- Add find References when goto tag #59 [@howin98](https://github.com/howin98)
- Provide outline sorting feature #54
- Expand to the symbol under the cursor

#### Fix

- Now the outline will not scroll automatically when in the `manual` follow mode #53

#### Other

- Collapse pin state switch actions for less buttons in navigation bar

### [1.4.1] - 2024-09-13
#### Add
- Support renaming regions and tags
- Code completion for regions and tags
- Add context menu for view reference and call hierarchy

#### Fix
- Handle trailing endregion #56 #76 [@joshua-dean](https://github.com/joshua-dean)

#### Other
- Use dart-sass instead of node-sass #73 [@abandon888](https://github.com/abandon888) 

### [1.4.2] - 2024-02-26
#### Add
- Support for region/tag name escaping (use \ to escape a space) #80
- Improve parsing quality with new region/tag syntax parser
- Improve region/tag hover message.
- Support expanding all symbols on startup (set `outline-map.expand` to `expanded`) #81 #80
- L10n support for extension UI, 
  - and provide de, es, fr, jp, zh-tw translations (translated by copilot :D)

#### Fix
Don't update if the webview isn't visible. #77 #69 [@joshua-dean](https://github.com/joshua-dean)