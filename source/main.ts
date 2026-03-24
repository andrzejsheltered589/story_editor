const packageJSON = require('../package.json');
const fs = require('fs-extra');
const path = require('path');

/**
 * @en Registration method for the main process of Extension
 * @zh 为扩展的主进程的注册方法
 */
const methods = {
    /**
     * @en Open panel in edit mode with new story
     * @zh 打开编辑模式面板并创建新故事
     */
    openNewStory() {
        console.log('[Story Editor] Opening panel with new story');
        Editor.Panel.open(packageJSON.name);
        // 确保面板准备好后再发送消息
        setTimeout(() => {
            console.log('[Story Editor] Sending new-story message');
            Editor.Message.send(packageJSON.name, 'new-story');
        }, 300);
    },

    /**
     * @en Open panel in edit mode with story selection
     * @zh 打开编辑模式面板，选择故事进行编辑
     */
    openEditStory() {
        console.log('[Story Editor] Opening panel for story editing');
        Editor.Panel.open(packageJSON.name);
        // 确保面板准备好后再发送消息
        setTimeout(() => {
            console.log('[Story Editor] Sending select-to-edit message');
            Editor.Message.send(packageJSON.name, 'select-to-edit');
        }, 300);
    },

    /**
     * @en Open panel in select mode
     * @zh 打开选择模式面板
     */
    openEditMode() {
        console.log('[Story Editor] Opening panel in edit mode');
        Editor.Panel.open(packageJSON.name);
        // 确保面板准备好后再发送消息
        setTimeout(() => {
            console.log('[Story Editor] Sending enter-edit-mode message');
            Editor.Message.send(packageJSON.name, 'enter-edit-mode');
        }, 300);
    },

    /**
     * @en Open panel in select mode
     * @zh 打开选择模式面板
     */
    openSelectMode() {
        Editor.Panel.open(packageJSON.name);
        // 确保面板准备好后再发送消息
        setTimeout(() => {
            Editor.Message.send(packageJSON.name, 'enter-select-mode');
        }, 300);
    },

    /**
     * @en Open story in preview mode
     * @zh 在预览模式打开故事
     */
    openPreviewMode(storyId: string) {
        Editor.Panel.open(packageJSON.name);
        // 确保面板准备好后再发送消息
        setTimeout(() => {
            Editor.Message.send(packageJSON.name, 'enter-preview-mode', storyId);
        }, 300);
    },

    /**
     * @en Get all stories from story library
     * @zh 获取故事库中的所有故事
     */
    getStories() {
        try {
            const storiesDir = path.join(Editor.Project.path, 'stories');
            if (!fs.existsSync(storiesDir)) {
                fs.mkdirSync(storiesDir, { recursive: true });
                return [];
            }

            const files = fs.readdirSync(storiesDir).filter((f: string) => f.endsWith('.json'));
            const stories = [];

            for (const file of files) {
                try {
                    const content = fs.readFileSync(path.join(storiesDir, file), 'utf-8');
                    const story = JSON.parse(content);
                    stories.push({
                        id: story.metadata.id,
                        title: story.metadata.title,
                        description: story.metadata.description,
                        author: story.metadata.author,
                        createdAt: story.metadata.createdAt,
                        updatedAt: story.metadata.updatedAt
                    });
                } catch (error) {
                    console.error(`Failed to load story ${file}:`, error);
                }
            }

            return stories;
        } catch (error) {
            console.error('Failed to get stories:', error);
            return [];
        }
    },

    /**
     * @en Load story by ID
     * @zh 根据ID加载故事
     */
    loadStory(storyId: string) {
        try {
            const storyPath = path.join(Editor.Project.path, 'stories', `${storyId}.json`);
            if (fs.existsSync(storyPath)) {
                const content = fs.readFileSync(storyPath, 'utf-8');
                return JSON.parse(content);
            }
            return null;
        } catch (error) {
            console.error('Failed to load story:', error);
            return null;
        }
    },

    /**
     * @en Save story
     * @zh 保存故事
     */
    saveStory(story: any) {
        console.log('[Main Process] saveStory called, story title:', story?.metadata?.title);
        try {
            const storiesDir = path.join(Editor.Project.path, 'stories');
            console.log('[Main Process] Stories directory:', storiesDir);
            if (!fs.existsSync(storiesDir)) {
                fs.mkdirSync(storiesDir, { recursive: true });
                console.log('[Main Process] Created stories directory');
            }

            story.metadata.updatedAt = new Date().toISOString();
            // 使用故事标题作为文件名（清理非法字符）
            const safeTitle = (story.metadata.title || '未命名故事')
                .replace(/[<>:"/\\|?*]/g, '_')
                .trim();
            const filename = `${safeTitle}.json`;
            const storyPath = path.join(storiesDir, filename);
            console.log('[Main Process] Saving to:', storyPath);
            fs.writeFileSync(storyPath, JSON.stringify(story, null, 2), 'utf-8');
            console.log('[Main Process] Story saved successfully');

            return true;
        } catch (error) {
            console.error('[Main Process] Failed to save story:', error);
            return false;
        }
    },

    /**
     * @en Export story
     * @zh 导出故事
     */
    exportStory(story: any) {
        if (window.Editor && window.Editor.Dialog) {
            (window.Editor.Dialog as any).openSave({
                title: '导出故事',
                path: Editor.Project.path,
                filters: [
                    { name: 'Story Files', extensions: ['json'] },
                    { name: 'All Files', extensions: ['*'] }
                ],
                defaultName: `${story.metadata.title || 'story'}.json`,
            }).then((result: any) => {
                if (result && result.filePath) {
                    try {
                        fs.writeFileSync(result.filePath, JSON.stringify(story, null, 2), 'utf-8');
                        console.log('Story exported successfully');
                    } catch (error) {
                        console.error('Failed to export story:', error);
                    }
                }
            }).catch((err: any) => {
                console.error('Export error:', err);
            });
        }
    },

    /**
     * @en Delete story
     * @zh 删除故事
     */
    deleteStory(storyId: string) {
        try {
            const storyPath = path.join(Editor.Project.path, 'stories', `${storyId}.json`);
            if (fs.existsSync(storyPath)) {
                fs.unlinkSync(storyPath);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to delete story:', error);
            return false;
        }
    },

    /**
     * @en Read file content
     * @zh 读取文件内容
     */
    readFile(filePath: string) {
        try {
            console.log('[Main Process] Reading file:', filePath);
            const content = fs.readFileSync(filePath, 'utf-8');
            console.log('[Main Process] File read successfully, length:', content.length);
            return content;
        } catch (error) {
            console.error('[Main Process] Failed to read file:', error);
            return null;
        }
    },

    /**
     * @en Open file select dialog
     * @zh 打开文件选择对话框
     */
    openFileSelect(options: any) {
        return new Promise((resolve) => {
            try {
                // 使用 Electron 的 dialog API
                const { dialog } = require('electron');
                dialog.showOpenDialog({
                    title: options.title || '选择文件',
                    defaultPath: options.path || Editor.Project.path,
                    filters: options.filters || [],
                    properties: ['openFile']
                }).then((result: any) => {
                    if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
                        resolve({ filePath: result.filePaths[0] });
                    } else {
                        resolve(null);
                    }
                }).catch((err: any) => {
                    console.error('[Main Process] File select error:', err);
                    resolve(null);
                });
            } catch (error: any) {
                console.error('[Main Process] Dialog API error:', error);
                resolve(null);
            }
        });
    },
};

/**
 * @en Method Triggered on Extension Startup
 * @zh 扩展启动时触发的方法
 */
function load() {
    console.log('[Story Editor] Extension loaded');
    console.log('[Story Editor] Package name:', packageJSON.name);
    console.log('[Story Editor] Available methods:', Object.keys(methods));
}

/**
 * @en Method triggered when uninstalling the extension
 * @zh 卸载扩展时触发的方法
 */
function unload() { }

// 直接导出
exports.methods = methods;
exports.load = load;
exports.unload = unload;