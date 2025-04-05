import React, { useState, useEffect } from 'react';
import { getStorage } from '../utils/storage';

const ModelSelector = ({ selectedModel, setSelectedModel }) => {
  const [models, setModels] = useState([
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    { id: 'gpt-4', name: 'GPT-4' },
    { id: 'deepseek-v3', name: 'DeepSeek-v3' }
  ]);
  
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const loadModels = async () => {
      const settings = await getStorage('settings');
      if (settings && settings.models) {
        setModels(settings.models);
      }
    };
    
    loadModels();
  }, []);

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