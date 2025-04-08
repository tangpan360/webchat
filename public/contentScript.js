/**
 * 内容脚本，用于捕获网页中的选中文本
 * 这个脚本会被注入到浏览器扩展所访问的网页中
 */

// 工具栏及按钮元素
let toolsContainer = null;
let customTools = []; // 自定义工具列表
let toolbarEnabled = true; // 工具栏启用状态

// 创建工具栏
function createToolsContainer() {
  if (toolsContainer) return;
  
  // 创建工具栏容器
  toolsContainer = document.createElement('div');
  toolsContainer.className = 'webchat-tools-container webchat-extension-styles';
  // 添加不可选中属性
  toolsContainer.setAttribute('unselectable', 'on');
  toolsContainer.setAttribute('onselectstart', 'return false;');
  
  // 添加阻止事件冒泡
  toolsContainer.addEventListener('mousedown', function(e) {
    e.stopPropagation();
  });
  
  toolsContainer.addEventListener('click', function(e) {
    e.stopPropagation();
  });
  
  // 添加到文档中
  document.body.appendChild(toolsContainer);
  
  // 加载自定义工具
  loadCustomTools();
  
  // 加载工具栏设置
  loadToolbarSettings();
  
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

// 加载工具栏设置
function loadToolbarSettings() {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.storage) {
    chrome.storage.local.get(['toolbarSettings'], (result) => {
      if (result && result.toolbarSettings) {
        toolbarEnabled = result.toolbarSettings.enabled;
        console.log('工具栏启用状态:', toolbarEnabled);
      }
    });
  }
}

// 更新工具按钮
function updateToolsButtons() {
  // 清空现有按钮
  toolsContainer.innerHTML = '';
  
  // 添加默认的复制按钮
  const copyButton = createToolButton('复制', handleCopyButtonClick);
  toolsContainer.appendChild(copyButton);
  
  // 添加默认的引用按钮
  const quoteButton = createToolButton('引用', handleQuoteButtonClick);
  toolsContainer.appendChild(quoteButton);
  
  // 添加自定义工具按钮
  customTools.forEach(tool => {
    const button = createToolButton(tool.name, (event) => handleCustomToolClick(tool, event));
    toolsContainer.appendChild(button);
  });
}

// 创建工具按钮
function createToolButton(text, clickHandler) {
  const button = document.createElement('button');
  button.className = 'webchat-tool-button';
  button.textContent = text;
  button.addEventListener('click', (event) => {
    // 阻止事件冒泡，防止选中内容被取消
    event.stopPropagation();
    event.preventDefault();
    clickHandler(event);
  });
  return button;
}

// 复制按钮点击处理函数
function handleCopyButtonClick(event) {
  // 阻止事件冒泡和默认行为
  event.stopPropagation();
  event.preventDefault();
  
  const selection = window.getSelection();
  if (!selection || !selection.toString().trim()) return;
  
  const selectedText = selection.toString().trim();
  const button = event.target;
  const originalText = button.textContent;
  const originalBackground = button.style.background || '#1a73e8';
  const buttonWidth = button.offsetWidth;
  const buttonHeight = button.offsetHeight;
  
  // 尝试复制文本到剪贴板
  navigator.clipboard.writeText(selectedText)
    .then(() => {
      // 复制成功，显示对号并变绿
      button.style.width = `${buttonWidth}px`;
      button.style.height = `${buttonHeight}px`;
      button.innerHTML = '<span style="font-size: 12px; line-height: 1;">✓</span>';
      button.style.background = '#52c41a';
      
      // 1秒后恢复原样
      setTimeout(() => {
        button.textContent = originalText;
        button.style.background = originalBackground;
        button.style.width = '';
        button.style.height = '';
      }, 1000);
    })
    .catch(error => {
      // 复制失败，显示错号并变红
      button.style.width = `${buttonWidth}px`;
      button.style.height = `${buttonHeight}px`;
      button.innerHTML = '<span style="font-size: 12px; line-height: 1;">✗</span>';
      button.style.background = '#f44336';
      
      // 1秒后恢复原样
      setTimeout(() => {
        button.textContent = originalText;
        button.style.background = originalBackground;
        button.style.width = '';
        button.style.height = '';
      }, 1000);
      
      console.error('复制到剪贴板失败:', error);
    });
}

