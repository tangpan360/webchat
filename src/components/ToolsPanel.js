import React, { useState, useEffect } from 'react';
import { 
  getCustomTools, 
  addCustomTool, 
  updateCustomTool, 
  deleteCustomTool 
} from '../utils/storage';

const ToolsPanel = () => {
  const [tools, setTools] = useState([]);
  const [newToolName, setNewToolName] = useState('');
  const [newToolPrompt, setNewToolPrompt] = useState('');
  const [editingTool, setEditingTool] = useState(null);
  const [saveMessage, setSaveMessage] = useState({ visible: false, type: '', text: '' });

  // 加载自定义工具
  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    const customTools = await getCustomTools();
    setTools(customTools);
  };

  // 添加新工具
  const handleAddTool = async (e) => {
    e.preventDefault();
    
    if (!newToolName.trim() || !newToolPrompt.trim()) {
      showMessage('error', '名称和提示词不能为空');
      return;
    }
    
    try {
      const newTool = {
        name: newToolName.trim(),
        prompt: newToolPrompt.trim()
      };
      
      await addCustomTool(newTool);
      
      // 重置表单
      setNewToolName('');
      setNewToolPrompt('');
      
      // 刷新工具列表
      loadTools();
      
      showMessage('success', '添加成功');
      
      // 通知content script更新工具按钮
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: 'updateCustomTools'
        });
      }
    } catch (error) {
      console.error('添加工具失败:', error);
      showMessage('error', '添加失败');
    }
  };

  // 开始编辑工具
  const handleEdit = (tool) => {
    setEditingTool({
      ...tool,
      tempName: tool.name,
      tempPrompt: tool.prompt
    });
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingTool(null);
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingTool.tempName.trim() || !editingTool.tempPrompt.trim()) {
      showMessage('error', '名称和提示词不能为空');
      return;
    }
    
    try {
      const updatedTool = {
        ...editingTool,
        name: editingTool.tempName.trim(),
        prompt: editingTool.tempPrompt.trim()
      };
      
      await updateCustomTool(updatedTool);
      setEditingTool(null);
      loadTools();
      showMessage('success', '更新成功');
      
      // 通知content script更新工具按钮
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: 'updateCustomTools'
        });
      }
    } catch (error) {
      console.error('更新工具失败:', error);
      showMessage('error', '更新失败');
    }
  };

  // 删除工具
  const handleDelete = async (toolId) => {
    try {
      await deleteCustomTool(toolId);
      loadTools();
      showMessage('success', '删除成功');
      
      // 通知content script更新工具按钮
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: 'updateCustomTools'
        });
      }
    } catch (error) {
      console.error('删除工具失败:', error);
      showMessage('error', '删除失败');
    }
  };

  // 显示操作结果消息
  const showMessage = (type, text) => {
    setSaveMessage({ visible: true, type, text });
    
    // 3秒后自动隐藏消息
    setTimeout(() => {
      setSaveMessage({ visible: false, type: '', text: '' });
    }, 3000);
  };

  return (
    <div className="tools-panel">
      <div className="panel-header">
        <h2>划线工具栏设置</h2>
      </div>
      
      <div className="tools-content">
        <div className="tools-description">
          <p>在此处添加自定义划线工具，这些工具将显示在网页中选中文本时的工具栏上。</p>
          <p>每个工具可以自动执行"引用 + 提示词 + 发送"的操作组合。</p>
        </div>
        
        <div className="tools-list">
          <h3>已添加的工具</h3>
          
          {tools.length === 0 ? (
            <div className="empty-tools-message">暂无自定义工具，请在下方添加</div>
          ) : (
            tools.map((tool) => (
              <div key={tool.id} className="tool-item">
                {editingTool && editingTool.id === tool.id ? (
                  // 编辑状态
                  <div className="tool-editing">
                    <div className="form-group">
                      <label>工具名称</label>
                      <input 
                        type="text" 
                        value={editingTool.tempName}
                        onChange={(e) => setEditingTool({
                          ...editingTool,
                          tempName: e.target.value
                        })}
                        placeholder="例如：翻译"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>提示词</label>
                      <textarea 
                        value={editingTool.tempPrompt}
                        onChange={(e) => setEditingTool({
                          ...editingTool,
                          tempPrompt: e.target.value
                        })}
                        placeholder="例如：将上述内容翻译成中文"
                      />
                    </div>
                    
                    <div className="tool-edit-actions">
                      <button 
                        className="cancel-edit-btn"
                        onClick={handleCancelEdit}
                      >
                        取消
                      </button>
                      <button 
                        className="save-edit-btn"
                        onClick={handleSaveEdit}
                      >
                        保存
                      </button>
                    </div>
                  </div>
                ) : (
                  // 查看状态
                  <div className="tool-details">
                    <div className="tool-header">
                      <div className="tool-name">{tool.name}</div>
                      <div className="tool-actions">
                        <button 
                          className="edit-tool-btn"
                          onClick={() => handleEdit(tool)}
                        >
                          编辑
                        </button>
                        <button 
                          className="delete-tool-btn"
                          onClick={() => handleDelete(tool.id)}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                    
                    <div className="tool-prompt">
                      <div className="tool-prompt-label">提示词：</div>
                      <div className="tool-prompt-text">{tool.prompt}</div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        
        <div className="add-tool-form">
          <h3>添加新工具</h3>
          
          <form onSubmit={handleAddTool}>
            <div className="form-group">
              <label htmlFor="toolName">工具名称</label>
              <input 
                type="text" 
                id="toolName"
                value={newToolName}
                onChange={(e) => setNewToolName(e.target.value)}
                placeholder="例如：翻译"
              />
              <span className="form-hint">将显示在划线工具栏按钮上的文本</span>
            </div>
            
            <div className="form-group">
              <label htmlFor="toolPrompt">提示词</label>
              <textarea 
                id="toolPrompt"
                value={newToolPrompt}
                onChange={(e) => setNewToolPrompt(e.target.value)}
                placeholder="例如：将上述内容翻译成中文"
              />
              <span className="form-hint">使用工具时，自动添加到引用内容后的提示文本</span>
            </div>
            
            <div className="form-actions">
              <button type="submit" className="add-tool-btn">
                添加工具
              </button>
            </div>
          </form>
        </div>
        
        {saveMessage.visible && (
          <div className={`save-message ${saveMessage.type}`}>
            {saveMessage.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default ToolsPanel; 