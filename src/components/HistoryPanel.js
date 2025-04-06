import React, { useState, useEffect } from 'react';
import { getStorage, saveChat } from '../utils/storage';

const HistoryPanel = () => {
  const [chats, setChats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadChats = async () => {
      try {
        const savedChats = await getStorage('chats') || {};
        console.log('加载的历史对话:', savedChats);
        setChats(savedChats);
      } catch (error) {
        console.error('加载历史对话失败:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadChats();
    
    // 添加存储变化监听器
    const handleStorageChange = () => {
      loadChats();
    };
    
    // 每5秒刷新一次历史记录
    const intervalId = setInterval(loadChats, 5000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const handleDelete = async (chatId) => {
    if (window.confirm('确定要删除这个对话吗？')) {
      const updatedChats = { ...chats };
      delete updatedChats[chatId];
      
      await saveChat(updatedChats);
      setChats(updatedChats);
    }
  };

  const handleRename = async (chatId) => {
    const newTitle = prompt('请输入新的对话名称:', chats[chatId]?.title);
    
    if (newTitle && newTitle.trim()) {
      const updatedChats = { ...chats };
      updatedChats[chatId] = {
        ...updatedChats[chatId],
        title: newTitle.trim()
      };
      
      await saveChat(updatedChats);
      setChats(updatedChats);
    }
  };
  
  const handleLoadChat = (chatId) => {
    console.log('加载对话:', chatId);
    // 发送消息到Chat面板，告诉它加载特定对话
    const event = new CustomEvent('loadChat', { detail: { chatId } });
    window.dispatchEvent(event);
    
    // 在控制台输出事件已触发的信息
    console.log('loadChat事件已触发，chatId:', chatId);
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  // 处理新建对话
  const handleNewChat = () => {
    // 触发新建对话事件，在ChatPanel中会处理
    const event = new CustomEvent('newChat');
    window.dispatchEvent(event);
    
    // 切换到聊天面板
    window.dispatchEvent(new CustomEvent('switchTab', { detail: { tab: 'chat' } }));
  };

  if (loading) {
    return <div className="history-panel">加载中...</div>;
  }

  const chatIds = Object.keys(chats).sort((a, b) => {
    return new Date(chats[b].createdAt) - new Date(chats[a].createdAt);
  });

  if (chatIds.length === 0) {
    return (
      <div className="history-panel empty">
        <p>没有历史对话记录</p>
        <button className="new-chat-btn" onClick={handleNewChat}>新建对话</button>
      </div>
    );
  }

  return (
    <div className="history-panel">
      <div className="panel-header">
        <h2>历史对话</h2>
        <button className="new-chat-btn" onClick={handleNewChat}>
          新建对话
        </button>
      </div>
      <div className="panel-content">
        <div className="history-list">
          {chatIds.map(chatId => (
            <div 
              key={chatId} 
              className="history-item"
              onClick={() => handleLoadChat(chatId)}
            >
              <div className="history-item-info">
                <div className="history-item-title">{chats[chatId].title}</div>
                <div className="history-item-meta">
                  <span>{chats[chatId].model}</span>
                  <span>{formatDate(chats[chatId].createdAt)}</span>
                  <span>{chats[chatId].messages?.length || 0} 条消息</span>
                </div>
              </div>
              <div className="history-item-actions" onClick={(e) => e.stopPropagation()}>
                <button 
                  className="rename-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRename(chatId);
                  }}
                >
                  重命名
                </button>
                <button 
                  className="delete-btn" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(chatId);
                  }}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HistoryPanel; 