// 引用按钮点击处理函数
function handleQuoteButtonClick(event) {
  // 阻止事件冒泡和默认行为
  event.stopPropagation();
  event.preventDefault();
  
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
function handleCustomToolClick(tool, event) {
  // 阻止事件冒泡和默认行为
  event.stopPropagation();
  event.preventDefault();
  
  try {
    const selection = window.getSelection();
    if (!selection || !selection.toString().trim()) return;
    
    const selectedText = selection.toString().trim();
    
    // 获取当前时间作为引用ID
    const quoteId = Date.now().toString();
    
    // 引用选中内容并立即发送工具操作请求
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      console.log('处理工具点击:', tool.name);
      
      // 首先添加引用
      chrome.runtime.sendMessage({
        type: 'addQuote',
        quote: {
          id: quoteId,
          text: selectedText
        }
      });
      
      // 然后打开侧边栏
      chrome.runtime.sendMessage({
        action: "openSidePanel"
      });
      
      // 最后发送工具操作
      console.log('发送工具操作请求:', tool.name);
      chrome.runtime.sendMessage({
        type: 'executeToolAction',
        data: {
          text: selectedText,
          prompt: tool.prompt
        }
      });
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
  // 如果工具栏被禁用，则不显示
  if (!toolbarEnabled) return;
  
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
    // 如果工具栏被禁用，则不显示
    if (!toolbarEnabled) return;
    
    const selection = window.getSelection();
    if (!selection || !selection.toString().trim()) {
      hideToolsContainer();
      return;
    }
    
    // 获取选区的位置
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    // 获取视口尺寸和滚动位置
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    
    // 判断选中区域相对于视口的位置
    const rectTop = rect.top; // 选区顶部相对于视口顶部的位置
    const rectBottom = rect.bottom; // 选区底部相对于视口顶部的位置
    const isTopVisible = rectTop >= 0 && rectTop < viewportHeight;
    const isBottomVisible = rectBottom >= 0 && rectBottom < viewportHeight;
    
    // 计算工具栏的基础水平位置（居中或靠左）
    let x = scrollX + rect.left;
    if (rect.width > 100) {
      x += (rect.width / 2) - 50; // 大致居中
    }
    
    // 确保工具栏不会超出视口左右边界
    const maxX = viewportWidth - 100; // 假设最小宽度100px
    if (x > maxX) x = maxX - 5;
    if (x < 0) x = 5;
    
    let y;
    
    // 根据不同情况计算工具栏的垂直位置
    if (isBottomVisible) {
      // 情况1和3：下部可见，显示在下部
      y = scrollY + rectBottom + 10;
    } else if (isTopVisible) {
      // 情况2：上部可见，下部不可见，显示在上部
      y = scrollY + rectTop - 40; // 减去工具栏的估计高度和一些间距
    } else {
      // 情况4：上部和下部都不可见（选中内容太长，中间可见）
      // 在视口中间显示工具栏
      y = scrollY + (viewportHeight / 2);
    }
    
    // 确保工具栏在视口内可见
    if (y < scrollY) {
      y = scrollY + 10; // 如果太靠上，则放在页面顶部附近
    } else if (y > scrollY + viewportHeight - 50) {
      y = scrollY + viewportHeight - 50; // 如果太靠下，则放在页面底部附近
    }
    
    showToolsContainer(x, y);
  }, 10);
}

// 检查是否点击了工具栏之外的区域
function handleDocumentClick(e) {
  // 如果工具栏存在，并且点击的不是工具栏或其子元素
  if (toolsContainer && e.target !== toolsContainer && !toolsContainer.contains(e.target)) {
    hideToolsContainer();
  }
  // 注意：这里不添加阻止冒泡，因为这是文档级别的点击，我们需要让普通点击正常工作
}

