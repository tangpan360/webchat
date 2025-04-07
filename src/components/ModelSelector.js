import React, { useState, useEffect } from 'react';
import { getStorage } from '../utils/storage';

const ModelSelector = ({ selectedModel, setSelectedModel }) => {
  const [models, setModels] = useState([
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    { id: 'gpt-4', name: 'GPT-4' },
    { id: 'deepseek-v3', name: 'DeepSeek-v3' }
  ]);
  
  const [isOpen, setIsOpen] = useState(false);

  // 初始加载模型列表
  useEffect(() => {
    loadModels();
  }, []);

  // 每次打开下拉菜单时重新加载模型列表
  useEffect(() => {
    if (isOpen) {
      loadModels();
    }
  }, [isOpen]);

  // 加载模型列表的函数
  const loadModels = async () => {
    const settings = await getStorage('settings');
    if (settings && settings.models) {
      setModels(settings.models);
      
      // 如果当前选中的模型不在列表中，则选择第一个模型
      if (settings.models.length > 0 && !settings.models.some(model => model.id === selectedModel)) {
        setSelectedModel(settings.models[0].id);
      }
    }
  };

  return (
    <div className="model-selector">
      <div 
        className="selected-model"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>
          {models.find(model => model.id === selectedModel)?.name || selectedModel}
        </span>
        <span className="dropdown-arrow">▼</span>
      </div>
      
      {isOpen && (
        <div className="model-dropdown">
          {models.map(model => (
            <div
              key={model.id}
              className={`model-option ${selectedModel === model.id ? 'selected' : ''}`}
              onClick={() => {
                setSelectedModel(model.id);
                setIsOpen(false);
              }}
            >
              {model.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModelSelector; 