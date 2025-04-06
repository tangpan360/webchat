import React, { useState, useEffect, useRef } from 'react';
import { getStorage, saveChat } from '../utils/storage';
import { sendMessage } from '../api/chatApi';
import MessageList from './MessageList';
import ModelSelector from './ModelSelector';

const CURRENT_CHAT_KEY = 'webchat_current_chat_id';

const ChatPanel = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gpt-3.5-turbo');
  const [currentChatId, setCurrentChatId] = useState(null);
  const [streamingMessage, setStreamingMessage] = useState(null);
  const [editingMessageIndex, setEditingMessageIndex] = useState(null);
  const [editingMessageContent, setEditingMessageContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [quotes, setQuotes] = useState([]); // 存储引用内容
  const [currentChatTitle, setCurrentChatTitle] = useState('');
  const [apiError, setApiError] = useState('');
  const abortControllerRef = useRef(null);
  const lastChatIdRef = useRef(null); // 用于跟踪上一次的聊天ID

  // 自定义setCurrentChatId函数，在设置时同时保存到localStorage
  const setChatId = (chatId) => {
    if (chatId) {
      // 保存到localStorage以便在组件重新加载时恢复
      localStorage.setItem(CURRENT_CHAT_KEY, chatId);
      lastChatIdRef.current = chatId; // 更新引用值
    }
    setCurrentChatId(chatId);
  };

  // 尝试从localStorage恢复currentChatId
  useEffect(() => {
    const savedChatId = localStorage.getItem(CURRENT_CHAT_KEY);
    if (savedChatId) {
      console.log('从localStorage恢复对话ID:', savedChatId);
      setChatId(savedChatId);
      lastChatIdRef.current = savedChatId;
    }
  }, []);

  // 监听引用内容更新
  useEffect(() => {
    const handleQuotesUpdate = (event) => {
      if (event.type === 'updateQuotes') {
        setQuotes(event.quotes || []);
      }
    };

    // 监听工具执行操作
    const handleToolAction = (message) => {
      try {
        if (message.type === 'executeToolAction' && message.data) {
          // 如果当前已经在加载或者生成中，不处理新的工具操作
          if (isLoading || isGenerating) {
            console.log('正在处理其他请求，忽略当前工具操作');
            return;
          }
          
          // 确保有效的对话ID
          if (!currentChatId) {
            const savedChatId = localStorage.getItem(CURRENT_CHAT_KEY) || lastChatIdRef.current;
            if (savedChatId) {
              console.log('工具操作前恢复对话ID:', savedChatId);
              setChatId(savedChatId);
            } else {
              console.log('没有找到有效的对话ID，可能需要创建新对话');
              // 不立即创建，让handleSend函数处理
            }
          }
          
          const { text, prompt } = message.data;
          
          // 构建完整消息：引用内容 + 提示词
          let fullContent = `> ${text}\n\n${prompt}`;
          console.log('执行工具操作:', fullContent);
          
          // 重置任何可能的错误状态
          setStreamingMessage(null);
          
          // 延迟一点时间再执行，确保UI已经稳定
          setTimeout(() => {
            // 再次检查状态，防止在延迟期间状态已改变
            if (!isLoading && !isGenerating) {
              // 自动发送消息
              handleSend(fullContent);
            }
          }, 100);
        }
      } catch (error) {
        console.error('执行工具操作失败:', error);
      }
    };

    // 监听来自扩展后台的消息
    const messageListener = (message) => {
      if (message.type === 'updateQuotes') {
        setQuotes(message.quotes || []);
      } else if (message.type === 'executeToolAction') {
        handleToolAction(message);
      }
    };

    // 添加消息监听器
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener(messageListener);
      
      // 首次加载时主动获取已存在的引用内容
      chrome.runtime.sendMessage({
        type: 'getQuotes'
      });
    }

    // 添加窗口消息事件监听器（用于开发环境或直接通信）
    const windowMessageHandler = (event) => {
      const data = event.data;
      if (data && data.type === 'addQuote') {
        setQuotes(prev => [...prev, data.quote]);
      }
      if (data && data.type === 'updateQuotes') {
        setQuotes(data.quotes || []);
      }
      if (data && data.type === 'executeToolAction') {
        handleToolAction(data);
      }
    };
    
    window.addEventListener('message', windowMessageHandler);

    return () => {
      // 移除监听器
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onMessage.removeListener(messageListener);
      }
      window.removeEventListener('message', windowMessageHandler);
    };
  }, [isLoading, isGenerating, currentChatId]);

  // 删除单个引用
  const handleDeleteQuote = (quoteId) => {
    // 更新本地状态
    setQuotes(prev => prev.filter(quote => quote.id !== quoteId));
    
    // 向扩展后台发送删除请求
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'deleteQuote',
        quoteId
      });
    }
  };

  // 清空所有引用
  const handleClearAllQuotes = () => {
    // 更新本地状态
    setQuotes([]);
    
    // 向扩展后台发送清空请求
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'clearAllQuotes'
      });
    }
  };

  // 初始化对话或加载现有对话
  useEffect(() => {
    // 监听加载历史对话事件
    const handleLoadChat = async (event) => {
      const { chatId } = event.detail;
      console.log('ChatPanel接收到加载对话事件，chatId:', chatId);
      const chats = await getStorage('chats') || {};
      
      if (chats[chatId]) {
        console.log('找到对话数据，加载对话:', chats[chatId]);
        setChatId(chatId);
        setSelectedModel(chats[chatId].model || 'gpt-3.5-turbo');
        setMessages(chats[chatId].messages || []);
        setCurrentChatTitle(chats[chatId].title || '新对话');
        setStreamingMessage(null); // 确保清除任何流式消息
      } else {
        console.error('未找到对话数据:', chatId);
      }
    };
    
    // 创建新对话
    const createNewChat = async () => {
      // 检查是否有已保存的对话ID
      const savedChatId = localStorage.getItem(CURRENT_CHAT_KEY);
      if (savedChatId) {
        console.log('尝试从localStorage加载对话:', savedChatId);
        const chats = await getStorage('chats') || {};
        if (chats[savedChatId]) {
          setChatId(savedChatId);
          setSelectedModel(chats[savedChatId].model || 'gpt-3.5-turbo');
          setMessages(chats[savedChatId].messages || []);
          setCurrentChatTitle(chats[savedChatId].title || '新对话');
          return; // 已加载保存的对话，无需创建新对话
        }
      }
      
      // 创建新对话
      const newChatId = `chat_${Date.now()}`;
      setChatId(newChatId);
      
      // 初始化新对话
      const newChat = {
        id: newChatId,
        title: '新对话',
        model: selectedModel,
        createdAt: new Date().toISOString(),
        messages: []
      };
      
      // 保存新对话
      const chats = await getStorage('chats') || {};
      chats[newChatId] = newChat;
      await saveChat(chats);
    };
    
    // 注册事件监听器
    window.addEventListener('loadChat', handleLoadChat);
    
    // 监听来自历史面板的新建对话事件
    const handleNewChatEvent = () => {
      handleNewChat();
    };
    
    window.addEventListener('newChat', handleNewChatEvent);
    
    // 初始化对话
    createNewChat();
    
    return () => {
      window.removeEventListener('loadChat', handleLoadChat);
      window.removeEventListener('newChat', handleNewChatEvent);
    };
  }, []);

  // 自动生成对话标题
  const generateChatTitle = (content) => {
    // 简单方法：取用户输入的前15个字符作为标题
    if (!content || content.length === 0) return '新对话';
    
    // 去除空白字符
    const trimmedContent = content.replace(/\s+/g, ' ').trim();
    
    // 如果内容太短，直接返回
    if (trimmedContent.length <= 20) return trimmedContent;
    
    // 否则截取前20个字符，并添加省略号
    return trimmedContent.substring(0, 20) + '...';
  };

  // 处理发送消息逻辑
  const handleSend = async (overrideInput = null) => {
    try {
      // 检查API设置
      const settings = await getStorage('settings');
      const defaultApiUrl = 'https://api.openai.com/v1/chat/completions';
      const defaultApiKey = 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      
      // 检查API Key是否未设置或者是默认值
      if (!settings || !settings.apiKey || settings.apiKey === defaultApiKey || settings.apiKey.trim() === '') {
        setApiError('未设置API密钥，请在设置中配置API密钥');
        return;
      }
      
      // 检查API URL是否未设置或者为空
      if (!settings.apiUrl || settings.apiUrl.trim() === '') {
        setApiError('未设置API URL，请在设置中配置API URL');
        return;
      }
      
      // 清除之前的错误
      setApiError('');
      
      const messageContent = overrideInput !== null ? overrideInput : input;
      
      if ((!messageContent.trim() && quotes.length === 0) || isLoading || isGenerating) {
        console.log('发送条件不满足或当前正在处理其他请求');
        return;
      }
      
      // 组合引用内容和用户输入
      let fullContent = '';
      
      // 先添加引用内容
      if (quotes.length > 0) {
        quotes.forEach((quote) => {
          // 每段引用内容前只添加 > 符号
          fullContent += `> ${quote.text}\n\n`;
        });
        
        if (messageContent.trim()) {
          // 用户输入直接跟在引用内容后面，不需要添加标识
          fullContent += messageContent;
        }
      } else {
        fullContent = messageContent;
      }
      
      console.log('准备发送消息:', fullContent.substring(0, 50) + (fullContent.length > 50 ? '...' : ''));
      
      // 确保我们有一个有效的对话ID
      if (!currentChatId) {
        console.log('发送前恢复或创建新对话');
        const savedChatId = localStorage.getItem(CURRENT_CHAT_KEY);
        if (savedChatId) {
          console.log('从localStorage恢复对话ID:', savedChatId);
          setChatId(savedChatId);
          
          // 尝试加载对话历史
          const chats = await getStorage('chats') || {};
          if (chats[savedChatId]) {
            setMessages(chats[savedChatId].messages || []);
          }
        } else {
          // 创建新对话
          const newChatId = `chat_${Date.now()}`;
          setChatId(newChatId);
          
          // 初始化新对话
          const newChat = {
            id: newChatId,
            title: '新对话',
            model: selectedModel,
            createdAt: new Date().toISOString(),
            messages: []
          };
          
          // 保存新对话
          const chats = await getStorage('chats') || {};
          chats[newChatId] = newChat;
          await saveChat(chats);
        }
      }
      
      const userMessage = {
        role: 'user',
        content: fullContent
      };
      
      // 清空输入框和引用内容
      setInput('');
      setQuotes([]);
      
      // 如果使用的是Chrome扩展环境，通知后台清空引用内容
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: 'clearAllQuotes'
        });
      }
      
      // 更新消息列表
      const currentMessages = [...messages];
      setMessages([...currentMessages, userMessage]);
      
      setIsLoading(true);
      setIsGenerating(true);
      
      // 创建流式响应的初始消息
      setStreamingMessage({
        role: 'assistant',
        content: '',
        model: selectedModel  // 添加模型信息
      });
      
      try {
        // 创建AbortController用于中断请求
        abortControllerRef.current = new AbortController();
        
        // 使用回调函数实现流式输出
        const onChunkReceived = (chunk) => {
          setStreamingMessage(prev => {
            if (!prev) return {
              role: 'assistant',
              content: chunk,
              model: selectedModel
            };
            return {
              ...prev,
              content: prev.content + chunk
            };
          });
        };
        
        const assistantMessage = await sendMessage(
          fullContent, 
          selectedModel, 
          currentMessages, // 使用最新的消息历史
          onChunkReceived, 
          abortControllerRef.current.signal
        );
        
        // 为AI消息添加模型信息
        assistantMessage.model = selectedModel;
        
        // 完成后清除流式消息，并添加完整回复
        setStreamingMessage(null);
        
        const updatedMessages = [...currentMessages, userMessage, assistantMessage];
        setMessages(updatedMessages);
        
        // 更新存储
        if (currentChatId) {
          const chats = await getStorage('chats') || {};
          if (chats[currentChatId]) {
            // 如果是第一次发送消息，自动更新对话标题
            if (chats[currentChatId].messages.length === 0 && chats[currentChatId].title === '新对话') {
              const newTitle = generateChatTitle(messageContent);
              chats[currentChatId].title = newTitle;
              setCurrentChatTitle(newTitle);
            }
            
            chats[currentChatId].messages = updatedMessages;
            chats[currentChatId].model = selectedModel;
            await saveChat(chats);
          } else {
            // 处理对话不存在的情况
            chats[currentChatId] = {
              id: currentChatId,
              title: generateChatTitle(messageContent),
              model: selectedModel,
              createdAt: new Date().toISOString(),
              messages: updatedMessages
            };
            await saveChat(chats);
          }
        } else {
          console.error('发送消息完成但没有有效的对话ID');
        }
      } catch (error) {
        // 如果是主动中断请求，不显示错误消息
        if (error.name === 'AbortError') {
          console.log('请求被用户取消');
          
          // 如果有部分生成的内容，将其保存为完整回复
          if (streamingMessage && streamingMessage.content) {
            const assistantMessage = {
              role: 'assistant',
              content: streamingMessage.content
            };
            
            const updatedMessages = [...currentMessages, userMessage, assistantMessage];
            setMessages(updatedMessages);
            
            // 更新存储
            if (currentChatId) {
              const chats = await getStorage('chats') || {};
              if (chats[currentChatId]) {
                chats[currentChatId].messages = updatedMessages;
                await saveChat(chats);
              }
            }
          }
        } else {
          console.error('发送消息失败:', error);
          // 显示错误消息
          setStreamingMessage(null);
          setMessages(prev => [
            ...prev, 
            { role: 'assistant', content: `发送消息失败: ${error.message}` }
          ]);
        }
      } finally {
        setIsLoading(false);
        setIsGenerating(false);
        setStreamingMessage(null);
        abortControllerRef.current = null;
        console.log('消息处理完成，状态已重置');
      }
    } catch (outerError) {
      console.error('handleSend外层错误:', outerError);
      setIsLoading(false);
      setIsGenerating(false);
      setStreamingMessage(null);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    }
  };

  // 停止生成回复
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleNewChat = async () => {
    setMessages([]);
    setStreamingMessage(null);
    setApiError('');
    const chatId = `chat_${Date.now()}`;
    const newChat = {
      id: chatId,
      title: '新对话',
      model: selectedModel,
      createdAt: new Date().toISOString(),
      messages: []
    };
    
    // 保存到存储
    const chats = await getStorage('chats') || {};
    chats[chatId] = newChat;
    await saveChat(chats);
    
    setChatId(chatId);
    setCurrentChatTitle('新对话');
  };

  // 消息操作处理函数
  const handleCopyMessage = (content) => {
    navigator.clipboard.writeText(content)
      .then(() => alert('消息内容已复制到剪贴板'))
      .catch(err => console.error('复制失败:', err));
  };

  const handleEditMessage = (index, message) => {
    setEditingMessageIndex(index);
    setEditingMessageContent(message.content);
  };

  const handleSaveEdit = async () => {
    if (editingMessageIndex === null || !editingMessageContent.trim()) return;
    
    // 更新消息
    const updatedMessages = [...messages];
    updatedMessages[editingMessageIndex] = {
      ...updatedMessages[editingMessageIndex],
      content: editingMessageContent
    };
    
    // 直接更新消息，不调用大模型回复
    setMessages(updatedMessages);
    setEditingMessageIndex(null);
    setEditingMessageContent('');
    
    // 更新存储
    if (currentChatId) {
      const chats = await getStorage('chats') || {};
      if (chats[currentChatId]) {
        chats[currentChatId].messages = updatedMessages;
        await saveChat(chats);
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageIndex(null);
    setEditingMessageContent('');
  };

  const handleDeleteMessage = async (index) => {
    // 删除消息
    let updatedMessages = [...messages];
    
    // 如果删除的是用户消息，则同时删除其后的AI回复
    if (
      updatedMessages[index].role === 'user' && 
      index + 1 < updatedMessages.length &&
      updatedMessages[index + 1].role === 'assistant'
    ) {
      updatedMessages.splice(index, 2);
    } else {
      updatedMessages.splice(index, 1);
    }
    
    setMessages(updatedMessages);
    
    // 更新存储
    if (currentChatId) {
      const chats = await getStorage('chats') || {};
      if (chats[currentChatId]) {
        chats[currentChatId].messages = updatedMessages;
        await saveChat(chats);
      }
    }
  };

  const handleRegenerateMessage = async (index) => {
    let messageToRegenerate;
    
    if (messages[index].role === 'assistant') {
      // 找到这条AI消息之前的用户消息
      let userMessageIndex = index - 1;
      while (userMessageIndex >= 0 && messages[userMessageIndex].role !== 'user') {
        userMessageIndex--;
      }
      
      if (userMessageIndex < 0) return;
      
      // 重置内容：保留到用户消息，删除当前AI回复
      const updatedMessages = messages.slice(0, index);
      setMessages(updatedMessages);
      
      // 使用用户消息内容重新生成
      messageToRegenerate = messages[userMessageIndex].content;
      
      // 直接发送消息内容，不通过handleSend添加用户消息
      const onChunkReceived = (chunk) => {
        setStreamingMessage(prev => ({
          ...prev,
          content: prev.content + chunk
        }));
      };
      
      try {
        setIsLoading(true);
        setIsGenerating(true);
        setStreamingMessage({
          role: 'assistant',
          content: ''
        });
        
        // 创建AbortController用于中断请求
        abortControllerRef.current = new AbortController();
        
        const assistantMessage = await sendMessage(
          messageToRegenerate, 
          selectedModel, 
          updatedMessages, 
          onChunkReceived, 
          abortControllerRef.current.signal
        );
        
        // 完成后清除流式消息，并添加完整回复
        setStreamingMessage(null);
        
        // 直接添加AI回复，不添加用户消息
        setMessages([...updatedMessages, assistantMessage]);
        
        // 更新存储
        if (currentChatId) {
          const chats = await getStorage('chats') || {};
          if (chats[currentChatId]) {
            chats[currentChatId].messages = [...updatedMessages, assistantMessage];
            await saveChat(chats);
          }
        }
      } catch (error) {
        // 错误处理
        if (error.name === 'AbortError') {
          console.log('请求被用户取消');
          if (streamingMessage && streamingMessage.content) {
            const partialMessage = {
              role: 'assistant',
              content: streamingMessage.content
            };
            setMessages([...updatedMessages, partialMessage]);
            
            // 更新存储
            if (currentChatId) {
              const chats = await getStorage('chats') || {};
              if (chats[currentChatId]) {
                chats[currentChatId].messages = [...updatedMessages, partialMessage];
                await saveChat(chats);
              }
            }
          }
        } else {
          console.error('重新生成失败:', error);
          setMessages([...updatedMessages, { 
            role: 'assistant', 
            content: `重新生成失败: ${error.message}` 
          }]);
        }
      } finally {
        setIsLoading(false);
        setIsGenerating(false);
        setStreamingMessage(null);
        abortControllerRef.current = null;
      }
    } else if (messages[index].role === 'user') {
      // 如果是用户消息，查找之后的AI回复
      const hasNextAI = index + 1 < messages.length && messages[index + 1].role === 'assistant';
      
      // 创建一个新的消息数组，保留当前用户消息但删除后面的AI回复
      const updatedMessages = hasNextAI ? 
        messages.slice(0, index + 1) : 
        [...messages.slice(0, index), messages[index]];
      
      setMessages(updatedMessages);
      
      // 使用用户消息内容重新生成
      messageToRegenerate = messages[index].content;
      
      // 直接发送消息内容，不通过handleSend添加用户消息
      const onChunkReceived = (chunk) => {
        setStreamingMessage(prev => ({
          ...prev,
          content: prev.content + chunk
        }));
      };
      
      try {
        setIsLoading(true);
        setIsGenerating(true);
        setStreamingMessage({
          role: 'assistant',
          content: ''
        });
        
        // 创建AbortController用于中断请求
        abortControllerRef.current = new AbortController();
        
        const assistantMessage = await sendMessage(
          messageToRegenerate, 
          selectedModel, 
          updatedMessages, 
          onChunkReceived, 
          abortControllerRef.current.signal
        );
        
        // 完成后清除流式消息，并添加完整回复
        setStreamingMessage(null);
        
        // 直接添加AI回复，不添加用户消息
        setMessages([...updatedMessages, assistantMessage]);
        
        // 更新存储
        if (currentChatId) {
          const chats = await getStorage('chats') || {};
          if (chats[currentChatId]) {
            chats[currentChatId].messages = [...updatedMessages, assistantMessage];
            await saveChat(chats);
          }
        }
      } catch (error) {
        // 错误处理
        if (error.name === 'AbortError') {
          console.log('请求被用户取消');
          if (streamingMessage && streamingMessage.content) {
            const partialMessage = {
              role: 'assistant',
              content: streamingMessage.content
            };
            setMessages([...updatedMessages, partialMessage]);
            
            // 更新存储
            if (currentChatId) {
              const chats = await getStorage('chats') || {};
              if (chats[currentChatId]) {
                chats[currentChatId].messages = [...updatedMessages, partialMessage];
                await saveChat(chats);
              }
            }
          }
        } else {
          console.error('重新生成失败:', error);
          setMessages([...updatedMessages, { 
            role: 'assistant', 
            content: `重新生成失败: ${error.message}` 
          }]);
        }
      } finally {
        setIsLoading(false);
        setIsGenerating(false);
        setStreamingMessage(null);
        abortControllerRef.current = null;
      }
    } else {
      return; // 不支持的消息类型
    }
  };

  // 组合消息列表（包括流式响应）
  const allMessages = streamingMessage 
    ? [...messages, streamingMessage]
    : messages;

  // 在组件中添加以下函数，用于自动调整textarea的高度
  const handleTextareaInput = (e) => {
    const textarea = e.target;
    // 重置高度以便正确计算新高度
    textarea.style.height = 'auto';
    // 设置新高度，但不超过CSS中设置的max-height
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <button className="new-chat-btn" onClick={handleNewChat}>
          新建对话
        </button>
        {currentChatTitle && (
          <div className="current-chat-title">{currentChatTitle}</div>
        )}
        <ModelSelector 
          selectedModel={selectedModel} 
          setSelectedModel={setSelectedModel} 
        />
      </div>
      
      {editingMessageIndex !== null ? (
        <div className="message-edit-container">
          <textarea
            className="message-edit-textarea"
            value={editingMessageContent}
            onChange={(e) => setEditingMessageContent(e.target.value)}
            autoFocus
          />
          <div className="message-edit-actions">
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
        <MessageList 
          messages={allMessages} 
          onCopyMessage={handleCopyMessage}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onRegenerateMessage={handleRegenerateMessage}
          isGenerating={isGenerating}
        />
      )}
      
      <div className="chat-input-container">
        {/* API错误提示 */}
        {apiError && (
          <div className="api-error-message">
            {apiError} <a href="#" onClick={() => window.dispatchEvent(new CustomEvent('switchTab', { detail: { tab: 'settings' } }))}>前往设置</a>
          </div>
        )}
        
        {/* 引用内容区域 */}
        {quotes.length > 0 && (
          <div className="quoted-content-container">
            <div className="quoted-content-header">
              <span>引用内容 ({quotes.length})</span>
              <button 
                className="clear-all-quotes-btn" 
                onClick={handleClearAllQuotes}
              >
                清空
              </button>
            </div>
            <div className="quoted-content-list">
              {quotes.map((quote, index) => (
                <div className="quoted-item" key={quote.id}>
                  <div className="quoted-text">{quote.text}</div>
                  <button 
                    className="delete-quote-btn"
                    onClick={() => handleDeleteQuote(quote.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="input-row">
          <textarea
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onInput={handleTextareaInput}
            placeholder={quotes.length > 0 ? "添加问题或直接发送引用内容..." : "输入消息..."}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!isGenerating) {
                  handleSend();
                }
              }
            }}
          />
          <button 
            className={`${isGenerating ? 'stop-btn' : 'send-btn'}`}
            onClick={isGenerating ? handleStopGeneration : () => handleSend()}
            disabled={isLoading && !isGenerating}
          >
            {isGenerating ? '停止' : (isLoading ? '发送中...' : '发送')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel; 