<template>
  <div class="story-editor">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <button @click="createNewStory">新建故事</button>
      <button @click="loadStory">打开故事</button>
      <button @click="saveStory">保存故事</button>
      <button @click="exportStory">导出配置</button>
      <div class="separator"></div>
      <button @click="togglePreview" :class="{ active: showPreview }">
        {{ showPreview ? '关闭预览' : '打开预览' }}
      </button>
    </div>

    <!-- 主体内容区域 -->
    <div class="editor-container">
      <!-- 左侧面板 -->
      <div class="left-panel">
        <div class="panel-section">
          <h3>节点列表</h3>
          <div class="node-type-buttons">
            <button @click="addNode('dialogue')">+ 对话</button>
            <button @click="addNode('choice')">+ 选项</button>
            <button @click="addNode('condition')">+ 条件</button>
            <button @click="addNode('action')">+ 动作</button>
            <button @click="addNode('end')">+ 结束</button>
          </div>
          <div class="node-list">
            <div
              v-for="node in story.nodes"
              :key="node.id"
              class="node-item"
              :class="{ selected: selectedNodeId === node.id }"
              @click="selectNode(node.id)"
            >
              <span class="node-type">{{ getNodeTypeName(node.type) }}</span>
              <span class="node-text">{{ getNodePreviewText(node) }}</span>
            </div>
          </div>
        </div>

        <div class="panel-section">
          <h3>角色管理</h3>
          <button @click="addCharacter" class="small-btn">+ 添加角色</button>
          <div class="character-list">
            <div
              v-for="char in story.characters"
              :key="char.id"
              class="character-item"
            >
              <span>{{ char.name }}</span>
            </div>
          </div>
        </div>

        <div class="panel-section">
          <h3>变量管理</h3>
          <button @click="addVariable" class="small-btn">+ 添加变量</button>
          <div class="variable-list">
            <div
              v-for="(varDef, key) in story.metadata.variables"
              :key="key"
              class="variable-item"
            >
              <span class="var-name">{{ key }}</span>
              <span class="var-type">{{ varDef.type }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 中间画布区域 -->
      <div class="canvas-area">
        <div v-if="!showPreview" class="story-tree-canvas" ref="canvasRef">
          <div class="canvas-toolbar">
            <button @click="zoomIn">放大</button>
            <button @click="zoomOut">缩小</button>
            <button @click="resetZoom">重置</button>
          </div>
          <div class="canvas-content" :style="canvasStyle">
            <!-- SVG 连线层 -->
            <svg class="connections" width="2000" height="2000" viewBox="0 0 2000 2000">
              <defs>
                <!-- 定义箭头标记 -->
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#95a5a6" />
                </marker>
                <marker
                  id="arrowhead-true"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#2ecc71" />
                </marker>
                <marker
                  id="arrowhead-false"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#e74c3c" />
                </marker>
              </defs>
              <g v-for="(connection, index) in connections" :key="index">
                <!-- 连线路径 -->
                <path
                  :d="connection.path"
                  class="connection-line"
                  :class="{ 'has-condition': connection.type === 'condition' }"
                  :style="{ stroke: connection.color }"
                  :marker-end="connection.markerEnd"
                />
                <!-- 连线标签 -->
                <text
                  v-if="connection.label"
                  :x="connection.labelX"
                  :y="connection.labelY"
                  class="connection-label"
                >
                  {{ connection.label }}
                </text>
              </g>
            </svg>

            <!-- 节点层 -->
            <div
              v-for="node in story.nodes"
              :key="node.id"
              class="tree-node"
              :class="[
                `node-${node.type}`,
                { selected: selectedNodeId === node.id }
              ]"
              :style="getNodeStyle(node)"
              @click="selectNode(node.id)"
            >
              <div class="node-header">
                <span class="node-type-icon">{{ getNodeIcon(node.type) }}</span>
                <span class="node-id">{{ node.id }}</span>
              </div>
              <div class="node-body">
                {{ getNodePreviewText(node) }}
              </div>
              <!-- 连接点 -->
              <div class="connector-input" v-if="node.type !== 'end'"></div>
              <div class="connector-output" v-if="node.type !== 'end'"></div>
              <div
                class="connector-output-condition"
                v-if="node.type === 'condition'"
              ></div>
            </div>
          </div>
        </div>

        <!-- 预览区域 -->
        <div v-else class="preview-area">
          <div class="preview-content">
            <div class="preview-background" :style="getPreviewBackground()">
              <div class="preview-dialogue">
                <div class="speaker-name">{{ currentSpeakerName }}</div>
                <div class="dialogue-text">{{ currentDialogue }}</div>
              </div>
              <div v-if="currentChoices.length > 0" class="preview-choices">
                <button
                  v-for="choice in currentChoices"
                  :key="choice.id"
                  @click="selectChoice(choice)"
                  class="choice-button"
                >
                  {{ choice.text }}
                </button>
              </div>
              <div class="preview-toolbar">
                <button @click="prevDialogue" :disabled="!canGoBack">
                  上一步
                </button>
                <button @click="restartStory">重新开始</button>
                <div class="debug-panel">
                  <h4>调试变量</h4>
                  <div
                    v-for="(value, key) in runtimeVariables"
                    :key="key"
                    class="debug-variable"
                  >
                    <span>{{ key }}:</span>
                    <input
                      v-model="runtimeVariables[key]"
                      @change="updateVariable(key, $event)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧属性面板 -->
      <div class="right-panel">
        <div class="panel-section" v-if="selectedNode">
          <h3>节点属性</h3>
          <div class="property-editor">
            <div class="property-row">
              <label>节点ID:</label>
              <input v-model="selectedNode.id" />
            </div>
            <div class="property-row">
              <label>节点类型:</label>
              <span>{{ getNodeTypeName(selectedNode.type) }}</span>
            </div>

            <!-- 对话节点属性 -->
            <template v-if="selectedNode.type === 'dialogue'">
              <div class="property-row">
                <label>角色:</label>
                <select v-model="selectedNode.speaker">
                  <option value="">无</option>
                  <option
                    v-for="char in story.characters"
                    :key="char.id"
                    :value="char.id"
                  >
                    {{ char.name }}
                  </option>
                </select>
              </div>
              <div class="property-row">
                <label>对话内容:</label>
                <textarea
                  v-model="selectedNode.text"
                  rows="4"
                  placeholder="输入对话内容..."
                ></textarea>
              </div>
              <div class="property-row">
                <label>背景图:</label>
                <input v-model="selectedNode.media?.background" />
              </div>
              <div class="property-row">
                <label>背景音乐:</label>
                <input v-model="selectedNode.media?.bgm" />
              </div>
            </template>

            <!-- 选项节点属性 -->
            <template v-if="selectedNode.type === 'choice'">
              <div class="property-row">
                <label>选项文本:</label>
                <input v-model="selectedNode.text" />
              </div>
              <div class="property-row">
                <label>跳转节点:</label>
                <select v-model="selectedNode.nextNodeId">
                  <option value="">选择目标节点</option>
                  <option
                    v-for="node in story.nodes"
                    :key="node.id"
                    :value="node.id"
                  >
                    {{ node.id }} - {{ getNodePreviewText(node) }}
                  </option>
                </select>
              </div>
            </template>

            <!-- 条件节点属性 -->
            <template v-if="selectedNode.type === 'condition'">
              <div class="property-row">
                <label>条件为真跳转:</label>
                <select v-model="selectedNode.trueNodeId">
                  <option value="">选择节点</option>
                  <option
                    v-for="node in story.nodes"
                    :key="node.id"
                    :value="node.id"
                  >
                    {{ node.id }}
                  </option>
                </select>
              </div>
              <div class="property-row">
                <label>条件为假跳转:</label>
                <select v-model="selectedNode.falseNodeId">
                  <option value="">选择节点</option>
                  <option
                    v-for="node in story.nodes"
                    :key="node.id"
                    :value="node.id"
                  >
                    {{ node.id }}
                  </option>
                </select>
              </div>
              <div class="property-row">
                <label>条件:</label>
                <div
                  v-for="(cond, index) in selectedNode.conditions"
                  :key="index"
                  class="condition-row"
                >
                  <select v-model="cond.variable">
                    <option
                      v-for="(varDef, key) in story.metadata.variables"
                      :key="key"
                      :value="key"
                    >
                      {{ key }}
                    </option>
                  </select>
                  <select v-model="cond.operator">
                    <option value="==">==</option>
                    <option value="!=">!=</option>
                    <option value=">">&gt;</option>
                    <option value="<">&lt;</option>
                    <option value=">=">&gt;=</option>
                    <option value="<=">&lt;=</option>
                  </select>
                  <input v-model="cond.value" />
                  <button @click="removeCondition(index)" class="remove-btn">×</button>
                </div>
                <button @click="addCondition" class="small-btn">+ 添加条件</button>
              </div>
            </template>

            <!-- 动作节点属性 -->
            <template v-if="selectedNode.type === 'action'">
              <div class="property-row">
                <label>跳转节点:</label>
                <select v-model="selectedNode.nextNodeId">
                  <option value="">选择节点</option>
                  <option
                    v-for="node in story.nodes"
                    :key="node.id"
                    :value="node.id"
                  >
                    {{ node.id }}
                  </option>
                </select>
              </div>
              <div class="property-row">
                <label>动作:</label>
                <div
                  v-for="(action, index) in selectedNode.actions"
                  :key="index"
                  class="action-row"
                >
                  <select v-model="action.type">
                    <option value="setVariable">设置变量</option>
                    <option value="addItem">添加物品</option>
                    <option value="removeItem">移除物品</option>
                    <option value="playSound">播放音效</option>
                    <option value="fadeIn">淡入</option>
                    <option value="fadeOut">淡出</option>
                  </select>
                  <input v-model="action.target" placeholder="目标" />
                  <input v-model="action.value" placeholder="值" />
                  <button @click="removeAction(index)" class="remove-btn">×</button>
                </div>
                <button @click="addAction" class="small-btn">+ 添加动作</button>
              </div>
            </template>

            <!-- 结束节点属性 -->
            <template v-if="selectedNode.type === 'end'">
              <div class="property-row">
                <label>结局描述:</label>
                <textarea
                  v-model="selectedNode.text"
                  rows="4"
                  placeholder="输入结局描述..."
                ></textarea>
              </div>
              <div class="property-row">
                <label>背景图:</label>
                <input v-model="selectedNode.media?.background" />
              </div>
            </template>

            <div class="property-row">
              <label>位置 X:</label>
              <input type="number" v-model="selectedNode.position?.x" />
            </div>
            <div class="property-row">
              <label>位置 Y:</label>
              <input type="number" v-model="selectedNode.position?.y" />
            </div>

            <div class="property-actions">
              <button @click="deleteNode" class="danger-btn">删除节点</button>
            </div>
          </div>
        </div>

        <div class="panel-section" v-if="!selectedNode">
          <h3>故事信息</h3>
          <div class="property-editor">
            <div class="property-row">
              <label>故事标题:</label>
              <input v-model="story.metadata.title" />
            </div>
            <div class="property-row">
              <label>描述:</label>
              <textarea
                v-model="story.metadata.description"
                rows="3"
              ></textarea>
            </div>
            <div class="property-row">
              <label>作者:</label>
              <input v-model="story.metadata.author" />
            </div>
            <div class="property-row">
              <label>起始节点:</label>
              <select v-model="story.metadata.startNodeId">
                <option value="">选择起始节点</option>
                <option
                  v-for="node in story.nodes"
                  :key="node.id"
                  :value="node.id"
                >
                  {{ node.id }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue';
import type {
  StoryConfig,
  StoryNode,
  StoryCharacter,
  StoryRuntimeState,
  DialogueNode,
  ChoiceNode,
  ConditionNode,
  ActionNode,
  EndNode,
} from '../types/story';

// 故事数据
const story = reactive<StoryConfig>({
  metadata: {
    id: '',
    title: '新故事',
    description: '',
    author: '',
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startNodeId: '',
    variables: {},
  },
  characters: [],
  nodes: [],
});

// 编辑器状态
const selectedNodeId = ref<string>('');
const showPreview = ref(false);
const zoom = ref(1);
const canvasRef = ref<HTMLElement>();

// 预览状态
const currentDialogue = ref('');
const currentSpeakerName = ref('');
const currentChoices = ref<ChoiceNode[]>([]);
const previewHistory = ref<string[]>([]);
const runtimeVariables = reactive<{ [key: string]: any }>({});
const currentNodeId = ref('');

// 计算属性
const selectedNode = computed(() => {
  return story.nodes.find((n) => n.id === selectedNodeId.value);
});

const canvasStyle = computed(() => ({
  transform: `scale(${zoom.value})`,
  transformOrigin: 'top left',
}));

const canGoBack = computed(() => previewHistory.value.length > 0);

// 计算连线数据
const connections = computed(() => {
  const result: any[] = [];
  const nodeWidth = 180;
  const baseNodeHeight = 90; // 基础节点高度

  story.nodes.forEach((node) => {
    const startNode = story.nodes.find((n) => n.id === node.id);
    if (!startNode) return;

    const startX = startNode.position?.x || 0;
    const startY = startNode.position?.y || 0;

    // 计算节点实际高度（条件节点根据条件数量动态计算）
    let nodeHeight = baseNodeHeight;
    if (node.type === 'condition') {
      const condNode = node as ConditionNode;
      // 每个条件增加约 30px 高度
      nodeHeight = baseNodeHeight + (condNode.conditions?.length || 0) * 30;

      // 调试：输出条件节点的数据
      console.log(`[Condition Node] ID: ${node.id}, Position: (${startX}, ${startY}), Height: ${nodeHeight}`);
      console.log(`[Condition Node] trueNodeId: ${condNode.trueNodeId}, falseNodeId: ${condNode.falseNodeId}`);
      console.log(`[Condition Node] Conditions:`, condNode.conditions);
    }

    // 条件节点：有两个输出（真和假）
    if (node.type === 'condition') {
      const condNode = node as ConditionNode;

      // 真条件连线（右侧输出）
      if (condNode.trueNodeId && condNode.trueNodeId.trim() !== '') {
        const endNode = story.nodes.find((n) => n.id === condNode.trueNodeId);
        if (endNode) {
          const endX = endNode.position?.x || 0;
          const endY = endNode.position?.y || 0;

          const path = createPath(
            startX + nodeWidth,
            startY + nodeHeight / 2,
            endX,
            endY + baseNodeHeight / 2
          );

          console.log(`[True Connection] From (${startX + nodeWidth}, ${startY + nodeHeight / 2}) to (${endX}, ${endY + baseNodeHeight / 2})`);
          console.log(`[True Connection] Path: ${path}`);

          result.push({
            path,
            color: '#2ecc71',
            markerEnd: 'url(#arrowhead-true)',
            label: '真',
            labelX: (startX + nodeWidth + endX) / 2,
            labelY: (startY + nodeHeight / 2 + endY + baseNodeHeight / 2) / 2 - 10,
            type: 'condition',
          });
        } else {
          console.log(`[True Connection] End node not found for ID: ${condNode.trueNodeId}`);
        }
      } else {
        console.log(`[True Connection] trueNodeId is empty for node: ${node.id}, value: ${condNode.trueNodeId}`);
      }

      // 假条件连线（底部输出）
      if (condNode.falseNodeId && condNode.falseNodeId.trim() !== '') {
        const endNode = story.nodes.find((n) => n.id === condNode.falseNodeId);
        if (endNode) {
          const endX = endNode.position?.x || 0;
          const endY = endNode.position?.y || 0;

          const path = createPath(
            startX + nodeWidth / 2,
            startY + nodeHeight,
            endX + nodeWidth / 2,
            endY
          );

          console.log(`[False Connection] From (${startX + nodeWidth / 2}, ${startY + nodeHeight}) to (${endX + nodeWidth / 2}, ${endY})`);
          console.log(`[False Connection] Path: ${path}`);

          result.push({
            path,
            color: '#e74c3c',
            markerEnd: 'url(#arrowhead-false)',
            label: '假',
            labelX: (startX + nodeWidth / 2 + endX + nodeWidth / 2) / 2,
            labelY: (startY + nodeHeight + endY) / 2 - 10,
            type: 'condition',
          });
        } else {
          console.log(`[False Connection] End node not found for ID: ${condNode.falseNodeId}`);
        }
      } else {
        console.log(`[False Connection] falseNodeId is empty for node: ${node.id}, value: ${condNode.falseNodeId}`);
      }
    } else if (
      (node.type === 'choice' || node.type === 'action') &&
      'nextNodeId' in node
    ) {
      // 选项节点和动作节点：单一输出（右侧）
      const nextNodeId = (node as ChoiceNode | ActionNode).nextNodeId;
      if (nextNodeId && nextNodeId.trim() !== '') {
        const endNode = story.nodes.find((n) => n.id === nextNodeId);
        if (endNode) {
          const endX = endNode.position?.x || 0;
          const endY = endNode.position?.y || 0;

          const path = createPath(
            startX + nodeWidth,
            startY + nodeHeight / 2,
            endX,
            endY + baseNodeHeight / 2
          );

          console.log(`[Normal Connection] From (${startX + nodeWidth}, ${startY + nodeHeight / 2}) to (${endX}, ${endY + baseNodeHeight / 2})`);
          console.log(`[Normal Connection] Path: ${path}`);

          result.push({
            path,
            color: '#95a5a6',
            markerEnd: 'url(#arrowhead)',
            label: '',
            type: 'normal',
          });
        } else {
          console.log(`[Normal Connection] End node not found for ID: ${nextNodeId}`);
        }
      } else {
        console.log(`[Normal Connection] nextNodeId is empty for node: ${node.id}, value: ${nextNodeId}`);
      }
    }
  });

  // 调试输出
  if (result.length > 0) {
    console.log('Generated connections count:', result.length);
    result.forEach((conn, idx) => {
      console.log(`Connection ${idx}:`, {
        path: conn.path,
        color: conn.color,
        markerEnd: conn.markerEnd,
        label: conn.label
      });
    });
  }

  return result;
});

// 创建连线路径
const createPath = (
  x1: number,
  y1: number,
  x2: number,
  y2: number
): string => {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const controlOffset = Math.abs(x2 - x1) * 0.3;

  // 使用贝塞尔曲线创建平滑的连线
  if (Math.abs(y2 - y1) > Math.abs(x2 - x1)) {
    // 垂直方向的主导
    return `M ${x1} ${y1} C ${x1} ${y1 + controlOffset}, ${x2} ${y2 - controlOffset}, ${x2} ${y2}`;
  } else {
    // 水平方向的主导
    return `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;
  }
};

// 方法
const createNewStory = () => {
  story.metadata.id = `story-${Date.now()}`;
  story.metadata.createdAt = new Date().toISOString();
  story.metadata.updatedAt = new Date().toISOString();
  story.characters = [];
  story.nodes = [];
  story.metadata.variables = {};
  selectedNodeId.value = '';
};

const loadStory = async () => {
  // 调用主进程加载文件
  const result = await Editor.Message.send(
    'vue3-template',
    'load-story-file'
  );
  if (result) {
    Object.assign(story, result);
  }
};

const saveStory = () => {
  story.metadata.updatedAt = new Date().toISOString();
  Editor.Message.send('vue3-template', 'save-story-file', story);
};

const exportStory = () => {
  Editor.Message.send('vue3-template', 'export-story-config', story);
};

const addNode = (type: StoryNode['type']) => {
  const id = `node-${Date.now()}`;
  const baseNode = {
    id,
    type,
    position: { x: 100 + story.nodes.length * 50, y: 100 },
  };

  let newNode: StoryNode;
  switch (type) {
    case 'dialogue':
      newNode = { ...baseNode, text: '', type: 'dialogue' };
      break;
    case 'choice':
      newNode = { ...baseNode, text: '选项', nextNodeId: '', type: 'choice' };
      break;
    case 'condition':
      newNode = {
        ...baseNode,
        conditions: [],
        trueNodeId: '',
        falseNodeId: '',
        type: 'condition',
      };
      break;
    case 'action':
      newNode = {
        ...baseNode,
        actions: [],
        nextNodeId: '',
        type: 'action',
      };
      break;
    case 'end':
      newNode = { ...baseNode, text: '结局', type: 'end' };
      break;
  }

  story.nodes.push(newNode);
  selectedNodeId.value = id;
};

const selectNode = (id: string) => {
  selectedNodeId.value = id;
};

const deleteNode = () => {
  if (selectedNodeId.value) {
    const index = story.nodes.findIndex((n) => n.id === selectedNodeId.value);
    if (index > -1) {
      story.nodes.splice(index, 1);
      selectedNodeId.value = '';
    }
  }
};

const addCharacter = () => {
  const id = `char-${Date.now()}`;
  story.characters.push({
    id,
    name: '新角色',
  });
};

const addVariable = () => {
  const key = `var${Object.keys(story.metadata.variables).length + 1}`;
  story.metadata.variables[key] = {
    type: 'string',
    defaultValue: '',
  };
};

const getNodeTypeName = (type: string) => {
  const names: { [key: string]: string } = {
    dialogue: '对话',
    choice: '选项',
    condition: '条件',
    action: '动作',
    end: '结束',
  };
  return names[type] || type;
};

const getNodeIcon = (type: string) => {
  const icons: { [key: string]: string } = {
    dialogue: '💬',
    choice: '❓',
    condition: '🔀',
    action: '⚡',
    end: '🏁',
  };
  return icons[type] || '📝';
};

const getNodePreviewText = (node: StoryNode) => {
  if (node.type === 'dialogue' || node.type === 'end') {
    return node.text.substring(0, 30) + (node.text.length > 30 ? '...' : '');
  }
  if (node.type === 'choice') {
    return node.text;
  }
  if (node.type === 'condition') {
    return `${node.conditions.length}个条件`;
  }
  if (node.type === 'action') {
    return `${node.actions.length}个动作`;
  }
  return '';
};

const getNodeStyle = (node: StoryNode) => {
  return {
    left: `${node.position?.x || 0}px`,
    top: `${node.position?.y || 0}px`,
  };
};

const zoomIn = () => {
  zoom.value = Math.min(zoom.value + 0.1, 2);
};

const zoomOut = () => {
  zoom.value = Math.max(zoom.value - 0.1, 0.5);
};

const resetZoom = () => {
  zoom.value = 1;
};

// 条件节点方法
const addCondition = () => {
  if (selectedNode.value && selectedNode.value.type === 'condition') {
    selectedNode.value.conditions.push({
      variable: '',
      operator: '==',
      value: '',
    });
  }
};

const removeCondition = (index: number) => {
  if (selectedNode.value && selectedNode.value.type === 'condition') {
    selectedNode.value.conditions.splice(index, 1);
  }
};

// 动作节点方法
const addAction = () => {
  if (selectedNode.value && selectedNode.value.type === 'action') {
    selectedNode.value.actions.push({
      type: 'setVariable',
      target: '',
      value: '',
    });
  }
};

const removeAction = (index: number) => {
  if (selectedNode.value && selectedNode.value.type === 'action') {
    selectedNode.value.actions.splice(index, 1);
  }
};

// 预览功能
const togglePreview = () => {
  showPreview.value = !showPreview.value;
  if (showPreview.value) {
    startPreview();
  }
};

const startPreview = () => {
  // 初始化运行时变量
  Object.assign(runtimeVariables, story.metadata.variables);
  Object.keys(runtimeVariables).forEach((key) => {
    runtimeVariables[key] = story.metadata.variables[key].defaultValue;
  });

  previewHistory.value = [];
  currentNodeId.value = story.metadata.startNodeId;
  runNextNode();
};

const runNextNode = () => {
  const node = story.nodes.find((n) => n.id === currentNodeId.value);
  if (!node) return;

  if (node.type === 'dialogue') {
    const dialogueNode = node as DialogueNode;
    currentDialogue.value = dialogueNode.text;
    currentSpeakerName.value =
      story.characters.find((c) => c.id === dialogueNode.speaker)?.name || '';
    currentChoices.value = [];
  } else if (node.type === 'choice') {
    // 选项节点由用户点击触发
  } else if (node.type === 'condition') {
    const condNode = node as ConditionNode;
    const result = evaluateConditions(condNode.conditions);
    currentNodeId.value = result ? condNode.trueNodeId : condNode.falseNodeId;
    runNextNode();
  } else if (node.type === 'action') {
    const actionNode = node as ActionNode;
    executeActions(actionNode.actions);
    currentNodeId.value = actionNode.nextNodeId;
    runNextNode();
  } else if (node.type === 'end') {
    const endNode = node as EndNode;
    currentDialogue.value = endNode.text;
    currentSpeakerName.value = '结局';
    currentChoices.value = [];
  }
};

const evaluateConditions = (conditions: any[]) => {
  return conditions.every((cond) => {
    const value = runtimeVariables[cond.variable];
    switch (cond.operator) {
      case '==':
        return value == cond.value;
      case '!=':
        return value != cond.value;
      case '>':
        return value > cond.value;
      case '<':
        return value < cond.value;
      case '>=':
        return value >= cond.value;
      case '<=':
        return value <= cond.value;
      default:
        return false;
    }
  });
};

const executeActions = (actions: any[]) => {
  actions.forEach((action) => {
    switch (action.type) {
      case 'setVariable':
        runtimeVariables[action.target] = action.value;
        break;
      // 其他动作类型
    }
  });
};

const selectChoice = (choice: ChoiceNode) => {
  previewHistory.value.push(currentNodeId.value);
  currentNodeId.value = choice.nextNodeId;
  runNextNode();
};

const prevDialogue = () => {
  if (previewHistory.value.length > 0) {
    currentNodeId.value = previewHistory.value.pop()!;
    runNextNode();
  }
};

const restartStory = () => {
  startPreview();
};

const updateVariable = (key: string, event: Event) => {
  const input = event.target as HTMLInputElement;
  runtimeVariables[key] = input.value;
};

const getPreviewBackground = () => {
  const node = story.nodes.find((n) => n.id === currentNodeId.value);
  if (node && 'media' in node && node.media?.background) {
    return {
      backgroundImage: `url(${node.media.background})`,
    };
  }
  return {};
};
</script>

<style scoped>
.story-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--color-background-base);
}

.toolbar {
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  background-color: var(--color-toolbar-base);
  border-bottom: 1px solid var(--color-border);
}

.toolbar button {
  padding: 6px 12px;
  background-color: var(--color-button-base);
  color: var(--color-button-text);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.toolbar button:hover {
  background-color: var(--color-button-hover);
}

.toolbar button.active {
  background-color: var(--color-primary);
  color: white;
}

.separator {
  width: 1px;
  background-color: var(--color-border);
  margin: 0 8px;
}

.editor-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.left-panel,
.right-panel {
  width: 280px;
  overflow-y: auto;
  background-color: var(--color-panel-base);
  border-right: 1px solid var(--color-border);
  padding: 12px;
}

.right-panel {
  border-right: none;
  border-left: 1px solid var(--color-border);
}

.panel-section {
  margin-bottom: 20px;
}

.panel-section h3 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--color-text-normal);
}

.node-type-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.node-type-buttons button {
  padding: 4px 8px;
  font-size: 12px;
  background-color: var(--color-button-base);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
}

.node-type-buttons button:hover {
  background-color: var(--color-button-hover);
}

.node-list,
.character-list,
.variable-list {
  max-height: 200px;
  overflow-y: auto;
}

.node-item,
.character-item,
.variable-item {
  padding: 8px;
  margin-bottom: 4px;
  background-color: var(--color-background-base);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.node-item:hover,
.character-item:hover,
.variable-item:hover {
  background-color: var(--color-button-hover);
}

.node-item.selected {
  border-color: var(--color-primary);
  background-color: var(--color-primary-light);
}

.node-type {
  font-size: 11px;
  color: var(--color-text-weakest);
  margin-right: 8px;
}

.node-text {
  font-size: 12px;
  color: var(--color-text-normal);
}

.small-btn {
  padding: 4px 8px;
  font-size: 12px;
  background-color: var(--color-button-base);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 8px;
}

.canvas-area {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.story-tree-canvas {
  width: 100%;
  height: 100%;
  overflow: auto;
  background-color: var(--color-background-base);
  background-image:
    linear-gradient(var(--color-border) 1px, transparent 1px),
    linear-gradient(90deg, var(--color-border) 1px, transparent 1px);
  background-size: 20px 20px;
}

.canvas-toolbar {
  position: sticky;
  top: 0;
  left: 0;
  padding: 8px;
  background-color: var(--color-toolbar-base);
  border-bottom: 1px solid var(--color-border);
  z-index: 10;
}

.canvas-content {
  position: relative;
  width: 2000px;
  height: 2000px;
  transform-origin: top left;
}

/* SVG 连线容器 */
.connections {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 0;
  overflow: visible;
}

.connection-line {
  fill: none;
  stroke: #95a5a6;
  stroke-width: 2;
  stroke-linecap: round;
}

.connection-label {
  font-size: 12px;
  fill: #2c3e50;
  font-weight: 500;
  text-anchor: middle;
  text-shadow: 0 0 3px white, 0 0 3px white, 0 0 3px white;
}

/* 连接点 */
.connector-input,
.connector-output,
.connector-output-condition {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  cursor: crosshair;
  z-index: 10;
  transition: transform 0.1s;
  background-color: #2ecc71;
}

.connector-input:hover,
.connector-output:hover,
.connector-output-condition:hover {
  transform: scale(1.3);
}

.connector-input {
  top: 50%;
  left: -6px;
  transform: translateY(-50%);
  background-color: #e74c3c;
}

.connector-output {
  top: 50%;
  right: -6px;
  transform: translateY(-50%);
  background-color: #2ecc71;
}

.connector-output-condition {
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #f39c12;
}

.tree-node {
  position: absolute;
  width: 180px;
  padding: 10px;
  background-color: var(--color-panel-base);
  border: 2px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 1;
}

.tree-node:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.tree-node.selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.2);
}

.tree-node.node-dialogue {
  border-color: #3498db;
}

.tree-node.node-choice {
  border-color: #f39c12;
}

.tree-node.node-condition {
  border-color: #9b59b6;
  min-height: 100px;
}

.tree-node.node-action {
  border-color: #e74c3c;
}

.tree-node.node-end {
  border-color: #2ecc71;
}

.node-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-weakest);
}

.node-body {
  font-size: 13px;
  color: var(--color-text-normal);
  line-height: 1.4;
}

.node-arrow {
  position: absolute;
  right: -20px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  color: var(--color-text-weakest);
}

.preview-area {
  width: 100%;
  height: 100%;
  overflow: auto;
  background-color: var(--color-background-base);
}

.preview-content {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.preview-background {
  width: 100%;
  max-width: 800px;
  aspect-ratio: 16/9;
  background-size: cover;
  background-position: center;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 20px;
  position: relative;
}

.preview-dialogue {
  background-color: rgba(0, 0, 0, 0.8);
  padding: 16px;
  border-radius: 8px;
  color: white;
  margin-bottom: 16px;
}

.speaker-name {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--color-primary);
}

.dialogue-text {
  font-size: 16px;
  line-height: 1.6;
}

.preview-choices {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.choice-button {
  padding: 12px 16px;
  background-color: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.choice-button:hover {
  background-color: white;
  transform: translateX(4px);
}

.preview-toolbar {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 8px;
  background-color: rgba(0, 0, 0, 0.8);
  padding: 8px;
  border-radius: 6px;
}

.preview-toolbar button {
  padding: 6px 12px;
  background-color: var(--color-button-base);
  color: var(--color-button-text);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
}

.preview-toolbar button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.debug-panel {
  position: absolute;
  top: 60px;
  right: 10px;
  background-color: rgba(0, 0, 0, 0.9);
  padding: 12px;
  border-radius: 6px;
  min-width: 200px;
}

.debug-panel h4 {
  color: white;
  margin-bottom: 8px;
  font-size: 12px;
}

.debug-variable {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.debug-variable span {
  color: white;
  font-size: 12px;
  min-width: 80px;
}

.debug-variable input {
  flex: 1;
  padding: 4px;
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: white;
  font-size: 12px;
}

.property-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.property-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.property-row label {
  font-size: 12px;
  color: var(--color-text-weakest);
}

.property-row input,
.property-row select,
.property-row textarea {
  padding: 6px 10px;
  background-color: var(--color-background-base);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 13px;
  color: var(--color-text-normal);
}

.property-row textarea {
  resize: vertical;
  min-height: 80px;
}

.condition-row,
.action-row {
  display: flex;
  gap: 4px;
  margin-bottom: 4px;
}

.condition-row select,
.condition-row input,
.action-row select,
.action-row input {
  flex: 1;
  min-width: 0;
  padding: 4px;
  font-size: 12px;
}

.remove-btn {
  width: 24px;
  padding: 4px;
  background-color: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.property-actions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}

.danger-btn {
  flex: 1;
  padding: 8px;
  background-color: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.danger-btn:hover {
  background-color: #c0392b;
}
</style>