import React from 'react';

const Tabs = ({ activeTab, setActiveTab }) => {
  return (
    <div className="tabs">
      <div 
        className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
        onClick={() => setActiveTab('chat')}
      >
        对话
      </div>
      <div 
        className={`tab ${activeTab === 'history' ? 'active' : ''}`}
        onClick={() => setActiveTab('history')}
      >
        历史
      </div>
      <div 
        className={`tab ${activeTab === 'tools' ? 'active' : ''}`}
        onClick={() => setActiveTab('tools')}
      >
        划线工具栏
      </div>
      <div 
        className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
        onClick={() => setActiveTab('settings')}
      >
        设置
      </div>
    </div>
  );
};

export default Tabs; 