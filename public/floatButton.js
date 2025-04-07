/**
 * 浮动按钮脚本
 * 在页面右侧显示一个可拖动的悬浮按钮，点击后打开AI对话侧边栏
 */

(function() {
  // 避免在扩展页面中运行
  if (window.location.href.includes('chrome-extension://')) {
    return;
  }

  // 存储按钮状态和位置的键
  const BUTTON_POSITION_KEY = 'webchat_float_button_position';
  
  // 创建浮动按钮
  function createFloatButton() {
    // 检查按钮是否已存在
    if (document.querySelector('.webchat-float-button')) {
      return;
    }
    
    // 创建按钮元素
    const floatButton = document.createElement('button');
    floatButton.className = 'webchat-float-button webchat-extension-styles';
    floatButton.setAttribute('title', '打开AI对话');
    floatButton.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    `;
    
    // 添加到文档中
    document.body.appendChild(floatButton);
    
    // 载入保存的位置
    loadButtonPosition(floatButton);
    
    // 添加事件监听器
    setupDragEvents(floatButton);
    setupClickEvent(floatButton);
    
    console.log('WebChat 悬浮按钮已初始化');
  }
  
  // 设置拖动事件
  function setupDragEvents(button) {
    let isDragging = false;
    let initialY, initialTop;
    
    button.addEventListener('mousedown', function(e) {
      // 只处理左键点击
      if (e.button !== 0) return;
      
      // 阻止默认行为和冒泡
      e.preventDefault();
      e.stopPropagation();
      
      // 开始拖动
      isDragging = true;
      initialY = e.clientY;
      initialTop = parseInt(window.getComputedStyle(button).top, 10);
      
      // 添加拖动样式
      button.classList.add('dragging');
    });
    
    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      
      // 计算新位置
      const newTop = initialTop + (e.clientY - initialY);
      
      // 限制在窗口内
      const maxTop = window.innerHeight - button.offsetHeight;
      const limitedTop = Math.max(0, Math.min(newTop, maxTop));
      
      // 应用新位置
      button.style.top = `${limitedTop}px`;
      button.style.transform = 'none'; // 移除默认的居中垂直变换
    });
    
    document.addEventListener('mouseup', function() {
      if (!isDragging) return;
      
      // 结束拖动
      isDragging = false;
      button.classList.remove('dragging');
      
      // 存储按钮位置
      saveButtonPosition(button);
    });
  }
  
  // 设置点击事件
  function setupClickEvent(button) {
    button.addEventListener('click', function(e) {
      // 防止拖动后触发点击
      if (button.classList.contains('dragging')) {
        return;
      }
      
      // 阻止默认行为和冒泡
      e.preventDefault();
      e.stopPropagation();
      
      // 打开侧边栏
      if (chrome && chrome.runtime) {
        chrome.runtime.sendMessage({ action: 'openSidePanel' });
      }
    });
  }
  
  // 保存按钮位置到本地存储
  function saveButtonPosition(button) {
    const position = {
      top: button.style.top
    };
    
    if (chrome && chrome.storage) {
      chrome.storage.local.set({ [BUTTON_POSITION_KEY]: position });
    } else {
      localStorage.setItem(BUTTON_POSITION_KEY, JSON.stringify(position));
    }
  }
  
  // 从本地存储加载按钮位置
  function loadButtonPosition(button) {
    if (chrome && chrome.storage) {
      chrome.storage.local.get([BUTTON_POSITION_KEY], function(result) {
        if (result && result[BUTTON_POSITION_KEY]) {
          applyPosition(button, result[BUTTON_POSITION_KEY]);
        }
      });
    } else {
      const savedPosition = localStorage.getItem(BUTTON_POSITION_KEY);
      if (savedPosition) {
        applyPosition(button, JSON.parse(savedPosition));
      }
    }
  }
  
  // 应用保存的位置
  function applyPosition(button, position) {
    if (position.top) {
      button.style.top = position.top;
      button.style.transform = 'none'; // 移除默认的居中垂直变换
    }
  }
  
  // 等待页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createFloatButton);
  } else {
    createFloatButton();
  }
})(); 