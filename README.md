# Cocos Creator 故事编辑器

一个功能强大的可视化剧情编辑器扩展，专为 Cocos Creator 设计，帮助游戏开发者轻松创建和管理对话故事流程。

## ✨ 功能特性

- 📊 **可视化节点编辑** - 直观的拖拽式节点编辑器
- 🔗 **贝塞尔曲线连线** - 优美的贝塞尔曲线连接节点
- 📝 **多种节点类型** - 支持开始、对话、判断、动作、过渡、结束等节点
- 💾 **故事导入导出** - 支持导入和导出 JSON 格式的故事文件
- 🎨 **自动布局** - 智能的自动布局算法，快速整理节点
- ⌨️ **快捷键操作** - 便捷的键盘快捷键提升效率
- 🔄 **实时预览** - 实时预览故事流程

## 🚀 快速开始

### 环境要求

- Cocos Creator >= 3.8.6
- Node.js >= 14.x

### 安装

1. 将扩展包放入 Cocos Creator 项目的 `extensions` 目录
2. 在 Cocos Creator 中打开扩展管理器
3. 启用"故事编辑器"扩展

### 构建开发版本

```bash
# 安装依赖
npm install

# 构建项目
npm run build
```

## 📖 使用说明

### 打开编辑器

在菜单栏点击 `扩展 → 故事编辑器 → 打开编辑器`，即可打开故事编辑面板。

### 节点类型

| 节点类型    | 说明               | 可编辑内容                   |
| ----------- | ------------------ | ---------------------------- |
| 🟢 开始节点 | 故事起点，不可删除 | 展示文字                     |
| 💬 对话节点 | 角色对话内容       | 对话内容、发起角色、目标角色 |
| 🔀 判断节点 | 条件分支判断       | 绑定变量、判断条件           |
| ⚡ 动作节点 | 执行特定动作       | 指定角色、动作说明           |
| 🔄 过渡节点 | 场景过渡           | 展示文字                     |
| 🔴 结束节点 | 故事终点           | 无                           |

### 基本操作

- **创建节点** - 点击工具栏的节点按钮
- **编辑节点** - 点击节点打开编辑对话框
- **移动节点** - 拖拽节点到目标位置
- **删除节点** - 选中节点后按 `Delete` 键
- **连接节点** - 从绿色连接圈拖拽到目标节点的红色连接圈

### 快捷键

| 快捷键   | 功能           |
| -------- | -------------- |
| `Delete` | 删除选中的节点 |
| `Ctrl+S` | 保存故事       |
| `Ctrl+O` | 导入故事       |

### 故事保存

故事文件默认保存在项目的 `story-files` 目录下，文件名基于故事标题自动生成。

## 📁 项目结构

```
vue3-template/
├── source/
│   ├── main.ts              # 主进程入口
│   ├── panels/
│   │   └── default/
│   │       └── index.ts     # 编辑器面板主逻辑
│   ├── components/
│   │   └── StoryEditor.vue  # Vue 组件
│   └── types/
│       └── story.ts         # 类型定义
├── static/
│   └── style/
│       └── default/
│           └── index.css    # 样式文件
├── package.json             # 扩展配置
└── tsconfig.json            # TypeScript 配置
```

## 🔧 开发说明

### 添加新节点类型

1. 在 `source/types/story.ts` 中定义节点类型
2. 在 `source/panels/default/index.ts` 中添加节点创建逻辑
3. 在 `static/style/default/index.css` 中添加样式

### 自定义连线样式

修改 `source/panels/default/index.ts` 中的 `connections()` 计算属性，调整贝塞尔曲线参数。

## 📝 故事文件格式

故事文件为 JSON 格式，包含以下结构：

```json
{
  "metadata": {
    "title": "故事标题",
    "description": "故事描述"
  },
  "characters": [
    {
      "id": "char1",
      "name": "角色名称"
    }
  ],
  "variables": [
    {
      "id": "var1",
      "name": "变量名称",
      "type": "boolean"
    }
  ],
  "nodes": [
    {
      "id": "node1",
      "type": "dialogue",
      "x": 100,
      "y": 100,
      "content": "对话内容",
      "speakerId": "char1"
    }
  ],
  "startNodeId": "node1"
}
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## ☕ 支持项目

如果你觉得这个项目对你有帮助，可以考虑支持一下项目的持续开发：

<div align="center">
  <img src="0f7ea989260d55fce2982d9f265bbb54.jpg" alt="收款码" width="200" />
  <p>微信</p>
</div>

你的支持是我持续改进和维护这个项目的动力！感谢每一位使用和支持的朋友。

## 📄 许可证

MIT License

## 📮 联系方式

如有问题或建议，请提交 Issue。

---

**版本**: 2.0.0  
**兼容性**: Cocos Creator >= 3.8.6
