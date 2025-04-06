import React, { useState, useEffect } from 'react';
import { getStorage, setStorage } from '../utils/storage';

const SettingsPanel = () => {
  const [settings, setSettings] = useState({
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    models: [
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
      { id: 'gpt-4', name: 'GPT-4' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' }
    ],
    maxHistoryMessages: 10,
    compressionThreshold: 1000
  });
  
  // 保存默认设置的引用，用于占位符显示
  const defaultSettings = {
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  };
  
  const [newModel, setNewModel] = useState({ id: '', name: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ text: '', type: '' });
  const [showApiKey, setShowApiKey] = useState(false);
  const [isApiUrlFocused, setIsApiUrlFocused] = useState(false);
  const [isApiKeyFocused, setIsApiKeyFocused] = useState(false);
  const [apiUrlValue, setApiUrlValue] = useState('');
  const [apiKeyValue, setApiKeyValue] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      const savedSettings = await getStorage('settings');
      if (savedSettings) {
        // 确保新增的字段存在
        const updatedSettings = {
          ...settings,
          ...savedSettings,
          maxHistoryMessages: savedSettings.maxHistoryMessages || settings.maxHistoryMessages,
          compressionThreshold: savedSettings.compressionThreshold || settings.compressionThreshold
        };
        setSettings(updatedSettings);
        // 如果已经有保存的值，则使用保存的值
        if (savedSettings.apiUrl && savedSettings.apiUrl !== settings.apiUrl) {
          setApiUrlValue(savedSettings.apiUrl);
        }
        if (savedSettings.apiKey && savedSettings.apiKey !== settings.apiKey) {
          setApiKeyValue(savedSettings.apiKey);
        }
      } else {
        // 如果没有保存的设置，保存默认设置
        await setStorage('settings', settings);
      }
    };
    
    loadSettings();
  }, []);

  // 处理 API URL 输入变更
  const handleApiUrlChange = (e) => {
    setApiUrlValue(e.target.value);
  };

  // 处理 API Key 输入变更
  const handleApiKeyChange = (e) => {
    setApiKeyValue(e.target.value);
  };

  // 处理 API URL 聚焦事件
  const handleApiUrlFocus = () => {
    setIsApiUrlFocused(true);
  };

  // 处理 API Key 聚焦事件
  const handleApiKeyFocus = () => {
    setIsApiKeyFocused(true);
  };

  // 处理 API URL 失焦事件
  const handleApiUrlBlur = () => {
    setIsApiUrlFocused(false);
  };

  // 处理 API Key 失焦事件
  const handleApiKeyBlur = () => {
    setIsApiKeyFocused(false);
  };

  const handleSave = async () => {
    // 保存前更新设置中的 URL 和 Key 值
    const updatedSettings = {
      ...settings,
      apiUrl: apiUrlValue,  // 直接使用当前输入值，即使为空
      apiKey: apiKeyValue   // 直接使用当前输入值，即使为空
    };
    
    setSettings(updatedSettings);
    setIsSaving(true);
    setSaveMessage({ text: '', type: '' });
    
    try {
      await setStorage('settings', updatedSettings);
      setSaveMessage({ text: '设置保存成功！', type: 'success' });
    } catch (error) {
      console.error('保存设置失败:', error);
      setSaveMessage({ text: '保存设置失败: ' + error.message, type: 'error' });
    } finally {
      setIsSaving(false);
      
      // 清除消息
      setTimeout(() => {
        setSaveMessage({ text: '', type: '' });
      }, 3000);
    }
  };

  const handleAddModel = () => {
    if (!newModel.id.trim() || !newModel.name.trim()) {
      setSaveMessage({ text: '模型ID和名称不能为空', type: 'error' });
      return;
    }
    
    // 检查是否已存在
    if (settings.models.some(model => model.id === newModel.id)) {
      setSaveMessage({ text: '模型ID已存在', type: 'error' });
      return;
    }
    
    setSettings({
      ...settings,
      models: [...settings.models, { ...newModel }]
    });
    
    setNewModel({ id: '', name: '' });
    setSaveMessage({ text: '模型添加成功', type: 'success' });
    
    // 清除消息
    setTimeout(() => {
      setSaveMessage({ text: '', type: '' });
    }, 3000);
  };

  const handleRemoveModel = (modelId) => {
    setSettings({
      ...settings,
      models: settings.models.filter(model => model.id !== modelId)
    });
  };

  const toggleApiKeyVisibility = () => {
    setShowApiKey(!showApiKey);
  };

  return (
    <div className="settings-panel">
      <div className="panel-header">
        <h2>设置</h2>
        <div className="panel-header-actions">
          {saveMessage.text && (
            <div className={`save-message-header ${saveMessage.type}`}>
              {saveMessage.text}
            </div>
          )}
          <button 
            className="save-settings-btn"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </div>
      
      <div className="settings-content">
        <div className="settings-section">
          <h3>API 设置</h3>
          <div className="form-group">
            <label htmlFor="apiUrl">API URL</label>
            <input
              id="apiUrl"
              type="text"
              className={`placeholder-input ${!isApiUrlFocused && !apiUrlValue ? 'showing-placeholder' : ''}`}
              value={apiUrlValue}
              onChange={handleApiUrlChange}
              onFocus={handleApiUrlFocus}
              onBlur={handleApiUrlBlur}
              placeholder={defaultSettings.apiUrl}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="apiKey">API Key</label>
            <div className="api-key-container">
              <input
                id="apiKey"
                type={showApiKey ? "text" : "password"}
                className={`placeholder-input ${!isApiKeyFocused && !apiKeyValue ? 'showing-placeholder' : ''}`}
                value={apiKeyValue}
                onChange={handleApiKeyChange}
                onFocus={handleApiKeyFocus}
                onBlur={handleApiKeyBlur}
                placeholder={defaultSettings.apiKey}
              />
              <button 
                type="button" 
                className="toggle-password-btn"
                onClick={toggleApiKeyVisibility}
                title={showApiKey ? "隐藏密钥" : "显示密钥"}
              >
                {showApiKey ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
        
        <div className="settings-section">
          <h3>模型设置</h3>
          <div className="models-list">
            {settings.models.map(model => (
              <div key={model.id} className="model-item">
                <div className="model-info">
                  <div className="model-name">{model.name}</div>
                  <div className="model-id">{model.id}</div>
                </div>
                <button 
                  className="remove-model-btn"
                  onClick={() => handleRemoveModel(model.id)}
                >
                  删除
                </button>
              </div>
            ))}
          </div>
          
          <div className="add-model-section">
            <h4>添加新模型</h4>
            <div className="form-group">
              <label htmlFor="modelId">模型ID</label>
              <input
                id="modelId"
                type="text"
                value={newModel.id}
                onChange={(e) => setNewModel({ ...newModel, id: e.target.value })}
                placeholder="例如: gpt-4-turbo"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="modelName">模型名称</label>
              <input
                id="modelName"
                type="text"
                value={newModel.name}
                onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
                placeholder="例如: GPT-4 Turbo"
              />
            </div>
            
            <button 
              className="add-model-btn"
              onClick={handleAddModel}
            >
              添加模型
            </button>
          </div>
        </div>
        
        <div className="settings-section">
          <h3>上下文控制</h3>
          <div className="form-group">
            <label htmlFor="maxHistoryMessages">附带历史消息数（0表示不限制）</label>
            <input
              id="maxHistoryMessages"
              type="number"
              min="0"
              max="100"
              value={settings.maxHistoryMessages}
              onChange={(e) => setSettings({ 
                ...settings, 
                maxHistoryMessages: parseInt(e.target.value) || 0 
              })}
            />
            <small className="form-hint">每次请求携带的最大历史消息数量，推荐值: 10-20</small>
          </div>
          
          <div className="form-group">
            <label htmlFor="compressionThreshold">历史消息长度压缩阈值（0表示不压缩）</label>
            <input
              id="compressionThreshold"
              type="number"
              min="0"
              max="10000"
              value={settings.compressionThreshold}
              onChange={(e) => setSettings({ 
                ...settings, 
                compressionThreshold: parseInt(e.target.value) || 0 
              })}
            />
            <small className="form-hint">超过此字符数的消息将被压缩，推荐值: 800-1500</small>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel; 