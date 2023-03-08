# Outline Map

[EN](README.md) | 中文

![overview](screenshots/overview.png)

可视, 可互动的大纲地图, 提供大纲的清晰条理与缩略地图的直观概览. 改进 VSCode 内置大纲.

![version](https://img.shields.io/visual-studio-marketplace/v/gerrnperl.outline-map?color=8bf7c7&logo=visualstudio&style=flat-square)
![installs](https://img.shields.io/visual-studio-marketplace/i/gerrnperl.outline-map?color=56b6c2&logo=visualstudiocode&style=flat-square)
![rating](https://img.shields.io/visual-studio-marketplace/stars/gerrnperl.outline-map?color=97dbf3&style=flat-square)

## 特性

- ### 自动滚动, 展开与折叠大纲
![follow](screenshots/follow.gif)
- ### 快速导航
![navigation](screenshots/nav.gif)
- ### 标记Error与Warning
![Flag diagnostics](screenshots/diagnostics.gif)
- ### 搜索 (`<Alt-l>`)
    - `/<exp>`: 正常搜索
    - `=<exp>`: 正则表达式
    - `?<exp>`: 模糊搜索
  
![Search](screenshots/search.gif)

---

## 设置
更改将在重启大纲视图后生效

- `outline-map.color`: 为特定符号设置颜色
  
- `outline-map.follow`: 设置大纲视图自动跟随光标|视口

- `outline-map.hiddenItem`: 选择隐藏大纲视图中的项目
  
- `outline-map.defaultMaxDepth`: 设置默认最大深度.  将其设置为正值以启用命令按钮 `>` & `<`.
  
- `outline-map.customFont`: 设置自定义字体. 语法: `[ <family-name> | <generic-family> ]#`

- `outline-map.customCSS`: 设置自定义CSS. 这些CSS会被插入大纲的Webview视图

## 命令

- `outline-map.focusOutline`: 聚焦大纲以开始导航与搜索. 默认键位 `<Alt-l>`

- `outline-map.addDepth` | `outline-map.reduceDepth`: 增加 / 减少大纲的一级. `outline-map.defaultMaxDepth` 为正值时可用.
- `outline-map.pin` | `outline-map.unpin`: 固定 / 取消固定 / 冻结大纲视图.
  - `unpin`: 取消固定大纲视图;
  - `pin`: 大纲节点将不会自动展开;
  - `freeze`: 大纲节点将不会自动展开, 同时大纲视图不会自动滚动;

---

## 建议: 将视图移至辅助侧栏 (vscode ^1.64)
![Initialize settings](images/init.gif)

---

> Outline Map 依赖于 vscode 或 其他扩展提供符号信息
>
> 参考: [vscode-code-outline/language-support](https://github.com/patrys/vscode-code-outline#language-support)
---

**Enjoy!**
