/**
 * 内容脚本，用于捕获网页中的选中文本
 * 这个脚本会被注入到浏览器扩展所访问的网页中
 */

// 工具栏及按钮元素
let toolsContainer = null;
let customTools = []; // 自定义工具列表

// 创建工具栏
function createToolsContainer() {
  if (toolsContainer) return;
  
  // 创建工具栏容器
  toolsContainer = document.createElement('div');
  toolsContainer.className = 'webchat-tools-container';
  
  // 添加到文档中
  document.body.appendChild(toolsContainer);
  
  // 加载自定义工具
  loadCustomTools();
  
  // 初始隐藏工具栏
  hideToolsContainer();
}

// 加载自定义工具
function loadCustomTools() {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.sendMessage({ type: 'getCustomTools' }, (response) => {
      if (response && response.tools) {
        customTools = response.tools;
        updateToolsButtons();
      }
    });
  }
}

// 更新工具按钮
function updateToolsButtons() {
  // 清空现有按钮
  toolsContainer.innerHTML = '';
  
  // 添加默认的引用按钮
  const quoteButton = createToolButton('引用', handleQuoteButtonClick);
  toolsContainer.appendChild(quoteButton);
  
  // 添加自定义工具按钮
  customTools.forEach(tool => {
    const button = createToolButton(tool.name, () => handleCustomToolClick(tool));
    toolsContainer.appendChild(button);
  });
}

// 创建工具按钮
function createToolButton(text, clickHandler) {
  const button = document.createElement('button');
  button.className = 'webchat-tool-button';
  button.textContent = text;
  button.addEventListener('click', clickHandler);
  return button;
}

// 引用按钮点击处理函数
function handleQuoteButtonClick() {
  const selection = window.getSelection();
  if (!selection || !selection.toString().trim()) return;
  
  const selectedText = selection.toString().trim();
  
  // 获取当前时间作为引用ID
  const quoteId = Date.now().toString();
  
  // 向侧边栏应用发送消息
  window.postMessage({
    type: 'addQuote',
    quote: {
      id: quoteId,
      text: selectedText
    }
  }, '*');
  
  // 向浏览器扩展发送消息
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.sendMessage({
      type: 'addQuote',
      quote: {
        id: quoteId,
        text: selectedText
      }
    });
  }
  
  // 自动打开侧边栏
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.sendMessage({
      action: "openSidePanel"
    });
  }
  
  // 清除选区并隐藏工具栏
  selection.removeAllRanges();
  hideToolsContainer();
}

// 自定义工具按钮点击处理函数
function handleCustomToolClick(tool) {
  try {
    const selection = window.getSelection();
    if (!selection || !selection.toString().trim()) return;
    
    const selectedText = selection.toString().trim();
    
    // 获取当前时间作为引用ID
    const quoteId = Date.now().toString();
    
    // 引用选中内容
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      // 添加引用
      chrome.runtime.sendMessage({
        type: 'addQuote',
        quote: {
          id: quoteId,
          text: selectedText
        }
      });
      
      console.log('已发送引用内容:', selectedText);
      
      // 打开侧边栏
      chrome.runtime.sendMessage({
        action: "openSidePanel"
      });
      
      // 自动发送带有提示词的消息 - 使用延迟
      setTimeout(() => {
        console.log('准备发送工具操作:', tool.name);
        chrome.runtime.sendMessage({
          type: 'executeToolAction',
          data: {
            text: selectedText,
            prompt: tool.prompt
          }
        });
      }, 1500); // 延迟1.5秒，给侧边栏足够时间加载和初始化
    }
    
    // 清除选区并隐藏工具栏
    selection.removeAllRanges();
    hideToolsContainer();
  } catch (error) {
    console.error('工具操作执行失败:', error);
    // 仍然隐藏工具栏
    hideToolsContainer();
  }
}

// 显示工具栏
function showToolsContainer(x, y) {
  if (!toolsContainer) createToolsContainer();
  
  // 设置工具栏位置
  toolsContainer.style.left = `${x}px`;
  toolsContainer.style.top = `${y}px`;
  toolsContainer.style.display = 'flex';
}

// 隐藏工具栏
function hideToolsContainer() {
  if (toolsContainer) {
    toolsContainer.style.display = 'none';
  }
}

// 处理文本选择
function handleTextSelection(e) {
  setTimeout(() => {
    const selection = window.getSelection();
    if (!selection || !selection.toString().trim()) {
      hideToolsContainer();
      return;
    }
    
    // 获取选区的位置
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    // 计算工具栏的位置（在选区下方的中间位置）
    // 宽度会根据按钮数量动态变化
    let x = window.scrollX + rect.left;
    if (rect.width > 100) {
      x += (rect.width / 2) - 50; // 大致居中
    }
    let y = window.scrollY + rect.bottom + 10; // 在选区下方10px处
    
    // 确保工具栏不会超出视口右侧
    const maxX = window.innerWidth - 100; // 假设最小宽度100px
    if (x > maxX) x = maxX - 5;
    if (x < 0) x = 5;
    
    showToolsContainer(x, y);
  }, 10);
}

// 检查是否点击了工具栏之外的区域
function handleDocumentClick(e) {
  if (toolsContainer && e.target !== toolsContainer && !toolsContainer.contains(e.target)) {
    hideToolsContainer();
  }
}

// 监听来自扩展后台的消息
function handleExtensionMessages() {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'updateCustomTools') {
        loadCustomTools();
      }
      return true;
    });
  }
}

// 初始化
function init() {
  createToolsContainer();
  
  // 添加事件监听器
  document.addEventListener('mouseup', handleTextSelection);
  document.addEventListener('mousedown', handleDocumentClick);
  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (!selection || !selection.toString().trim()) {
      hideToolsContainer();
    }
  });
  
  // 监听扩展消息
  handleExtensionMessages();
  
  // 添加样式
  const style = document.createElement('style');
  style.textContent = `
    .webchat-tools-container {
      position: absolute;
      display: flex;
      align-items: center;
      background-color: #fff;
      border-radius: 4px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      z-index: 10000;
      padding: 4px;
      gap: 4px;
    }
    
    .webchat-tool-button {
      padding: 4px 8px;
      background: #1a73e8;
      color: white;
      border: none;
      border-radius: 3px;
      font-size: 12px;
      cursor: pointer;
      font-family: system-ui, -apple-system, sans-serif;
    }
    
    .webchat-tool-button:hover {
      background: #0d66d0;
    }
  `;
  document.head.appendChild(style);
  
  console.log('WebChat 划线工具栏已初始化');
}

// 当文档加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
} 