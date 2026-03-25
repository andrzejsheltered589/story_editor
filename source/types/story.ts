/**
 * 故事数据结构类型定义 - 重新设计
 */

/**
 * 故事简介节点
 */
export interface StoryIntroNode {
  id: string;
  type1: string;
  title: string;
  description: string;
  author: string;
  version: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 角色信息节点
 */
export interface CharacterNode {
  id: string;
  type: "character";
  name: string;
  avatar?: string;
  color?: string;
  description?: string;
}

/**
 * 变量节点
 */
export interface VariableNode {
  id: string;
  type: "variable";
  name: string;
  varType: "string" | "number" | "boolean";
  defaultValue: any;
  description?: string;
}

/**
 * 左侧目录节点类型
 */
export type DirectoryNode = StoryIntroNode | CharacterNode | VariableNode;

/**
 * 剧情节点类型
 */
export interface StoryNode {
  id: string;
  type: "start" | "dialogue" | "action" | "transition" | "condition" | "end";
  x: number;
  y: number;
  content?: string;
  speakerId?: string;
  targetSpeakerIds?: string[];
  conditions?: Condition[];
  actions?: Action[];
  transitions?: Transition[];
}

/**
 * 条件定义
 */
export interface Condition {
  variableId: string;
  operator: "==" | "!=" | ">" | "<" | ">=" | "<=";
  value: any;
}

/**
 * 动作定义
 */
export interface Action {
  type: "setVariable" | "addItem" | "removeItem" | "playSound";
  target: string;
  value?: any;
}

/**
 * 过渡定义（连线）
 */
export interface Transition {
  toNodeId: string;
  condition?: {
    variableId: string;
    operator: "==" | "!=" | ">" | "<" | ">=" | "<=";
    value: any;
  };
  label?: string;
}

/**
 * 完整的故事配置
 */
export interface StoryConfig {
  metadata: StoryIntroNode;
  characters: CharacterNode[];
  variables: VariableNode[];
  nodes: StoryNode[];
  startNodeId: string;
}

/**
 * 编辑器状态
 */
export interface EditorState {
  mode: "select" | "edit" | "preview";
  selectedStoryId: string | null;
  selectedNodeId: string | null;
  isDragging: boolean;
  zoom: number;
}

/**
 * 预览状态
 */
export interface PreviewState {
  currentNodeId: string;
  variableValues: { [key: string]: any };
  history: string[];
}
