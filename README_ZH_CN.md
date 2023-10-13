# Outline Map

[EN](README.md) | 中文

![overview](screenshots/overview.png)

可视, 可互动的大纲地图, 提供大纲的清晰条理与缩略地图的直观概览. 更好的 VSCode 内置大纲.

![version](https://img.shields.io/visual-studio-marketplace/v/gerrnperl.outline-map?color=8bf7c7&logo=visualstudio&style=flat-square)
![installs](https://img.shields.io/visual-studio-marketplace/i/gerrnperl.outline-map?color=56b6c2&logo=visualstudiocode&style=flat-square)
![rating](https://img.shields.io/visual-studio-marketplace/stars/gerrnperl.outline-map?color=97dbf3&style=flat-square)

## 特性

### 跟随

根据代码视图或光标位置自动滚动, 展开与折叠大纲。

![follow](screenshots/follow.gif)

### 导航

点击大纲节点可跳转至对应位置, 也支持键盘导航。

![navigation](screenshots/nav.gif)

### 诊断

显示当前文件的错误与警告。

![Flag diagnostics](screenshots/diagnostics.gif)

### 搜索

默认键位: `<Alt-l>`

在当前文件中搜索符号. 可以使用以下语法实现不同的搜索效果:

- `/<exp>`: 正常搜索
- `=<exp>`: 正则表达式
- `?<exp>`: 模糊搜索

在搜索前输入 `@` 以按符号类型过滤
  
![Search](screenshots/search.gif)

### 区域与标签

支持区域与标签语法

可以在代码中的任何位置定义区域以分组代码符号(通常是注释), 或者定义标签以标记位置.

#### 语法

```md
#region <name> <comment>
#tag <name> <comment>
#endregion <name>
```

#### 功能

- 可折叠或展开区域
- 标签和区域语法高亮
- 自定义区域与标签的标识符

![region and tag](screenshots/region.png)

## 设置

更改将在重启大纲视图后生效

### 样式

- `outline-map.color`: 为特定符号设置颜色
  
- `outline-map.customFont`: 设置自定义字体. 
  
  语法: `[ <family-name> | <generic-family> ]#`

- `outline-map.customCSS`: 设置自定义CSS. 这些CSS会被插入大纲的Webview视图

### 行为

- `outline-map.follow`: 设置大纲视图自动跟随光标|视口

- `outline-map.hiddenItem`: 选择隐藏大纲视图中的项目
  
- `outline-map.defaultMaxDepth`: 设置默认最大深度.  将其设置为正值以启用命令按钮 `>` & `<`.

### 区域与标签

- `outline-map.region.enabled`: 启用区域与标签功能

- `outline-map.region.startRegion`: 区域的开始标识符

- `outline-map.region.endRegion`: 区域的结束标识符

- `outline-map.region.tag`: 标签的标识符

- `outline-map.region.highlight`: 启用区域与标签的语法高亮


## 命令

- `outline-map.toggleSearch`: 切换搜索及导航区域可见性. 默认键位 `<Alt-l>`

- `outline-map.addDepth` | `outline-map.reduceDepth`: 增加 / 减少大纲的一级. `outline-map.defaultMaxDepth` 为正值时可用.
- `outline-map.pin` | `outline-map.unpin`: 固定 / 取消固定 / 冻结大纲视图.
  - `unpin`: 取消固定大纲视图;
  - `pin`: 大纲节点将不会自动展开;
  - `freeze`: 大纲节点将不会自动展开, 同时大纲视图不会自动滚动;

---

## 建议: 将视图移至辅助侧栏 (vscode ^1.64)

> Outline Map 依赖于 vscode 或 其他扩展提供符号信息
>
> 参考: [vscode-code-outline/language-support](https://github.com/patrys/vscode-code-outline#language-support)
---

**Enjoy!**
