/* eslint-disable vue/one-component-per-file */

import { readFileSync, writeFileSync } from 'fs-extra';
import { join } from 'path';
import { createApp, App, defineComponent, ref, reactive } from 'vue';

const panelDataMap = new WeakMap<any, App>();
// 存储组件实例用于访问
let componentInstance: any = null;
// 版本号，用于追踪代码更新
const VERSION = '1.2.4';

// 类型定义
interface StoryNode {
    id: string;
    type: string;
    x: number;
    y: number;
    content?: string;
    speakerId?: string;
    actions?: any[];
    transitions?: any[];
}

interface StoryConfig {
    metadata: any;
    characters: any[];
    variables: any[];
    nodes: StoryNode[];
    startNodeId: string;
}

// 主编辑器组件
const StoryEditorComponent = defineComponent({
    template: `
        <div class="story-editor">
            <div class="debug-info">当前模式: {{ mode }}</div>
            
            <!-- 编辑对话框 -->
            <div v-if="showDialog" class="dialog-overlay">
                <div class="dialog-content" @mousedown.stop @click.stop>
                    <div class="dialog-header">
                        <h3>{{ dialogType === 'intro' ? '编辑故事简介' : dialogType === 'character' ? '编辑角色' : '编辑变量' }}</h3>
                        <button @click="closeDialog" class="btn-close">×</button>
                    </div>
                    <div class="dialog-body">
                        <!-- 故事简介表单 -->
                        <template v-if="dialogType === 'intro'">
                            <div class="form-group">
                                <label>故事标题：</label>
                                <input type="text" v-model="editForm.title" placeholder="请输入故事标题">
                            </div>
                            <div class="form-group">
                                <label>故事描述：</label>
                                <textarea v-model="editForm.description" rows="3" placeholder="请输入故事描述"></textarea>
                            </div>
                            <div class="form-group">
                                <label>作者：</label>
                                <input type="text" v-model="editForm.author" placeholder="请输入作者">
                            </div>
                        </template>
                        
                        <!-- 角色表单 -->
                        <template v-else-if="dialogType === 'character'">
                            <div class="form-group">
                                <label>角色名称：</label>
                                <input type="text" v-model="editForm.name" placeholder="请输入角色名称">
                            </div>
                            <div class="form-group">
                                <label>角色描述：</label>
                                <textarea v-model="editForm.description" rows="3" placeholder="请输入角色描述"></textarea>
                            </div>
                        </template>
                        
                        <!-- 变量表单 -->
                        <template v-else-if="dialogType === 'variable'">
                            <div class="form-group">
                                <label>变量名称：</label>
                                <input type="text" v-model="editForm.name" placeholder="请输入变量名称">
                            </div>
                            <div class="form-group">
                                <label>变量类型：</label>
                                <select v-model="editForm.varType">
                                    <option value="string">字符串 (string)</option>
                                    <option value="number">数字 (number)</option>
                                    <option value="boolean">布尔值 (boolean)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>默认值：</label>
                                <input type="text" v-model="editForm.defaultValue" placeholder="请输入默认值">
                            </div>
                            <div class="form-group">
                                <label>注释：</label>
                                <textarea v-model="editForm.comment" rows="2" placeholder="请输入变量注释（可选）"></textarea>
                            </div>
                        </template>

                        <!-- 节点编辑表单 -->
                        <template v-else-if="dialogType === 'node'">
                            <!-- 开始节点 / 过渡节点：展示文字 -->
                            <template v-if="nodeEditForm.type === 'start' || nodeEditForm.type === 'transition'">
                                <div class="form-group">
                                    <label>展示文字：</label>
                                    <textarea v-model="nodeEditForm.content" rows="3" placeholder="请输入展示文字"></textarea>
                                </div>
                            </template>

                            <!-- 对话节点：对话内容、发起角色、对谁说的 -->
                            <template v-if="nodeEditForm.type === 'dialogue'">
                                <div class="form-group">
                                    <label>对话内容：</label>
                                    <textarea v-model="nodeEditForm.content" rows="4" placeholder="请输入对话内容"></textarea>
                                </div>
                                <div class="form-group">
                                    <label>发起角色：</label>
                                    <select v-model="nodeEditForm.speakerId">
                                        <option value="">无</option>
                                        <option v-for="char in story.characters" :key="char.id" :value="char.id">
                                            {{ char.name }}
                                        </option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>对谁说的（可多选）：</label>
                                    <div class="checkbox-group">
                                        <label v-for="char in story.characters" :key="char.id" class="checkbox-item">
                                            <input type="checkbox" :value="char.id" v-model="nodeEditForm.targetSpeakerIds">
                                            {{ char.name }}
                                        </label>
                                    </div>
                                </div>
                            </template>

                            <!-- 判断节点：绑定变量、判断条件 -->
                            <template v-if="nodeEditForm.type === 'condition'">
                                <div class="form-group">
                                    <label>条件列表：</label>
                                    <div v-for="(cond, idx) in nodeEditForm.conditionList" :key="idx" class="condition-item">
                                        <select v-model="cond.variableId">
                                            <option value="">选择变量</option>
                                            <option v-for="variable in story.variables" :key="variable.id" :value="variable.id">
                                                {{ variable.name }} ({{ variable.varType }})
                                            </option>
                                        </select>
                                        <select v-model="cond.operator">
                                            <option value="==">等于 (==)</option>
                                            <option value="!=">不等于 (!=)</option>
                                            <option value="&gt;">大于 (&gt;)</option>
                                            <option value="&lt;">小于 (&lt;)</option>
                                            <option value="&gt;=">大于等于 (&gt;=)</option>
                                            <option value="&lt;=">小于等于 (&lt;=)</option>
                                        </select>
                                        <input type="text" v-model="cond.value" placeholder="比较值">
                                        <button @click="removeCondition(idx)" class="btn-remove">×</button>
                                    </div>
                                    <button @click="addCondition" class="btn-add-small">+ 添加条件</button>
                                </div>
                            </template>

                            <!-- 动作节点：指定角色、添加文字说明 -->
                            <template v-if="nodeEditForm.type === 'action'">
                                <div class="form-group">
                                    <label>角色：</label>
                                    <select v-model="nodeEditForm.speakerId">
                                        <option value="">无</option>
                                        <option v-for="char in story.characters" :key="char.id" :value="char.id">
                                            {{ char.name }}
                                        </option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>动作说明：</label>
                                    <textarea v-model="nodeEditForm.content" rows="4" placeholder="请输入动作说明"></textarea>
                                </div>
                            </template>
                        </template>
                    </div>
                    <div class="dialog-footer">
                        <button @click="deleteCurrentNode" class="btn-danger">删除节点</button>
                        <button @click="closeDialog" class="btn-cancel">取消</button>
                        <button @click="saveEdit" class="btn-save">保存</button>
                    </div>
                </div>
            </div>

            <!-- 删除确认对话框 -->
            <div v-if="showDeleteConfirm" class="dialog-overlay">
                <div class="dialog-content" @mousedown.stop @click.stop>
                    <div class="dialog-header">
                        <h3>删除确认 - {{ deletingItem?.name || deletingItem?.id }}</h3>
                        <button @click="cancelDelete" class="btn-close">×</button>
                    </div>
                    <div class="dialog-body">
                        <p>此操作将删除{{ deleteConfirmType === 'variable' ? '变量' : '角色' }}，以下节点使用了该{{ deleteConfirmType === 'variable' ? '变量' : '角色' }}：</p>
                        <div class="related-nodes-list">
                            <div
                                v-for="(node, idx) in relatedNodes"
                                :key="node.id"
                                class="related-node-item"
                                :class="{ 'confirming': idx === confirmStep }"
                            >
                                <span class="node-type-icon">{{ getNodeIcon(node.type) }}</span>
                                <span class="node-id">{{ node.id }}</span>
                                <span class="node-content">{{ getNodeContent(node) }}</span>
                                <span v-if="idx === confirmStep" class="confirm-badge">请确认</span>
                            </div>
                        </div>
                        <div class="confirm-instructions">
                            <p>请依次确认每个节点，点击"确认删除"按钮后逐个检查。</p>
                        </div>
                    </div>
                    <div class="dialog-footer">
                        <button @click="cancelDelete" class="btn-cancel">取消</button>
                        <button @click="confirmDeleteNode" class="btn-danger">确认删除 ({{ confirmStep + 1 }}/{{ relatedNodes.length }})</button>
                    </div>
                </div>
            </div>

            <!-- 模式选择界面 -->
            <div v-if="mode === 'select'" class="select-mode">
                <div class="select-header">
                    <h2>选择故事</h2>
                    <button @click="createNewStory" class="btn-primary">新建故事</button>
                </div>
                <div class="story-list">
                    <div
                        v-for="story in stories"
                        :key="story.id"
                        class="story-item"
                        @click="selectStory(story.id)"
                    >
                        <div class="story-title">{{ story.title }}</div>
                        <div class="story-meta">
                            <span>{{ story.author }}</span>
                            <span>{{ formatDate(story.updatedAt) }}</span>
                        </div>
                        <div class="story-desc">{{ story.description }}</div>
                    </div>
                </div>
            </div>

            <!-- 编辑模式 -->
            <div v-else-if="mode === 'edit'" class="edit-mode">
                <div class="edit-mode-debug">编辑模式已激活</div>
                <!-- 左侧目录 -->
                <div class="left-panel">
                    <div class="panel-toolbar">
                        <button @click="saveStory" class="btn-save">保存故事</button>
                        <button @click="importStory" class="btn-export">导入故事</button>
                        <button @click="exitEdit" class="btn-exit">退出编辑</button>
                    </div>

                    <div class="panel-section">
                        <h3>故事简介</h3>
                        <div class="node-list">
                            <div class="intro-node" @click="editIntro">
                                <div class="node-icon">📖</div>
                                <div class="node-info">
                                    <div class="node-title">{{ story.metadata.title || '未命名故事' }}</div>
                                    <div class="node-desc">{{ story.metadata.description || '点击编辑简介' }}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="panel-section">
                        <h3>角色信息</h3>
                        <button @click="addCharacter" class="btn-add">+ 新建角色</button>
                        <div class="node-list">
                            <div
                                v-for="char in story.characters"
                                :key="char.id"
                                class="character-node"
                                @click="editCharacter(char)"
                            >
                                <div class="node-icon">👤</div>
                                <div class="node-info">
                                    <div class="node-title">{{ char.name }}</div>
                                    <div class="node-desc">{{ char.description || '点击编辑角色' }}</div>
                                </div>
                                <button @click.stop="deleteCharacter(char.id)" class="btn-delete">×</button>
                            </div>
                        </div>
                    </div>

                    <div class="panel-section">
                        <h3>变量</h3>
                        <button @click="addVariable" class="btn-add">+ 新建变量</button>
                        <div class="node-list">
                            <div
                                v-for="variable in story.variables"
                                :key="variable.id"
                                class="variable-node"
                                @click="editVariable(variable)"
                            >
                                <div class="node-icon">📊</div>
                                <div class="node-info">
                                    <div class="node-title">{{ variable.name }}</div>
                                    <div class="node-desc">{{ variable.varType }}: {{ variable.defaultValue }}</div>
                                </div>
                                <button @click.stop="deleteVariable(variable.id)" class="btn-delete">×</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 右侧故事编辑面板 -->
                <div class="right-panel">
                    <div class="canvas-toolbar">
                        <button @click="addNode('start')" class="btn-node">+ 开头节点</button>
                        <button @click="addNode('dialogue')" class="btn-node">+ 对话节点</button>
                        <button @click="addNode('action')" class="btn-node">+ 动作节点</button>
                        <button @click="addNode('transition')" class="btn-node">+ 过渡节点</button>
                        <button @click="addNode('condition')" class="btn-node">+ 判断节点</button>
                        <button @click="addNode('end')" class="btn-node">+ 结束节点</button>
                        <div class="separator"></div>
                        <button @click="zoomIn" class="btn-zoom">放大</button>
                        <button @click="zoomOut" class="btn-zoom">缩小</button>
                    </div>

                    <div class="canvas-container" ref="canvasContainer">
                        <div class="canvas" :style="canvasStyle" ref="canvas">
                            <!-- 绘制连线 -->
                            <svg class="connections" width="2000" height="2000" viewBox="0 0 2000 2000">
                                <!-- 箭头定义 -->
                                <defs>
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
                                </defs>

                                <!-- 测试线条 -->
                                <path d="M 0 0 L 100 100" stroke="red" stroke-width="5" fill="none" />

                                <path
                                    v-for="conn in connections"
                                    :key="conn.id"
                                    :d="getBezierPath(conn)"
                                    class="connection-line"
                                    :style="{ stroke: conn.isConditionFalse ? '#e74c3c' : (conn.condition && !conn.isConditionFalse ? '#2ecc71' : '#95a5a6') }"
                                    marker-end="url(#arrowhead)"
                                    @contextmenu.prevent="deleteConnection(conn.fromNodeId, conn.toNodeId)"
                                />
                                <text
                                    v-for="conn in connections"
                                    :key="'label-' + conn.id"
                                    :x="conn.labelX"
                                    :y="conn.labelY"
                                    class="connection-label"
                                >
                                    {{ conn.label }}
                                </text>
                            </svg>

                            <!-- 节点 -->
                            <div
                                v-for="node in story.nodes"
                                :key="node.id"
                                :class="['story-node', 'node-' + node.type, { selected: selectedNodeId === node.id }]"
                                :style="{ left: node.x + 'px', top: node.y + 'px' }"
                                @mousedown="startDrag(node, $event)"
                                @click="editNodeOnClick(node.id)"
                            >
                                <!-- 输入圈（左侧） -->
                                <div 
                                    v-if="node.type !== 'start'"
                                    class="connector-input"
                                    @mousedown.stop="startConnection(node, 'input', $event)"
                                    @mouseup.stop="endConnection(node, 'input', $event)"
                                ></div>
                                
                                <!-- 输出圈（右侧） -->
                                <div 
                                    v-if="node.type !== 'end'"
                                    class="connector-output"
                                    @mousedown.stop="startConnection(node, 'output', $event)"
                                ></div>
                                
                                <!-- 判断节点的第二个输出点（下方） -->
                                <div 
                                    v-if="node.type === 'condition'"
                                    class="connector-output-condition"
                                    @mousedown.stop="startConnection(node, 'output-false', $event)"
                                ></div>
                                
                                <div class="node-header">
                                    <span class="node-type-icon">{{ getNodeIcon(node.type) }}</span>
                                    <span class="node-id">{{ node.id }}</span>
                                </div>
                                <div class="node-content">
                                    {{ getNodeContent(node) }}
                                </div>
                            </div>
                            
                            <!-- 正在拖拽的连线 -->
                            <svg class="connections" v-if="isDraggingConnection">
                                <line
                                    :x1="dragConnection.x1"
                                    :y1="dragConnection.y1"
                                    :x2="dragConnection.x2"
                                    :y2="dragConnection.y2"
                                    class="connection-line dragging"
                                />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 预览模式 -->
            <div v-else-if="mode === 'preview'" class="preview-mode">
                <div class="preview-header">
                    <h2>{{ story.metadata.title }}</h2>
                    <button @click="exitPreview" class="btn-exit">退出预览</button>
                </div>
                <div class="preview-content">
                    <div class="preview-node">
                        <div v-if="currentNode" class="node-display">
                            <div class="node-type">{{ getNodeTypeName(currentNode.type) }}</div>
                            <div class="node-content">{{ currentNode.content || '无内容' }}</div>
                            <div v-if="currentNode.speakerId" class="node-speaker">
                                {{ getCharacterName(currentNode.speakerId) }}
                            </div>
                            <div v-if="currentNode.actions && currentNode.actions.length > 0" class="node-actions">
                                <h4>动作:</h4>
                                <div v-for="(action, idx) in currentNode.actions" :key="idx">
                                    {{ action.type }}: {{ action.target }} = {{ action.value }}
                                </div>
                            </div>
                            <div v-if="currentNode.transitions && currentNode.transitions.length > 0" class="node-transitions">
                                <h4>选项:</h4>
                                <button
                                    v-for="(transition, idx) in currentNode.transitions"
                                    :key="idx"
                                    @click="followTransition(transition)"
                                    class="btn-transition"
                                >
                                    {{ transition.label || '继续' }}
                                </button>
                            </div>
                        </div>
                        <div v-else class="node-end">
                            故事已结束
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            mode: 'edit', // select, edit, preview
            selectModePurpose: 'preview', // 'edit' or 'preview'
            stories: [] as any[],
            story: {
                metadata: {
                    id: '',
                    title: '',
                    description: '',
                    author: '',
                    version: '1.0.0',
                    createdAt: '',
                    updatedAt: ''
                },
                characters: [],
                variables: [],
                nodes: [],
                startNodeId: ''
            } as StoryConfig,
            selectedNodeId: '',
            zoom: 1,
            isDragging: false,
            hasMoved: false,
            dragNode: null as any,
            dragOffset: { x: 0, y: 0 },
            currentNodeId: '',
            variableValues: {} as any,
            // 连线相关
            isDraggingConnection: false,
            dragConnection: {
                x1: 0, y1: 0, x2: 0, y2: 0,
                fromNode: null as any,
                fromType: '',
                isConditionOutput: false
            },
            // 编辑对话框状态
            showDialog: false,
            dialogType: '', // 'intro', 'character', 'variable', 'node'
            editingItem: null as any,
            editForm: {
                title: '',
                description: '',
                author: '',
                name: '',
                varType: 'string',
                defaultValue: '',
                comment: ''
            },
            // 节点编辑表单
            nodeEditForm: {
                id: '',
                type: '',
                content: '',
                speakerId: '',
                speakerIds: [] as string[],
                targetSpeakerIds: [] as string[],
                variableId: '',
                operator: '==',
                compareValue: '',
                conditionList: [] as any[]
            },
            // 变量/角色删除确认相关
            showDeleteConfirm: false,
            deleteConfirmType: '', // 'variable' or 'character'
            deletingItem: null as any,
            relatedNodes: [] as any[],
            confirmStep: 0 // 0: 初始, 1: 逐个确认
        };
    },
    computed: {
        canvasStyle() {
            return {
                transform: `scale(${this.zoom})`,
                transformOrigin: 'top left'
            };
        },
        connections() {
            const conns: any[] = [];
            const nodeWidth = 150;
            const connectorRadius = 5; // 连接圈半径调整（12px宽，中心在6px，但考虑transform偏移）
            
            this.story.nodes.forEach(node => {
                if (node.transitions && node.transitions.length > 0) {
                    console.log(`[Story Editor] Node ${node.id} has ${node.transitions.length} transitions`);
                    node.transitions.forEach((transition: any, idx: number) => {
                        const targetNode = this.story.nodes.find(n => n.id === transition.toNodeId);
                        if (targetNode) {
                            const isConditionFalse = transition.condition && transition.condition.isFalse;
                            
                            let x1, y1;
                            
                            // 计算源节点的高度（包括padding）
                            let sourceNodeHeight = 100; // 基础高度
                            const padding = 10; // padding
                            const connectorSize = 12; // 连接圈大小
                            if (node.type === 'condition') {
                                // 判断节点根据条件数量动态计算高度
                                const conditions = (node as any).conditions;
                                sourceNodeHeight = 100 + (conditions?.length || 0) * 30;
                            }
                            const sourceNodeTotalHeight = sourceNodeHeight + padding * 2;
                            
                            if (node.type === 'condition') {
                                // 判断节点（矩形）
                                if (isConditionFalse) {
                                    // 假输出点（底部中心）
                                    x1 = node.x + nodeWidth / 2;
                                    y1 = node.y + sourceNodeTotalHeight + connectorRadius;
                                } else {
                                    // 真输出点（右侧中心）
                                    x1 = node.x + nodeWidth + connectorRadius;
                                    y1 = node.y + sourceNodeTotalHeight / 2 - connectorSize / 2;
                                }
                            } else {
                                // 普通节点（右侧中心）
                                x1 = node.x + nodeWidth + connectorRadius;
                                y1 = node.y + sourceNodeTotalHeight / 2 - connectorSize / 2;
                            }
                            
                            // 计算目标节点的高度（包括padding）
                            let targetNodeHeight = 100; // 基础高度
                            if (targetNode.type === 'condition') {
                                const conditions = (targetNode as any).conditions;
                                targetNodeHeight = 100 + (conditions?.length || 0) * 30;
                            }
                            const targetNodeTotalHeight = targetNodeHeight + padding * 2;

                            // 终点：目标节点的输入点（左侧中心）
                            // 注意：连接圈使用 transform: translateY(-50%)，所以实际中心位置是 height/2 - 6
                            const x2 = targetNode.x - connectorRadius;
                            const y2 = targetNode.y + targetNodeTotalHeight / 2 - connectorSize / 2;
                            
                            console.log(`[Story Editor] Connection: ${node.id} -> ${targetNode.id}, isConditionFalse: ${isConditionFalse}, coords: (${x1}, ${y1}) -> (${x2}, ${y2})`);
                            
                            conns.push({
                                id: `${node.id}-${transition.toNodeId}-${idx}`,
                                x1: x1,
                                y1: y1,
                                x2: x2,
                                y2: y2,
                                label: transition.label || (isConditionFalse ? '假' : '真'),
                                labelX: (x1 + x2) / 2,
                                labelY: (y1 + y2) / 2 - 10,
                                condition: transition.condition,
                                fromNodeId: node.id,
                                toNodeId: transition.toNodeId,
                                isConditionFalse: isConditionFalse
                            });
                        }
                    });
                }
            });
            console.log(`[Story Editor] Total connections: ${conns.length}`);
            return conns;
        },
        currentNode() {
            return this.story.nodes.find(n => n.id === this.currentNodeId);
        }
    },
    methods: {
        newStory() {
            console.log(`[Story Editor Panel v${VERSION}] newStory called, current mode:`, this.mode);
            this.createNewStory();
            console.log(`[Story Editor Panel v${VERSION}] newStory completed, new mode:`, this.mode);
        },
        selectToEdit() {
            console.log('[Story Editor Panel] selectToEdit called');
            this.mode = 'select';
            this.selectModePurpose = 'edit';
            this.loadStories();
        },
        enterEditMode() {
            console.log('[Story Editor Panel] enterEditMode called');
            this.mode = 'edit';
            this.createNewStory();
        },
        enterSelectMode() {
            console.log('[Story Editor Panel] enterSelectMode called');
            this.mode = 'select';
            this.selectModePurpose = 'preview';
            this.loadStories();
        },
        enterPreviewMode(storyId: string) {
            this.mode = 'preview';
            this.loadStory(storyId);
            this.currentNodeId = this.story.startNodeId;
            this.initVariableValues();
        },
        async loadStories() {
            const result = (Editor.Message.send as any)('story-editor', 'get-stories');
            if (result && result.then) {
                result.then((data: any) => {
                    this.stories = data;
                });
            }
        },
        async loadStory(storyId: string) {
            const result = (Editor.Message.send as any)('story-editor', 'load-story', storyId);
            if (result && result.then) {
                return result.then((data: any) => {
                    if (data) {
                        this.story = data;
                    }
                });
            }
        },
        createNewStory() {
            console.log(`[Story Editor Panel v${VERSION}] createNewStory called`);
            this.story = {
                metadata: {
                    id: 'story-' + Date.now(),
                    title: '新故事',
                    description: '',
                    author: '',
                    version: '1.0.0',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                characters: [],
                variables: [],
                nodes: [],
                startNodeId: ''
            };

            // 自动创建一个开始节点
            const startNode = {
                id: 'node-start-' + Date.now(),
                type: 'start',
                x: 100,
                y: 100,
                content: '故事开始',
                speakerId: '',
                actions: [],
                transitions: []
            };
            this.story.nodes.push(startNode);
            this.story.startNodeId = startNode.id;

            this.mode = 'edit';
            console.log(`[Story Editor Panel v${VERSION}] createNewStory completed, mode:`, this.mode);
        },
        selectStory(storyId: string) {
            console.log('[Story Editor Panel] selectStory called, purpose:', this.selectModePurpose);
            if (this.selectModePurpose === 'edit') {
                this.loadStory(storyId).then(() => {
                    this.mode = 'edit';
                });
            } else {
                this.enterPreviewMode(storyId);
            }
        },
        async saveStory() {
            console.log('[Story Editor] saveStory called');
            try {
                // 序列化 story 对象，去除 Vue 响应式属性
                const storyToSave = JSON.parse(JSON.stringify(this.story));
                console.log('[Story Editor] Story to save:', storyToSave.metadata.title);

                const result = (Editor.Message.send as any)('story-editor', 'save-story', storyToSave);
                console.log('[Story Editor] Save result:', result);

                if (result && result.then) {
                    result.then((success: boolean) => {
                        if (success) {
                            console.log('Story saved successfully');
                            alert('故事保存成功！');
                        } else {
                            console.error('Story save failed');
                            alert('故事保存失败！');
                        }
                    }).catch((error: any) => {
                        console.error('Story save error:', error);
                        alert('保存出错：' + error.message);
                    });
                }
            } catch (error: any) {
                console.error('[Story Editor] saveStory error:', error);
                alert('保存出错：' + error.message);
            }
        },
        async importStory() {
            console.log('[Story Editor] importStory called');
            try {
                // 创建一个隐藏的文件输入元素
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.style.display = 'none';

                // 监听文件选择
                input.onchange = async (event: Event) => {
                    const target = event.target as HTMLInputElement;
                    const file = target.files?.[0];
                    if (file) {
                        console.log('[Story Editor] Selected file:', file.name);

                        // 读取文件内容
                        const reader = new FileReader();
                        reader.onload = async (e: ProgressEvent<FileReader>) => {
                            try {
                                const fileContent = e.target?.result as string;
                                console.log('[Story Editor] File content loaded');

                                // 解析 JSON
                                const importedStory = JSON.parse(fileContent);
                                console.log('[Story Editor] Imported story:', importedStory.metadata?.title);

                                // 重新布局节点，确保节点之间有适当距离
                                this.relayoutNodes(importedStory);

                                // 加载导入的故事数据
                                Object.assign(this.story, importedStory);

                                alert(`成功导入故事：${importedStory.metadata?.title || '未命名故事'}`);
                            } catch (error: any) {
                                console.error('[Story Editor] Parse error:', error);
                                alert('文件解析失败：' + error.message);
                            }
                        };
                        reader.readAsText(file);
                    }

                    // 移除 input 元素
                    document.body.removeChild(input);
                };

                // 添加到 DOM 并触发点击
                document.body.appendChild(input);
                input.click();

            } catch (error: any) {
                console.error('[Story Editor] Import story error:', error);
                alert('导入失败：' + error.message);
            }
        },
        relayoutNodes(storyData: any) {
            // 根据节点连接关系重新布局节点
            const nodeMap = new Map();
            storyData.nodes.forEach((node: any) => {
                nodeMap.set(node.id, { ...node, children: [], parents: [] });
            });

            // 建立父子关系
            storyData.nodes.forEach((node: any) => {
                if (node.transitions && node.transitions.length > 0) {
                    node.transitions.forEach((transition: any) => {
                        const child = nodeMap.get(transition.toNodeId);
                        if (child) {
                            child.parents.push(node.id);
                            nodeMap.get(node.id)?.children.push(transition.toNodeId);
                        }
                    });
                }
            });

            // 找到起始节点
            let startNode = storyData.nodes.find((n: any) => n.type === 'start');
            if (!startNode && storyData.nodes.length > 0) {
                startNode = storyData.nodes[0];
            }

            // BFS 布局
            const levels: any[][] = [];
            const visited = new Set();
            const queue = [{ nodeId: startNode.id, level: 0 }];

            visited.add(startNode.id);
            levels[0] = [startNode.id];

            while (queue.length > 0) {
                const { nodeId, level } = queue.shift()!;
                const node = nodeMap.get(nodeId);

                if (node && node.children) {
                    if (!levels[level + 1]) {
                        levels[level + 1] = [];
                    }

                    node.children.forEach((childId: string) => {
                        if (!visited.has(childId)) {
                            visited.add(childId);
                            levels[level + 1].push(childId);
                            queue.push({ nodeId: childId, level: level + 1 });
                        }
                    });
                }
            }

            // 重新设置节点位置
            const nodeWidth = 180;
            const nodeHeight = 100;
            const horizontalSpacing = 220; // 水平间距
            const verticalSpacing = 150; // 垂直间距

            levels.forEach((level, levelIndex) => {
                const levelWidth = level.length * horizontalSpacing;
                const startX = (2000 - levelWidth) / 2; // 居中

                level.forEach((nodeId: string, nodeIndex: number) => {
                    const node = storyData.nodes.find((n: any) => n.id === nodeId);
                    if (node) {
                        node.x = startX + nodeIndex * horizontalSpacing;
                        node.y = 100 + levelIndex * verticalSpacing;
                    }
                });
            });

            console.log('[Story Editor] Nodes relayout completed');
        },
        exitEdit() {
            this.mode = 'select';
            this.loadStories();
        },
        exitPreview() {
            this.mode = 'select';
        },
        addCharacter() {
                    console.log(`[Story Editor Panel v${VERSION}] addCharacter called`);
                    const char = {
                        id: 'char-' + Date.now(),
                        type: 'character',
                        name: '新角色',
                        avatar: '',
                        color: '#3498db',
                        description: ''
                    };
                    this.story.characters.push(char);
                    console.log(`[Story Editor Panel v${VERSION}] Character added, total:`, this.story.characters.length);
                },        editCharacter(char: any) {
            console.log(`[Story Editor Panel v${VERSION}] editCharacter called for:`, char.name);
            this.editingItem = char;
            this.dialogType = 'character';
            this.editForm = {
                title: '',
                description: char.description || '',
                author: '',
                name: char.name,
                varType: 'string',
                defaultValue: '',
                comment: ''
            };
            this.showDialog = true;
        },
        deleteCharacter(id: string) {
            console.log('[Story Editor Panel] deleteCharacter called for id:', id);
            const char = this.story.characters.find(c => c.id === id);
            if (!char) return;

            // 查找所有使用该角色的节点
            const relatedNodes = this.story.nodes.filter(node => {
                const nodeAny = node as any;
                if (nodeAny.speakerId === id) return true;
                if (nodeAny.targetSpeakerIds && nodeAny.targetSpeakerIds.includes(id)) return true;
                return false;
            });

            if (relatedNodes.length > 0) {
                // 显示删除确认对话框
                this.deleteConfirmType = 'character';
                this.deletingItem = char;
                this.relatedNodes = relatedNodes;
                this.confirmStep = 0;
                this.showDeleteConfirm = true;
            } else {
                // 没有关联节点，直接删除
                this.story.characters = this.story.characters.filter(c => c.id !== id);
                console.log('[Story Editor Panel] Character deleted');
            }
        },
        addVariable() {
            console.log(`[Story Editor Panel v${VERSION}] addVariable called`);
            const variable = {
                id: 'var-' + Date.now(),
                type: 'variable',
                name: '新变量',
                varType: 'string',
                defaultValue: '',
                comment: '',
                description: ''
            };
            this.story.variables.push(variable);
            console.log(`[Story Editor Panel v${VERSION}] Variable added, total:`, this.story.variables.length);
        },
        editVariable(variable: any) {
            console.log(`[Story Editor Panel v${VERSION}] editVariable called for:`, variable.name);
            this.editingItem = variable;
            this.dialogType = 'variable';
            this.editForm = {
                title: '',
                description: '',
                author: '',
                name: variable.name,
                varType: variable.varType,
                defaultValue: variable.defaultValue,
                comment: variable.comment || ''
            };
            this.showDialog = true;
        },
        deleteVariable(id: string) {
            console.log('[Story Editor Panel] deleteVariable called for id:', id);
            const variable = this.story.variables.find(v => v.id === id);
            if (!variable) return;

            // 查找所有使用该变量的节点
            const relatedNodes = this.story.nodes.filter(node => {
                const nodeAny = node as any;
                if (nodeAny.conditions && nodeAny.conditions.length > 0) {
                    return nodeAny.conditions.some((cond: any) => cond.variableId === id);
                }
                return false;
            });

            if (relatedNodes.length > 0) {
                // 显示删除确认对话框
                this.deleteConfirmType = 'variable';
                this.deletingItem = variable;
                this.relatedNodes = relatedNodes;
                this.confirmStep = 0;
                this.showDeleteConfirm = true;
            } else {
                // 没有关联节点，直接删除
                this.story.variables = this.story.variables.filter(v => v.id !== id);
                console.log('[Story Editor Panel] Variable deleted');
            }
        },
        editIntro() {
            console.log(`[Story Editor Panel v${VERSION}] editIntro called`);
            this.editingItem = this.story.metadata;
            this.dialogType = 'intro';
            this.editForm = {
                title: this.story.metadata.title,
                description: this.story.metadata.description || '',
                author: this.story.metadata.author || '',
                name: '',
                varType: 'string',
                defaultValue: '',
                comment: ''
            };
            this.showDialog = true;
        },
        closeDialog() {
            console.log(`[Story Editor Panel v${VERSION}] closeDialog called`);
            this.showDialog = false;
            this.editingItem = null;
            this.dialogType = '';
        },
        saveEdit() {
            console.log(`[Story Editor Panel v${VERSION}] saveEdit called, type:`, this.dialogType);

            if (this.dialogType === 'intro' && this.editingItem) {
                this.story.metadata.title = this.editForm.title;
                this.story.metadata.description = this.editForm.description;
                this.story.metadata.author = this.editForm.author;
                console.log(`[Story Editor Panel v${VERSION}] Story intro saved`);
            } else if (this.dialogType === 'character' && this.editingItem) {
                this.editingItem.name = this.editForm.name;
                this.editingItem.description = this.editForm.description;
                console.log(`[Story Editor Panel v${VERSION}] Character saved:`, this.editForm.name);
            } else if (this.dialogType === 'variable' && this.editingItem) {
                this.editingItem.name = this.editForm.name;
                this.editingItem.varType = this.editForm.varType;
                this.editingItem.defaultValue = this.editForm.defaultValue;
                this.editingItem.comment = this.editForm.comment;
                console.log(`[Story Editor Panel v${VERSION}] Variable saved:`, this.editForm.name);
            } else if (this.dialogType === 'node') {
                this.saveNodeEdit();
            }

            this.closeDialog();
        },
        addNode(type: string) {
            console.log(`[Story Editor] Adding node of type: ${type}`);
            const node: any = {
                id: 'node-' + Date.now(),
                type,
                x: 100 + this.story.nodes.length * 50,
                y: 100 + this.story.nodes.length * 30,
                content: '',
                speakerId: '',
                targetSpeakerIds: [],
                conditions: [],
                actions: [],
                transitions: []
            };

            this.story.nodes.push(node);
            console.log(`[Story Editor] Node created: ${node.id}, type: ${node.type}`);

            if (type === 'start') {
                this.story.startNodeId = node.id;
            }
        },
        selectNode(id: string) {
            this.selectedNodeId = id;
        },
        editNodeOnClick(id: string) {
            if (!this.hasMoved) {
                this.selectedNodeId = id;
                this.editNode(id);
            }
        },
        deleteNode() {
            if (!this.selectedNodeId) return;
            
            const nodeIndex = this.story.nodes.findIndex(n => n.id === this.selectedNodeId);
            if (nodeIndex === -1) return;
            
            const node = this.story.nodes[nodeIndex];
            
            // 不能删除开始节点
            if (node.type === 'start') {
                console.warn('[Story Editor] Cannot delete start node');
                return;
            }
            
            // 删除所有指向该节点的连接
            this.story.nodes.forEach(n => {
                if (n.transitions) {
                    n.transitions = n.transitions.filter((t: any) => t.toNodeId !== this.selectedNodeId);
                }
            });
            
            // 如果该节点是当前节点，清空当前节点ID
            if (this.currentNodeId === this.selectedNodeId) {
                this.currentNodeId = '';
            }
            
            // 如果该节点是开始节点，更新开始节点
            if (this.story.startNodeId === this.selectedNodeId) {
                this.story.startNodeId = '';
            }
            
            // 删除节点
            this.story.nodes.splice(nodeIndex, 1);
            
            // 清空选中状态
            this.selectedNodeId = '';
            
            console.log(`[Story Editor] Node ${this.selectedNodeId} deleted`);
        },
        deleteCurrentNode() {
            if (!this.nodeEditForm.id) return;

            const nodeId = this.nodeEditForm.id;
            const node = this.story.nodes.find(n => n.id === nodeId);
            if (!node) return;

            // 不能删除开始节点
            if (node.type === 'start') {
                alert('不能删除开始节点');
                return;
            }

            // 确认删除
            if (confirm(`确定要删除此节点吗？\n节点类型：${this.getNodeTypeName(node.type)}\n节点ID：${nodeId}`)) {
                const nodeIndex = this.story.nodes.findIndex(n => n.id === nodeId);
                if (nodeIndex > -1) {
                    // 删除所有指向该节点的连接
                    this.story.nodes.forEach(n => {
                        if (n.transitions) {
                            n.transitions = n.transitions.filter((t: any) => t.toNodeId !== nodeId);
                        }
                    });

                    // 如果该节点是当前节点，清空当前节点ID
                    if (this.currentNodeId === nodeId) {
                        this.currentNodeId = '';
                    }

                    // 如果该节点是开始节点，更新开始节点
                    if (this.story.startNodeId === nodeId) {
                        this.story.startNodeId = '';
                    }

                    // 删除节点
                    this.story.nodes.splice(nodeIndex, 1);

                    // 清空选中状态和编辑状态
                    this.selectedNodeId = '';
                    this.closeDialog();

                    console.log(`[Story Editor] Node ${nodeId} deleted from dialog`);
                }
            }
        },
        editNode(nodeId: string) {
            const node = this.story.nodes.find(n => n.id === nodeId);
            if (!node) return;

            this.nodeEditForm = {
                id: node.id,
                type: node.type,
                content: node.content || '',
                speakerId: node.speakerId || '',
                speakerIds: [],
                targetSpeakerIds: [],
                variableId: '',
                operator: '==',
                compareValue: '',
                conditionList: []
            };

            // 如果是对话节点，提取目标角色信息
            if (node.type === 'dialogue' && (node as any).targetSpeakerIds) {
                this.nodeEditForm.targetSpeakerIds = [...(node as any).targetSpeakerIds];
            }

            // 如果是动作节点，已经有 speakerId，不需要额外处理

            // 如果是判断节点，提取条件信息
            if (node.type === 'condition' && (node as any).conditions) {
                this.nodeEditForm.conditionList = JSON.parse(JSON.stringify((node as any).conditions));
            }

            this.dialogType = 'node';
            this.showDialog = true;
        },
        saveNodeEdit() {
            const node = this.story.nodes.find(n => n.id === this.nodeEditForm.id);
            if (!node) return;

            node.content = this.nodeEditForm.content;

            if (node.type === 'dialogue') {
                node.speakerId = this.nodeEditForm.speakerId;
                (node as any).targetSpeakerIds = [...this.nodeEditForm.targetSpeakerIds];
            }

            if (node.type === 'action') {
                node.speakerId = this.nodeEditForm.speakerId;
            }

            if (node.type === 'condition') {
                (node as any).conditions = JSON.parse(JSON.stringify(this.nodeEditForm.conditionList));
            }

            this.closeDialog();
            console.log(`[Story Editor] Node ${node.id} updated`);
        },
        addCondition() {
            this.nodeEditForm.conditionList.push({
                variableId: '',
                operator: '==',
                value: ''
            });
        },
        removeCondition(index: number) {
            this.nodeEditForm.conditionList.splice(index, 1);
        },
        cancelDelete() {
            this.showDeleteConfirm = false;
            this.deleteConfirmType = '';
            this.deletingItem = null;
            this.relatedNodes = [];
            this.confirmStep = 0;
        },
        confirmDeleteNode() {
            if (this.confirmStep < this.relatedNodes.length - 1) {
                // 移动到下一个节点
                this.confirmStep++;
            } else {
                // 所有节点都已确认，执行删除
                if (this.deleteConfirmType === 'character') {
                    this.story.characters = this.story.characters.filter(c => c.id !== this.deletingItem.id);
                    console.log('[Story Editor Panel] Character deleted after confirmation');
                } else if (this.deleteConfirmType === 'variable') {
                    this.story.variables = this.story.variables.filter(v => v.id !== this.deletingItem.id);
                    console.log('[Story Editor Panel] Variable deleted after confirmation');
                }
                this.cancelDelete();
            }
        },
        handleKeyDown(event: KeyboardEvent) {
            // 检查是否按下了Delete键或Backspace键
            if (event.key === 'Delete' || event.key === 'Backspace') {
                // 如果有选中的节点，删除它
                if (this.selectedNodeId) {
                    this.deleteNode();
                }
            }
        },
        startDrag(node: any, event: MouseEvent) {
            this.isDragging = true;
            this.hasMoved = false;
            this.dragNode = node;

            // 使用movementX/Y不需要手动计算偏移
            // 偏移会由onDrag中的movement处理

            document.addEventListener('mousemove', this.onDrag);
            document.addEventListener('mouseup', this.stopDrag);
        },
        onDrag(event: MouseEvent) {
            if (this.isDragging && this.dragNode) {
                this.hasMoved = true;
                // 考虑缩放比例
                const deltaX = event.movementX / this.zoom;
                const deltaY = event.movementY / this.zoom;

                this.dragNode.x += deltaX;
                this.dragNode.y += deltaY;
            }
        },
        stopDrag() {
            // 延迟重置 isDragging，避免与 click 事件冲突
            setTimeout(() => {
                this.isDragging = false;
                this.hasMoved = false;
            }, 100);
            this.dragNode = null;
            document.removeEventListener('mousemove', this.onDrag);
            document.removeEventListener('mouseup', this.stopDrag);
        },
        zoomIn() {
            this.zoom = Math.min(this.zoom + 0.1, 2);
        },
        zoomOut() {
            this.zoom = Math.max(this.zoom - 0.1, 0.5);
        },
        // 连线相关方法
        startConnection(node: any, type: string, event: MouseEvent) {
            console.log(`[Story Editor Panel v${VERSION}] startConnection from ${node.id}, type: ${type}, nodeType: ${node.type}`);
            
            // 判断节点可以有两个输出点，普通节点只有一个
            if (node.type === 'end' || type === 'input') {
                console.log(`[Story Editor Panel v${VERSION}] Cannot start connection from end node or input`);
                return;
            }

            this.isDraggingConnection = true;
            
            const rect = (event.target as HTMLElement).getBoundingClientRect();
            const canvasElement = this.$refs.canvas as HTMLElement;
            const canvasRect = canvasElement.getBoundingClientRect();
            
            this.dragConnection = {
                x1: (rect.left - canvasRect.left + rect.width / 2) / this.zoom,
                y1: (rect.top - canvasRect.top + rect.height / 2) / this.zoom,
                x2: (rect.left - canvasRect.left + rect.width / 2) / this.zoom,
                y2: (rect.top - canvasRect.top + rect.height / 2) / this.zoom,
                fromNode: node,
                fromType: type,
                isConditionOutput: type === 'output-false'
            };
            
            console.log(`[Story Editor Panel v${VERSION}] dragConnection created:`, this.dragConnection);

            document.addEventListener('mousemove', this.onDragConnection);
            document.addEventListener('mouseup', this.onDragConnectionEnd);
        },
        onDragConnection(event: MouseEvent) {
            if (this.isDraggingConnection) {
                const canvasElement = this.$refs.canvas as HTMLElement;
                const canvasRect = canvasElement.getBoundingClientRect();
                
                // 考虑缩放比例
                this.dragConnection.x2 = (event.clientX - canvasRect.left) / this.zoom;
                this.dragConnection.y2 = (event.clientY - canvasRect.top) / this.zoom;
            }
        },
        onDragConnectionEnd(event: MouseEvent) {
            if (!this.isDraggingConnection) return;
            
            this.isDraggingConnection = false;
            document.removeEventListener('mousemove', this.onDragConnection);
            document.removeEventListener('mouseup', this.onDragConnectionEnd);
        },
        endConnection(node: any, type: string, event: MouseEvent) {
            console.log(`[Story Editor Panel v${VERSION}] endConnection to ${node.id}, type: ${type}`);
            
            // 只能连接到输入圈
            if (type !== 'input') {
                console.log(`[Story Editor Panel v${VERSION}] Cannot connect to non-input type`);
                return;
            }

            // 检查是否正在拖拽连线
            if (!this.isDraggingConnection || !this.dragConnection.fromNode) {
                console.log(`[Story Editor Panel v${VERSION}] Not dragging connection`);
                return;
            }

            // 不能连接到自己
            if (this.dragConnection.fromNode.id === node.id) {
                console.log(`[Story Editor Panel v${VERSION}] Cannot connect to self`);
                return;
            }

            // 检查是否已经存在连接
            const existingConnection = this.dragConnection.fromNode.transitions?.find(
                (t: any) => t.toNodeId === node.id
            );
            
            if (existingConnection) {
                console.log(`[Story Editor Panel v${VERSION}] Connection already exists`);
                return;
            }
            
            console.log(`[Story Editor Panel v${VERSION}] Creating new connection`);
            
            // 创建新的连接
            if (!this.dragConnection.fromNode.transitions) {
                this.dragConnection.fromNode.transitions = [];
            }
            
            // 判断节点的第二个输出点创建带条件的连接
            const connectionData: any = {
                toNodeId: node.id,
                label: '继续'
            };
            
            if (this.dragConnection.isConditionOutput) {
                connectionData.label = '假';
                connectionData.condition = {
                    isFalse: true,
                    variableId: '',
                    operator: '!=',
                    value: ''
                };
            } else if (this.dragConnection.fromNode.type === 'condition') {
                connectionData.label = '真';
                connectionData.condition = {
                    isFalse: false,
                    variableId: '',
                    operator: '==',
                    value: ''
                };
            }
            
            console.log(`[Story Editor Panel v${VERSION}] Connection data:`, connectionData);

            this.dragConnection.fromNode.transitions.push(connectionData);
            console.log(`[Story Editor Panel v${VERSION}] Connection created successfully, total transitions: ${this.dragConnection.fromNode.transitions.length}`);
            console.log(`[Story Editor Panel v${VERSION}] Connection created: ${this.dragConnection.fromNode.id} -> ${node.id}`);

            // 清理连线拖拽状态
            this.isDraggingConnection = false;
            document.removeEventListener('mousemove', this.onDragConnection);
            document.removeEventListener('mouseup', this.onDragConnectionEnd);
        },
        getBezierPath(conn: any): string {
            const x1 = conn.x1;
            const y1 = conn.y1;
            const x2 = conn.x2;
            const y2 = conn.y2;
            
            console.log(`[Story Editor] getBezierPath: from (${x1}, ${y1}) to (${x2}, ${y2}), isConditionFalse: ${conn.isConditionFalse}`);
            
            // 红圈半径是 6px，需要调整终点位置
            const connectorRadius = 6;
            const controlOffset = Math.abs(x2 - x1) * 0.5;
            
            // 使用贝塞尔曲线创建平滑的连线
            // 控制点计算：使用三次贝塞尔曲线
            let path = '';
            
            if (Math.abs(y2 - y1) > Math.abs(x2 - x1)) {
                // 垂直方向的主导
                path = `M ${x1} ${y1} C ${x1} ${y1 + controlOffset}, ${x2} ${y2 - controlOffset}, ${x2} ${y2}`;
            } else {
                // 水平方向的主导
                path = `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;
            }
            
            console.log(`[Story Editor] Generated path: ${path}`);
            
            return path;
        },
        deleteConnection(fromNodeId: string, toNodeId: string) {
            const fromNode = this.story.nodes.find(n => n.id === fromNodeId);
            if (fromNode && fromNode.transitions) {
                fromNode.transitions = fromNode.transitions.filter(t => t.toNodeId !== toNodeId);
                console.log(`[Story Editor Panel v${VERSION}] Connection deleted: ${fromNodeId} -> ${toNodeId}`);
            }
        },
        getNodeIcon(type: string): string {
            const icons: any = {
                start: '🚀',
                dialogue: '💬',
                action: '⚡',
                transition: '🔀',
                condition: '❓',
                end: '🏁'
            };
            return icons[type] || '📝';
        },
        getNodeContent(node: StoryNode): string {
            // 开始节点和过渡节点：显示内容
            if (node.type === 'start' || node.type === 'transition') {
                if (node.content) {
                    return node.content.substring(0, 20) + (node.content.length > 20 ? '...' : '');
                }
                return this.getNodeTypeName(node.type);
            }

            // 对话节点：显示内容 + 发起角色 + 对谁说的
            if (node.type === 'dialogue') {
                let content = '';
                if (node.speakerId) {
                    content += this.getCharacterName(node.speakerId) + ': ';
                }
                if (node.content) {
                    content += node.content.substring(0, 15) + (node.content.length > 15 ? '...' : '');
                }
                // 添加对谁说的信息
                const targetSpeakerIds = (node as any).targetSpeakerIds;
                if (targetSpeakerIds && targetSpeakerIds.length > 0) {
                    const targetNames = targetSpeakerIds.map((id: string) => this.getCharacterName(id)).join(', ');
                    content += ' → ' + targetNames;
                }
                return content || this.getNodeTypeName(node.type);
            }

            // 动作节点：显示角色 + 动作说明
            if (node.type === 'action') {
                let content = '';
                if (node.speakerId) {
                    content += this.getCharacterName(node.speakerId) + ': ';
                }
                if (node.content) {
                    content += node.content.substring(0, 15) + (node.content.length > 15 ? '...' : '');
                }
                return content || this.getNodeTypeName(node.type);
            }

            // 判断节点：显示条件数量
            if (node.type === 'condition') {
                const conditions = (node as any).conditions;
                if (conditions && conditions.length > 0) {
                    return `条件 x${conditions.length}`;
                }
                return this.getNodeTypeName(node.type);
            }

            // 结束节点：显示内容
            if (node.type === 'end') {
                if (node.content) {
                    return node.content.substring(0, 20) + (node.content.length > 20 ? '...' : '');
                }
                return this.getNodeTypeName(node.type);
            }

            return this.getNodeTypeName(node.type);
        },
        getNodeTypeName(type: string): string {
            const names: any = {
                start: '开头',
                dialogue: '对话',
                action: '动作',
                transition: '过渡',
                condition: '判断',
                end: '结束'
            };
            return names[type] || type;
        },
        getCharacterName(id: string): string {
            const char = this.story.characters.find(c => c.id === id);
            return char ? char.name : '未知角色';
        },
        formatDate(dateStr: string): string {
            const date = new Date(dateStr);
            return date.toLocaleDateString();
        },
        initVariableValues() {
            this.variableValues = {};
            this.story.variables.forEach(variable => {
                this.variableValues[variable.id] = variable.defaultValue;
            });
        },
        followTransition(transition: any) {
            // 检查条件
            if (transition.condition) {
                const value = this.variableValues[transition.condition.variableId];
                let conditionMet = false;

                switch (transition.condition.operator) {
                    case '==':
                        conditionMet = value == transition.condition.value;
                        break;
                    case '!=':
                        conditionMet = value != transition.condition.value;
                        break;
                    case '>':
                        conditionMet = value > transition.condition.value;
                        break;
                    case '<':
                        conditionMet = value < transition.condition.value;
                        break;
                    case '>=':
                        conditionMet = value >= transition.condition.value;
                        break;
                    case '<=':
                        conditionMet = value <= transition.condition.value;
                        break;
                }

                if (!conditionMet) {
                    alert('条件不满足，无法继续');
                    return;
                }
            }

            // 执行动作
            const currentNode = this.story.nodes.find(n => n.id === this.currentNodeId);
            if (currentNode && currentNode.actions) {
                currentNode.actions.forEach((action: any) => {
                    if (action.type === 'setVariable') {
                        this.variableValues[action.target] = action.value;
                    }
                });
            }

            // 跳转到下一个节点
            this.currentNodeId = transition.toNodeId;
        }
    }
});