// 监听来自扩展后台的消息
function handleExtensionMessages() {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'updateCustomTools') {
        loadCustomTools();
      } else if (message.type === 'updateToolbarSettings') {
        // 更新工具栏启用状态
        if (message.settings && message.settings.hasOwnProperty('enabled')) {
          toolbarEnabled = message.settings.enabled;
          console.log('工具栏启用状态已更新:', toolbarEnabled);
          
          // 如果禁用了工具栏，则隐藏
          if (!toolbarEnabled) {
            hideToolsContainer();
          }
        }
      }
      return true;
    });
  }
}

// 处理键盘选择文本
function handleKeyboardSelection(e) {
  // 如果工具栏被禁用，则不显示
  if (!toolbarEnabled) return;
  
  // 检测常见的文本选择组合键
  const isTextSelectionKey = (
    // Ctrl+A (全选)
    (e.ctrlKey && e.key === 'a') ||
    // Shift+方向键
    (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) ||
    // Shift+Home/End
    (e.shiftKey && (e.key === 'Home' || e.key === 'End'))
  );
  
  if (isTextSelectionKey) {
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || !selection.toString().trim()) {
        return;
      }

      // 特殊处理Ctrl+A全选的情况
      if (e.ctrlKey && e.key === 'a' && toolsContainer && toolsContainer.style.display === 'flex') {
        // 移除工具栏中的文本从选择中
        try {
          const selRange = selection.getRangeAt(0);
          
          // 如果工具栏可见，创建一个不包含工具栏的选择范围
          if (document.body.contains(toolsContainer)) {
            const toolsRange = document.createRange();
            toolsRange.selectNode(toolsContainer);
            
            // 检查是否有重叠
            if (selRange.intersectsNode(toolsContainer)) {
              // 工具栏在选择范围内，我们需要排除它
              selection.removeAllRanges(); // 清除当前选择
              
              // 重新创建选择，但排除工具栏
              // 注意：这是一个简化的处理方式，实际上可能需要更复杂的范围操作
              const newRange = document.createRange();
              newRange.selectNodeContents(document.body);
              selection.addRange(newRange);
              
              // 重新获取选区范围
              if (selection.rangeCount === 0) return;
            }
          }
        } catch (err) {
          console.error('调整选择范围时出错:', err);
        }
      }
      
      // 获取选区范围
      if (selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // 获取视口尺寸和滚动位置
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      
      // 判断选中区域相对于视口的位置
      const rectTop = rect.top;
      const rectBottom = rect.bottom;
      const isTopVisible = rectTop >= 0 && rectTop < viewportHeight;
      const isBottomVisible = rectBottom >= 0 && rectBottom < viewportHeight;
      
      // 计算工具栏的水平位置
      let x = scrollX + rect.left;
      if (rect.width > 100) {
        x += (rect.width / 2) - 50;
      }
      
      // 确保不超出视口边界
      const maxX = viewportWidth - 100;
      if (x > maxX) x = maxX - 5;
      if (x < 0) x = 5;
      
      let y;
      
      // 根据不同情况计算垂直位置
      if (isBottomVisible) {
        // 下部可见，显示在下部
        y = scrollY + rectBottom + 10;
      } else if (isTopVisible) {
        // 上部可见，显示在上部
        y = scrollY + rectTop - 40;
      } else {
        // 中间可见或全部不可见，显示在视口中间
        y = scrollY + (viewportHeight / 2);
      }
      
      // 确保在视口内可见
      if (y < scrollY) {
        y = scrollY + 10;
      } else if (y > scrollY + viewportHeight - 50) {
        y = scrollY + viewportHeight - 50;
      }
      
      showToolsContainer(x, y);
    }, 10);
  }
}

// 初始化
function init() {
  createToolsContainer();
  
  // 添加事件监听器
  document.addEventListener('mouseup', handleTextSelection);
  document.addEventListener('mousedown', handleDocumentClick);
  document.addEventListener('keyup', handleKeyboardSelection);
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
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      pointer-events: auto;
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
      min-width: auto !important;
      max-width: none !important;
      width: auto !important;
      height: auto !important;
      line-height: normal !important;
      margin: 0 !important;
      transition: background-color 0.3s;
      display: inline-flex;
      justify-content: center;
      align-items: center;
      min-width: 40px !important;
      box-sizing: border-box !important;
      line-height: 1 !important;
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
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