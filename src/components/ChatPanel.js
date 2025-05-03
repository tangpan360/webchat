import React, { useState, useEffect, useRef } from 'react';
import { getStorage, saveChat } from '../utils/storage';
import { sendMessage, fileToBase64 } from '../api/chatApi';
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
  const [uploadedImages, setUploadedImages] = useState([]);  // 存储上传的图片
  const fileInputRef = useRef(null);  // 文件输入引用
  const dropAreaRef = useRef(null);  // 拖放区域引用
  
  const abortControllerRef = useRef(null);
  const lastChatIdRef = useRef(null); // 用于跟踪上一次的聊天ID
  const messageListRef = useRef(null); // 添加对MessageList组件的引用
  const lastEditedIndexRef = useRef(null); // 存储最后编辑的消息索引
  // 添加新的引用，用于实时获取当前选中的模型
  const currentModelRef = useRef(selectedModel);
  const restoreScrollPositionRef = useRef(null); // 添加新的引用，用于记录滚动位置

  // 跟踪selectedModel的变化，更新引用值
  useEffect(() => {
    currentModelRef.current = selectedModel;
  }, [selectedModel]);

  // 自定义setCurrentChatId函数，在设置时同时保存到localStorage
  const setChatId = (chatId) => {
    if (chatId) {
      // 保存到localStorage以便在组件重新加载时恢复
      localStorage.setItem(CURRENT_CHAT_KEY, chatId);
      lastChatIdRef.current = chatId; // 更新引用值
    }
    setCurrentChatId(chatId);
  };

  // 处理图片上传
  const handleImageUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    // 处理每个选中的文件
    await Promise.all(
      Array.from(files).map(async (file) => {
        // 验证文件类型
        if (!file.type.startsWith('image/')) {
          console.error('不支持的文件类型:', file.type);
          return;
        }
        
        try {
          // 将图片转换为Base64字符串
          const base64String = await fileToBase64(file);
          
          // 添加到上传图片列表
          setUploadedImages(prev => [...prev, { 
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            base64: base64String,
            name: file.name
          }]);
        } catch (error) {
          console.error('处理图片失败:', error);
        }
      })
    );
    
    // 清空文件输入，允许重复选择相同文件
    event.target.value = '';
  };
  
  // 处理图片删除
  const handleImageDelete = (imageId) => {
    setUploadedImages(prev => prev.filter(img => img.id !== imageId));
  };
  
  // 处理拖拽事件
  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  };
  
  // 处理拖放事件
  const handleDrop = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    
    const items = event.dataTransfer.items;
    const files = event.dataTransfer.files;
    
    // 处理文件拖放
    if (files && files.length > 0) {
      // 将FileList转换为数组并过滤出图片文件
      const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
      
      if (imageFiles.length === 0) return;
      
      // 处理每个图片文件
      await Promise.all(
        imageFiles.map(async (file) => {
          try {
            // 将图片转换为Base64字符串
            const base64String = await fileToBase64(file);
            
            // 添加到上传图片列表
            setUploadedImages(prev => [...prev, { 
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              base64: base64String,
              name: file.name
            }]);
          } catch (error) {
            console.error('处理拖放图片失败:', error);
          }
        })
      );
    } 
    // 处理从网页拖放的图片
    else if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // 处理拖拽的图片URL
        if (item.kind === 'string' && item.type.match('^text/uri-list')) {
          item.getAsString(async (url) => {
            try {
              // 验证URL是否为图片
              const response = await fetch(url);
              const contentType = response.headers.get('content-type');
              
              if (contentType && contentType.startsWith('image/')) {
                const blob = await response.blob();
                const base64String = await fileToBase64(blob);
                
                // 从URL中提取文件名
                const urlParts = url.split('/');
                const fileName = urlParts[urlParts.length - 1].split('?')[0] || 'image.jpg';
                
                // 添加到上传图片列表
                setUploadedImages(prev => [...prev, { 
                  id: Date.now() + Math.random().toString(36).substr(2, 9),
                  base64: base64String,
                  name: fileName
                }]);
              }
            } catch (error) {
              console.error('处理网页拖放图片失败:', error);
            }
          });
        }
        // 处理拖拽的图片文件
        else if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          
          try {
            // 将图片转换为Base64字符串
            const base64String = await fileToBase64(file);
            
            // 添加到上传图片列表
            setUploadedImages(prev => [...prev, { 
              id: Date.now() + Math.random().toString(36).substr(2, 9),
              base64: base64String,
              name: file.name
            }]);
          } catch (error) {
            console.error('处理拖放图片文件失败:', error);
          }
        }
      }
    }
  };
  
  // 添加拖放事件监听器
  useEffect(() => {
    const handleDocumentDrop = (event) => {
      // 如果不是拖放到指定区域，阻止默认行为
      if (!event.target.closest('.chat-panel') && !event.target.closest('.chat-input-container')) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      
      // 如果在我们的区域内，让主拖放处理函数处理
      handleDrop(event);
    };
    
    const handleDocumentDragOver = (event) => {
      event.preventDefault();
      event.stopPropagation();
      
      // 设置拖放效果为复制
      event.dataTransfer.dropEffect = 'copy';
      
      // 添加拖放区高亮效果
      if (dropAreaRef.current) {
        dropAreaRef.current.classList.add('drag-over');
      }
    };
    
    const handleDocumentDragLeave = (event) => {
      // 仅当拖拽离开整个文档区域时移除高亮
      const rect = document.body.getBoundingClientRect();
      const isLeavingDocument = 
        event.clientX <= rect.left ||
        event.clientX >= rect.right ||
        event.clientY <= rect.top ||
        event.clientY >= rect.bottom;
      
      if (isLeavingDocument && dropAreaRef.current) {
        dropAreaRef.current.classList.remove('drag-over');
      }
    };
    
    const handleDocumentDragEnd = () => {
      // 拖拽结束时移除高亮
      if (dropAreaRef.current) {
        dropAreaRef.current.classList.remove('drag-over');
      }
    };
    
    // 添加全局拖放事件监听器
    document.addEventListener('dragover', handleDocumentDragOver);
    document.addEventListener('drop', handleDocumentDrop);
    document.addEventListener('dragleave', handleDocumentDragLeave);
    document.addEventListener('dragend', handleDocumentDragEnd);
    
    return () => {
      // 移除全局拖放事件监听器
      document.removeEventListener('dragover', handleDocumentDragOver);
      document.removeEventListener('drop', handleDocumentDrop);
      document.removeEventListener('dragleave', handleDocumentDragLeave);
      document.removeEventListener('dragend', handleDocumentDragEnd);
    };
  }, []);

  // 尝试从localStorage恢复currentChatId
  useEffect(() => {
    const loadCurrentChat = async () => {
      const savedChatId = localStorage.getItem(CURRENT_CHAT_KEY);
      if (savedChatId) {
        console.log('从localStorage恢复对话ID:', savedChatId);
        setChatId(savedChatId);
        lastChatIdRef.current = savedChatId;
        
        // 立即加载对话内容，防止历史丢失
        try {
          const chats = await getStorage('chats') || {};
          if (chats[savedChatId]) {
            console.log('立即加载找到的对话:', chats[savedChatId].title);
            setMessages(chats[savedChatId].messages || []);
            setCurrentChatTitle(chats[savedChatId].title || '新对话');
            setSelectedModel(chats[savedChatId].model || 'gpt-3.5-turbo');
            
            // 确保所有状态被重置 - 特别是在侧边栏重新打开的情况下
            setIsLoading(false);
            setIsGenerating(false);
            setStreamingMessage(null);
            if (abortControllerRef.current) {
              abortControllerRef.current = null;
            }
          } else {
            console.log('存储中未找到对话:', savedChatId);
          }
        } catch (error) {
          console.error('加载对话数据失败:', error);
        }
      }
      
      // 通知background.js侧边栏已准备好
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: 'sidePanelReady'
        });
        console.log('已通知背景脚本侧边栏已准备好接收消息');
      }
    };
    
    loadCurrentChat();
    
    // 侧边栏关闭时通知
    return () => {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: 'sidePanelClosed'
        });
        console.log('已通知背景脚本侧边栏已关闭');
      }
    };
  }, []);

  // 监听引用内容更新
  useEffect(() => {
    const handleQuotesUpdate = (event) => {
      if (event.type === 'updateQuotes') {
        setQuotes(event.quotes || []);
      }
    };

    // 监听工具执行操作
    const handleToolAction = async (message) => {
      try {
        if (message.type === 'executeToolAction' && message.data) {
          // 获取操作ID
          const operationId = message.data.actionId || 'unknown';
          console.log('ChatPanel收到工具操作请求', operationId);
          
          // 如果当前已经在加载或者生成中，不处理新的工具操作
          if (isLoading || isGenerating) {
            console.log('正在处理其他请求，忽略当前工具操作');
            return;
          }
          
          // 使用操作ID进行去重
          const processedActions = JSON.parse(sessionStorage.getItem('processedActions') || '[]');
          if (operationId !== 'unknown' && processedActions.includes(operationId)) {
            console.log('该操作ID已处理过，跳过:', operationId);
            return;
          }
          
          // 将当前操作ID添加到已处理列表
          if (operationId !== 'unknown') {
            processedActions.push(operationId);
            // 只保留最近的20个ID
            if (processedActions.length > 20) {
              processedActions.shift();
            }
            sessionStorage.setItem('processedActions', JSON.stringify(processedActions));
          }
          
          // 确保有效的对话ID并尝试加载完整的对话历史
          if (!currentChatId) {
            const savedChatId = localStorage.getItem(CURRENT_CHAT_KEY) || lastChatIdRef.current;
            if (savedChatId) {
              console.log('工具操作前恢复对话ID:', savedChatId);
              setChatId(savedChatId);
              
              // 尝试加载对话历史
              const chats = await getStorage('chats') || {};
              if (chats[savedChatId]) {
                console.log('从存储恢复对话历史:', chats[savedChatId].messages?.length || 0, '条消息');
                setMessages(chats[savedChatId].messages || []);
                setCurrentChatTitle(chats[savedChatId].title || '新对话');
                setSelectedModel(chats[savedChatId].model || 'gpt-3.5-turbo');
              }
            } else {
              console.log('没有找到有效的对话ID，可能需要创建新对话');
              // 不立即创建，让handleSend函数处理
            }
          } else {
            // 即使有currentChatId，也确保消息历史是最新的
            if (messages.length === 0) {
              console.log('当前有对话ID但消息为空，尝试恢复历史消息');
              const chats = await getStorage('chats') || {};
              if (chats[currentChatId]) {
                console.log('从存储恢复对话历史:', chats[currentChatId].messages?.length || 0, '条消息');
                setMessages(chats[currentChatId].messages || []);
              }
            }
          }
          
          const { text, prompt } = message.data;
          
          // 构建完整消息：引用内容 + 提示词
          let fullContent = `> ${text}\n\n${prompt}`;
          console.log('准备执行工具操作:', fullContent.substring(0, 50) + (fullContent.length > 50 ? '...' : ''));
          
          // 重置任何可能的错误状态
          setStreamingMessage(null);
          
          // 直接发送消息，不再使用延迟或轮询
          console.log('立即执行发送操作');
          handleSend(fullContent);
          
          // 添加安全检查，确保动画最终会消失
          setTimeout(() => {
            // 如果30秒后仍然在加载状态，强制重置
            if (isLoading || isGenerating) {
              console.log('检测到长时间加载，强制重置状态');
              setIsLoading(false);
              setIsGenerating(false);
              setStreamingMessage(null);
              if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
              }
            }
          }, 30000);
        }
      } catch (error) {
        console.error('执行工具操作失败:', error);
        // 确保错误情况下也重置状态
        setIsLoading(false);
        setIsGenerating(false);
        setStreamingMessage(null);
      } finally {
        console.log('消息处理完成，状态已重置');
      }
    };

    // 监听来自扩展后台的消息
    const messageListener = (message, sender, sendResponse) => {
      if (message.type === 'updateQuotes') {
        setQuotes(message.quotes || []);
      } else if (message.type === 'executeToolAction') {
        handleToolAction(message);
        // 发送接收确认
        if (sendResponse) {
          sendResponse({ received: true });
        }
      }
      
      return true; // 表示将异步回复
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
      
      // 组件卸载时清理状态，防止侧边栏关闭再打开时状态不一致
      if (isLoading || isGenerating) {
        console.log('组件卸载时重置状态');
        // 如果有进行中的请求，取消它
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        }
      }
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
    
    // 创建新对话或恢复现有对话
    const initializeChat = async () => {
      // 检查是否有已保存的对话ID
      const savedChatId = localStorage.getItem(CURRENT_CHAT_KEY);
      if (savedChatId) {
        console.log('尝试从localStorage加载对话:', savedChatId);
        const chats = await getStorage('chats') || {};
        if (chats[savedChatId]) {
          console.log('成功加载保存的对话:', chats[savedChatId].title);
          setChatId(savedChatId);
          setSelectedModel(chats[savedChatId].model || 'gpt-3.5-turbo');
          setMessages(chats[savedChatId].messages || []);
          setCurrentChatTitle(chats[savedChatId].title || '新对话');
          return; // 已加载保存的对话，无需创建新对话
        } else {
          console.warn('保存的对话ID存在，但对话数据未找到:', savedChatId);
        }
      }
      
      // 如果没有有效的保存对话，则创建新对话
      const newChatId = `chat_${Date.now()}`;
      console.log('创建新对话:', newChatId);
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
    initializeChat();
    
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

  // 自定义设置模型的函数，同时更新引用和状态
  const handleModelChange = (modelId) => {
    setSelectedModel(modelId);
    currentModelRef.current = modelId;
    
    // 如果有当前对话，更新对话的模型信息
    if (currentChatId) {
      updateChatModel(currentChatId, modelId);
    }
  };
  
  // 更新对话使用的模型
  const updateChatModel = async (chatId, modelId) => {
    if (!chatId) return;
    
    try {
      const chats = await getStorage('chats') || {};
      if (chats[chatId]) {
        chats[chatId].model = modelId;
        await saveChat(chats);
      }
    } catch (error) {
      console.error('更新对话模型失败:', error);
    }
  };

  // 处理发送消息逻辑
  const handleSend = async (overrideInput = null) => {
    try {
      const messageContent = overrideInput !== null ? overrideInput : input;
      
      // 如果消息为空且没有图片则不处理
      if (!messageContent.trim() && uploadedImages.length === 0) {
        return;
      }
      
      // 立即重置滚动位置函数，确保用户流畅的体验
      if (restoreScrollPositionRef.current) {
        restoreScrollPositionRef.current();
        restoreScrollPositionRef.current = null;
      }
      
      // 清空输入框并重置高度
      if (!overrideInput) {
        setInput('');
        // 重置输入框高度
        resetTextareaHeight();
      }
      
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
      
      if ((!messageContent.trim() && quotes.length === 0 && uploadedImages.length === 0) || isLoading || isGenerating) {
        console.log('发送条件不满足或当前正在处理其他请求');
        return;
      }

      // 使用当前最新的模型设置，确保模型选择后立即使用
      const currentModel = currentModelRef.current;
      
      // 准备消息内容
      let messageContentForAPI;
      
      // 如果有图片，则准备多模态消息格式
      if (uploadedImages.length > 0) {
        messageContentForAPI = [];
        
        // 先添加文本内容
        if (messageContent.trim() || quotes.length > 0) {
          let fullTextContent = '';
          
          // 添加引用内容
          if (quotes.length > 0) {
            quotes.forEach((quote) => {
              fullTextContent += `> ${quote.text}\n\n`;
            });
          }
          
          // 添加用户输入
          if (messageContent.trim()) {
            fullTextContent += messageContent;
          }
          
          messageContentForAPI.push({
            type: 'text',
            text: fullTextContent
          });
        }
        
        // 添加所有图片
        uploadedImages.forEach(image => {
          messageContentForAPI.push({
            type: 'image_url',
            image_url: {
              url: image.base64,
              detail: 'high'
            }
          });
        });
      } else {
        // 组合引用内容和用户输入为纯文本格式
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
        
        messageContentForAPI = fullContent;
      }
      
      console.log('准备发送消息类型:', typeof messageContentForAPI === 'string' ? '纯文本' : '多模态');
      
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
            console.log('加载历史消息:', chats[savedChatId].messages?.length || 0, '条');
            setMessages(chats[savedChatId].messages || []);
            setCurrentChatTitle(chats[savedChatId].title || '新对话');
            setSelectedModel(chats[savedChatId].model || 'gpt-3.5-turbo');
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
      } else if (messages.length === 0) {
        // 有对话ID但没有消息，可能是侧边栏刚刚打开
        console.log('有对话ID但没有消息，尝试从存储加载');
        try {
          const chats = await getStorage('chats') || {};
          if (chats[currentChatId]) {
            console.log('从存储加载对话消息:', chats[currentChatId].messages?.length || 0, '条');
            setMessages(chats[currentChatId].messages || []);
            // 确保更新后再添加新消息
            const currentMessages = chats[currentChatId].messages || [];
            
            const userMessage = {
              role: 'user',
              content: messageContentForAPI
            };
            
            // 清空输入框和引用内容
            setQuotes([]);
            // 清空上传的图片
            setUploadedImages([]);
            
            // 如果使用的是Chrome扩展环境，通知后台清空引用内容
            if (typeof chrome !== 'undefined' && chrome.runtime) {
              chrome.runtime.sendMessage({
                type: 'clearAllQuotes'
              });
            }
            
            // 将新消息添加到当前消息列表
            setMessages([...currentMessages, userMessage]);
            // 后续代码继续处理发送...
            setIsLoading(true);
            setIsGenerating(true);
            
            // 创建流式响应的初始消息
            setStreamingMessage({
              role: 'assistant',
              content: '',
              model: currentModel // 使用当前引用的模型值
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
                    model: currentModel
                  };
                  return {
                    ...prev,
                    content: prev.content + chunk
                  };
                });
              };
              
              const assistantMessage = await sendMessage(
                messageContentForAPI, 
                currentModel, // 使用当前引用的模型值
                currentMessages, // 使用加载的历史消息 
                onChunkReceived, 
                abortControllerRef.current.signal
              );
              
              // 为AI消息添加模型信息
              assistantMessage.model = currentModel;
              
              // 完成后清除流式消息，并添加完整回复
              setStreamingMessage(null);
              
              const updatedMessages = [...currentMessages, userMessage, assistantMessage];
              setMessages(updatedMessages);
              
              // 更新存储
              if (currentChatId) {
                const updatedChats = await getStorage('chats') || {};
                if (updatedChats[currentChatId]) {
                  // 如果是第一次发送消息，自动更新对话标题
                  if (updatedChats[currentChatId].messages.length === 0 && updatedChats[currentChatId].title === '新对话') {
                    const newTitle = generateChatTitle(typeof messageContentForAPI === 'string' ? messageContentForAPI : '图片问答');
                    updatedChats[currentChatId].title = newTitle;
                    setCurrentChatTitle(newTitle);
                  }
                  
                  updatedChats[currentChatId].messages = updatedMessages;
                  updatedChats[currentChatId].model = currentModel;
                  await saveChat(updatedChats);
                }
              }
              
              // 确保重置状态
              setIsLoading(false);
              setIsGenerating(false);
            } catch (error) {
              console.error('API请求失败:', error);
              
              setMessages(prev => {
                // 移除最后一条用户消息，避免重复
                const messages = prev.filter((_, index) => index !== prev.length - 1);
                // 添加错误消息
                return [...messages, {
                  role: 'assistant',
                  content: `调用API失败: ${error.message}`
                }];
              });
              
              // 重置状态
              setIsLoading(false);
              setIsGenerating(false);
              setStreamingMessage(null);
              
              if (abortControllerRef.current) {
                abortControllerRef.current = null;
              }
            }
            return;
          }
        } catch (error) {
          console.error('加载对话数据失败:', error);
        }
      }
      
      // 准备当前消息列表
      const currentMessages = messages;
      
      // 准备用户消息
      const userMessage = {
        role: 'user',
        content: messageContentForAPI
      };
      
      // 清空引用内容和上传的图片
      setQuotes([]);
      setUploadedImages([]);
      
      // 如果使用的是Chrome扩展环境，通知后台清空引用内容
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: 'clearAllQuotes'
        });
      }
      
      // 将新消息添加到当前消息列表，通过状态更新UI
      setMessages([...currentMessages, userMessage]);
      
      // 设置加载状态
      setIsLoading(true);
      setIsGenerating(true);
      
      // 设置流式消息的初始状态
      setStreamingMessage({
        role: 'assistant',
        content: '',
        model: currentModel
      });
      
      try {
        // 创建AbortController用于中断请求
        abortControllerRef.current = new AbortController();
        
        // 使用回调函数更新流式消息
        const onChunkReceived = (chunk) => {
          setStreamingMessage(prev => {
            if (!prev) return {
              role: 'assistant',
              content: chunk,
              model: currentModel
            };
            return {
              ...prev,
              content: prev.content + chunk
            };
          });
        };
        
        // 发送消息并获取助手响应
        const assistantMessage = await sendMessage(
          messageContentForAPI,
          currentModel,
          currentMessages,
          onChunkReceived,
          abortControllerRef.current.signal
        );
        
        // 添加模型信息
        assistantMessage.model = currentModel;
        
        // 清除流式消息状态
        setStreamingMessage(null);
        
        // 更新消息列表
        const updatedMessages = [...currentMessages, userMessage, assistantMessage];
        setMessages(updatedMessages);
        
        // 保存到存储
        if (currentChatId) {
          const chats = await getStorage('chats') || {};
          if (chats[currentChatId]) {
            // 更新标题（如果是新对话）
            if (chats[currentChatId].messages.length === 0 && chats[currentChatId].title === '新对话') {
              const newTitle = generateChatTitle(typeof messageContentForAPI === 'string' ? messageContentForAPI : '图片问答');
              chats[currentChatId].title = newTitle;
              setCurrentChatTitle(newTitle);
            }
            
            // 更新消息和模型
            chats[currentChatId].messages = updatedMessages;
            chats[currentChatId].model = currentModel;
            await saveChat(chats);
          }
        }
      } catch (error) {
        console.error('API请求失败:', error);
        
        // 更新消息列表，添加错误信息
        setMessages([...currentMessages, userMessage, {
          role: 'assistant',
          content: `调用API失败: ${error.message}`
        }]);
      } finally {
        // 重置状态
        setIsLoading(false);
        setIsGenerating(false);
        setStreamingMessage(null);
        abortControllerRef.current = null;
      }
    } catch (error) {
      console.error('发送消息处理失败:', error);
      setIsLoading(false);
      setIsGenerating(false);
      setStreamingMessage(null);
      if (abortControllerRef.current) {
        abortControllerRef.current = null;
      }
    }
  };

  // 停止生成回复
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      // 保存当前已生成的内容，确保不会丢失
      if (streamingMessage && streamingMessage.content) {
        const partialMessage = {
          role: 'assistant',
          content: streamingMessage.content + '\n\n**[用户已中止生成]**',
          model: currentModelRef.current // 确保保存模型信息
        };
        
        // 更新消息列表
        setMessages(prev => {
          const newMessages = [...prev, partialMessage];
          // 异步更新存储
          (async () => {
            if (currentChatId) {
              const chats = await getStorage('chats') || {};
              if (chats[currentChatId]) {
                chats[currentChatId].messages = newMessages;
                await saveChat(chats);
              }
            }
          })();
          return newMessages;
        });
      }
      
      // 中止请求
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
    // 记录当前编辑的消息索引，用于编辑完成后恢复位置
    lastEditedIndexRef.current = index;
    // 记录当前滚动位置以便在退出编辑模式时恢复
    if (messageListRef.current) {
      restoreScrollPositionRef.current = messageListRef.current.preserveScrollPosition();
    }
    setEditingMessageIndex(index);
    setEditingMessageContent(message.content);
  };

  const handleSaveEdit = async () => {
    // 记录当前编辑的消息索引
    const targetScrollIndex = editingMessageIndex;
    
    if (editingMessageIndex !== null) {
      // 使用 MessageList 的 preserveScrollPosition 来保存当前滚动位置
      const restoreScroll = messageListRef.current?.preserveScrollPosition();
      
      // 检查消息内容是否真的有变化
      const originalMessage = messages[editingMessageIndex];
      if (originalMessage.content !== editingMessageContent) {
        // 构建更新后的消息数组
        const updatedMessages = [...messages];
        updatedMessages[editingMessageIndex] = {
          ...updatedMessages[editingMessageIndex],
          content: editingMessageContent
        };
        
        // 更新本地消息
        setMessages(updatedMessages);
        
        // 保存到存储
        if (currentChatId) {
          const chats = await getStorage('chats') || {};
          if (chats[currentChatId]) {
            chats[currentChatId].messages = updatedMessages;
            await saveChat(chats);
          }
        }
      }
      
      // 重置编辑状态
      setEditingMessageIndex(null);
      setEditingMessageContent('');
      
      // 等到下一帧再尝试恢复滚动位置
      requestAnimationFrame(() => {
        // 先尝试使用通用的恢复方法
        if (restoreScroll) restoreScroll();
        
        // 再尝试使用具体消息索引滚动 (作为备份)
        setTimeout(() => {
          // 如果第一种方法不成功，尝试第二种方法
          if (messageListRef.current && targetScrollIndex !== null) {
            messageListRef.current.scrollToMessage(targetScrollIndex);
          }
        }, 50);
      });
    }
  };
  
  const handleCancelEdit = () => {
    // 记录当前编辑的消息索引
    const targetScrollIndex = editingMessageIndex;
    
    // 使用 MessageList 的 preserveScrollPosition 来保存当前滚动位置
    const restoreScroll = messageListRef.current?.preserveScrollPosition();
    
    // 重置编辑状态
    setEditingMessageIndex(null);
    setEditingMessageContent('');
    
    // 使用多层保险机制恢复滚动位置
    requestAnimationFrame(() => {
      // 先尝试使用通用的恢复方法
      if (restoreScroll) restoreScroll();
      
      // 再尝试使用具体消息索引滚动 (作为备份)
      setTimeout(() => {
        if (messageListRef.current && targetScrollIndex !== null) {
          messageListRef.current.scrollToMessage(targetScrollIndex);
        }
      }, 50);
    });
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
    
    // 强制滚动到底部，重置用户滚动状态
    if (messageListRef.current) {
      messageListRef.current.resetUserScrollState();
    }
    
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
          content: '',
          model: selectedModel // 添加模型信息
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
              content: streamingMessage.content + '\n\n**[用户已中止生成]**',
              model: selectedModel // 添加模型信息
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
          content: '',
          model: selectedModel // 添加模型信息
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
              content: streamingMessage.content + '\n\n**[用户已中止生成]**',
              model: selectedModel // 添加模型信息
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

  // 添加新函数用于重置输入框高度
  const resetTextareaHeight = () => {
    const textarea = document.querySelector('.chat-input');
    if (textarea) {
      textarea.style.height = 'auto';
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <button 
          className="new-chat-btn"
          onClick={handleNewChat}
        >
          新对话
        </button>
        
        <div className="current-chat-title">
          {currentChatTitle || '新对话'}
        </div>
        
        {/* 模型选择器组件，传递更新函数 */}
        <ModelSelector 
          selectedModel={selectedModel} 
          setSelectedModel={handleModelChange} 
        />
      </div>
      
      {/* 使用固定高度的容器并设置overflow属性，防止DOM变化导致滚动重置 */}
      <div className="message-container" style={{ 
        height: 'calc(100% - 160px)', 
        position: 'relative',
        overflow: 'hidden'
      }}>
        {editingMessageIndex !== null ? (
          <div className="message-edit-container" style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <textarea
              className="message-edit-textarea"
              value={editingMessageContent}
              onChange={(e) => setEditingMessageContent(e.target.value)}
              style={{
                flex: 1,
                minHeight: 'calc(100% - 50px)',
                resize: 'none',
                padding: '10px',
                fontSize: '14px',
                border: '1px solid #ccc',
                borderRadius: '5px'
              }}
              autoFocus
            />
            <div className="message-edit-actions" style={{
              display: 'flex',
              justifyContent: 'flex-end',
              padding: '10px 0'
            }}>
              <button 
                className="cancel-edit-btn"
                onClick={handleCancelEdit}
              >
                取消
              </button>
              <button 
                className="save-edit-btn"
                onClick={handleSaveEdit}
                style={{ marginLeft: '10px' }}
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
            ref={messageListRef}
          />
        )}
      </div>
      
      <div className="chat-input-container"
           onDragOver={handleDragOver}
           onDrop={handleDrop}
           ref={dropAreaRef}>
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
        
        {/* 上传的图片预览区域 */}
        {uploadedImages.length > 0 && (
          <div className="uploaded-images-container">
            <div className="uploaded-images-header">
              <span>已上传图片 ({uploadedImages.length})</span>
              <button 
                className="clear-all-images-btn" 
                onClick={() => setUploadedImages([])}
              >
                清空
              </button>
            </div>
            <div className="uploaded-images-list">
              {uploadedImages.map((image) => (
                <div className="uploaded-image-item" key={image.id}>
                  <div className="uploaded-image-preview">
                    <img src={image.base64} alt={image.name} />
                  </div>
                  <button 
                    className="delete-image-btn"
                    onClick={() => handleImageDelete(image.id)}
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
            placeholder={uploadedImages.length > 0 ? "输入问题或直接发送图片..." : (quotes.length > 0 ? "添加问题或直接发送引用内容..." : "输入消息或拖拽图片到此处上传...")}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!isGenerating) {
                  handleSend();
                  resetTextareaHeight(); // 添加重置高度的调用
                }
              }
            }}
          />
          
          {/* 图片上传按钮 */}
          <button 
            className="upload-btn"
            onClick={() => fileInputRef.current?.click()}
            title="上传图片"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <input
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={handleImageUpload}
            />
          </button>
          
          <button 
            className={`${isGenerating ? 'stop-btn' : 'send-btn'}`}
            onClick={isGenerating ? handleStopGeneration : () => {
              handleSend();
              resetTextareaHeight(); // 添加重置高度的调用
            }}
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