module.exports = Editor.Panel.define({
    listeners: {
        show() {
            console.log(`[Story Editor Panel v${VERSION}] Panel shown, current mode:`, componentInstance ? (componentInstance as any).mode : 'no instance');
        },
        hide() { console.log('hide'); }
    },
    template: readFileSync(join(__dirname, '../../../static/template/default/index.html'), 'utf-8'),
    style: readFileSync(join(__dirname, '../../../static/style/default/index.css'), 'utf-8'),
    $: {
        app: '#app'
    },
    methods: {
        newStory() {
            console.log(`[Story Editor Panel Methods v${VERSION}] newStory called`);
            if (!componentInstance) {
                console.log(`[Story Editor Panel Methods v${VERSION}] Component instance is null`);
                return;
            }

            console.log(`[Story Editor Panel Methods v${VERSION}] Current mode before:`, (componentInstance as any).mode);
            
            // 调用组件的createNewStory方法，它会创建故事并设置mode
            (componentInstance as any).createNewStory();
            
            console.log(`[Story Editor Panel Methods v${VERSION}] Current mode after:`, (componentInstance as any).mode);
        },
        selectToEdit() {
            console.log('[Story Editor Panel Methods] selectToEdit called');
            console.log('[Story Editor Panel Methods] Component instance:', componentInstance);
            if (componentInstance) {
                console.log('[Story Editor Panel Methods] Current mode:', componentInstance.mode);
                if (typeof componentInstance.selectToEdit === 'function') {
                    console.log('[Story Editor Panel Methods] Calling selectToEdit');
                    componentInstance.selectToEdit();
                    console.log('[Story Editor Panel Methods] Mode after selectToEdit:', componentInstance.mode);
                }
            }
        },
        enterEditMode() {
            console.log('[Story Editor Panel Methods] enterEditMode called');
            console.log('[Story Editor Panel Methods] Component instance:', componentInstance);
            if (componentInstance) {
                console.log('[Story Editor Panel Methods] Current mode:', componentInstance.mode);
                if (typeof componentInstance.enterEditMode === 'function') {
                    console.log('[Story Editor Panel Methods] Calling enterEditMode');
                    componentInstance.enterEditMode();
                    console.log('[Story Editor Panel Methods] Mode after enterEditMode:', componentInstance.mode);
                }
            }
        },
        enterSelectMode() {
            console.log('[Story Editor Panel Methods] enterSelectMode called');
            if (componentInstance && componentInstance.enterSelectMode) {
                componentInstance.enterSelectMode();
            }
        },
        enterPreviewMode(storyId: string) {
            console.log('[Story Editor Panel Methods] enterPreviewMode called with storyId:', storyId);
            if (componentInstance && componentInstance.enterPreviewMode) {
                componentInstance.enterPreviewMode(storyId);
            }
        }
    },
    ready() {
        console.log(`[Story Editor v${VERSION}] Panel ready`);
        if (this.$.app) {
            const app = createApp(StoryEditorComponent);
            app.config.compilerOptions.isCustomElement = (tag) => tag.startsWith('ui-');
            const instance = app.mount(this.$.app);
            panelDataMap.set(this, app);
            componentInstance = instance;
            console.log(`[Story Editor v${VERSION}] Component mounted, initial mode:`, (instance as any).mode);

            // 手动添加键盘事件监听，确保 this 上下文正确
            const instanceAny = instance as any;
            if (instanceAny.handleKeyDown) {
                const boundHandleKeyDown = instanceAny.handleKeyDown.bind(instance);
                document.addEventListener('keydown', boundHandleKeyDown);
                // 保存绑定的函数，以便在关闭时移除
                instanceAny.boundHandleKeyDown = boundHandleKeyDown;
            }

            // 自动创建新故事
            if (instanceAny.createNewStory) {
                instanceAny.createNewStory();
            }
        }
    },
beforeClose() { },
    close() {
        const app = panelDataMap.get(this);
        if (app) {
            // 移除键盘事件监听
            const instance = componentInstance;
            if (instance && (instance as any).boundHandleKeyDown) {
                document.removeEventListener('keydown', (instance as any).boundHandleKeyDown);
            }
            app.unmount();
        }
        componentInstance = null;
    },
});