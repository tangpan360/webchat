import React, { useState, useEffect } from 'react';
import Tabs from './Tabs';
import ChatPanel from './ChatPanel';
import HistoryPanel from './HistoryPanel';
import SettingsPanel from './SettingsPanel';
import ToolsPanel from './ToolsPanel';

const App = () => {
  const [activeTab, setActiveTab] = useState('chat');

  // 监听历史对话加载事件，自动切换到"对话"标签
  useEffect(() => {
    const handleLoadChat = () => {
      setActiveTab('chat');
    };
    
    // 监听标签切换事件
    const handleSwitchTab = (event) => {
      if (event.detail && event.detail.tab) {
        setActiveTab(event.detail.tab);
      }
    };
    
    window.addEventListener('loadChat', handleLoadChat);
    window.addEventListener('switchTab', handleSwitchTab);
    
    return () => {
      window.removeEventListener('loadChat', handleLoadChat);
      window.removeEventListener('switchTab', handleSwitchTab);
    };
  }, []);

  return (
    <div className="app-container">
      <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <div className="panel-container">
        <div className={activeTab === 'chat' ? 'panel active' : 'panel'}>
          <ChatPanel />
        </div>
        
        <div className={activeTab === 'history' ? 'panel active' : 'panel'}>
          <HistoryPanel />
        </div>
        
        <div className={activeTab === 'tools' ? 'panel active' : 'panel'}>
          <ToolsPanel />
        </div>
        
        <div className={activeTab === 'settings' ? 'panel active' : 'panel'}>
          <SettingsPanel />
        </div>
      </div>
    </div>
  );
};

export default App; 