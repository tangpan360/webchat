// 激活侧边栏功能
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// 监听扩展安装或更新
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("WebChat扩展已安装");
    // 初始化工具栏设置
    chrome.storage.local.set({ 'toolbarSettings': { enabled: true } });
  } else if (details.reason === "update") {
    console.log(`WebChat扩展已更新到版本 ${chrome.runtime.getManifest().version}`);
    // 确保工具栏设置存在
    chrome.storage.local.get(['toolbarSettings'], (result) => {
      if (!result.toolbarSettings) {
        chrome.storage.local.set({ 'toolbarSettings': { enabled: true } });
      }
    });
  }
});

// 存储引用内容的数组
let quotedTexts = [];

// 存储自定义工具
let customTools = [];

// 工具栏设置
let toolbarSettings = { enabled: true };

// 状态变量
let pendingActions = []; // 存储等待执行的操作
let sidePanelReady = false; // 侧边栏是否已准备好
let sidePanelOpening = false; // 侧边栏是否正在打开中

// 初始化存储
chrome.storage.local.get(['customTools', 'toolbarSettings'], (result) => {
  if (result.customTools) {
    customTools = result.customTools;
  }
  if (result.toolbarSettings) {
    toolbarSettings = result.toolbarSettings;
  }
});

// 跟踪侧边栏状态
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "sidePanelReady") {
    console.log("侧边栏已准备好接收消息");
    sidePanelReady = true;
    sidePanelOpening = false;
    
    // 处理所有待处理的操作
    if (pendingActions.length > 0) {
      console.log(`执行${pendingActions.length}个待处理操作`);
      pendingActions.forEach(action => {
        chrome.runtime.sendMessage(action);
      });
      pendingActions = []; // 清空待处理队列
    }
    
    if (sendResponse) {
      sendResponse({ status: "acknowledged" });
    }
  }
  
  // 当侧边栏关闭时重置状态
  if (message.type === "sidePanelClosed") {
    sidePanelReady = false;
    console.log("侧边栏已关闭");
    if (sendResponse) {
      sendResponse({ status: "acknowledged" });
    }
  }
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 处理打开侧边栏的请求
  if (message.action === "openSidePanel") {
    // 标记侧边栏正在打开
    sidePanelOpening = true;
    sidePanelReady = false;
    chrome.sidePanel.open({ windowId: sender.tab?.windowId });
  }
  
  // 处理添加引用内容的请求
  if (message.type === "addQuote") {
    // 添加新的引用内容
    quotedTexts.push(message.quote);
    
    // 将引用内容发送给侧边栏
    chrome.runtime.sendMessage({
      type: "updateQuotes",
      quotes: quotedTexts
    });
    
    // 尝试打开侧边栏
    if (sender.tab) {
      chrome.sidePanel.open({ windowId: sender.tab.windowId });
    }
  }
  
  // 处理获取引用内容的请求
  if (message.type === "getQuotes") {
    // 直接回复当前引用内容
    chrome.runtime.sendMessage({
      type: "updateQuotes",
      quotes: quotedTexts
    });
    
    // 也返回响应（如果请求方使用了回调）
    if (sendResponse) {
      sendResponse({ quotes: quotedTexts });
    }
    
    return true; // 指示我们可能会异步回复
  }
  
  // 处理删除单个引用的请求
  if (message.type === "deleteQuote") {
    quotedTexts = quotedTexts.filter(quote => quote.id !== message.quoteId);
    
    // 将更新后的引用内容发送给侧边栏
    chrome.runtime.sendMessage({
      type: "updateQuotes",
      quotes: quotedTexts
    });
  }
  
  // 处理清空所有引用的请求
  if (message.type === "clearAllQuotes") {
    quotedTexts = [];
    
    // 通知侧边栏清空引用
    chrome.runtime.sendMessage({
      type: "updateQuotes",
      quotes: []
    });
  }
  
  // 获取自定义工具
  if (message.type === "getCustomTools") {
    chrome.storage.local.get(['customTools'], (result) => {
      if (result.customTools) {
        customTools = result.customTools;
      }
      sendResponse({ tools: customTools });
    });
    return true; // 指示我们会异步回复
  }
  
  // 更新自定义工具列表
  if (message.type === "updateCustomTools") {
    chrome.storage.local.get(['customTools'], (result) => {
      if (result.customTools) {
        customTools = result.customTools;
        
        // 通知所有内容脚本更新工具按钮
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { type: "updateCustomTools" })
              .catch(() => {}); // 忽略不支持的标签页错误
          });
        });
      }
    });
  }

  // 更新工具栏设置
  if (message.type === "updateToolbarSettings") {
    if (message.settings && message.settings.hasOwnProperty('enabled')) {
      toolbarSettings = message.settings;
      
      // 保存设置到存储
      chrome.storage.local.set({ 'toolbarSettings': toolbarSettings });
      
      // 通知所有内容脚本更新工具栏状态
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { 
            type: "updateToolbarSettings",
            settings: toolbarSettings
          }).catch(() => {}); // 忽略不支持的标签页错误
        });
      });
      
      console.log('工具栏设置已更新:', toolbarSettings);
    }
  }
  
  // 执行工具操作（自动发送引用+提示词）
  if (message.type === "executeToolAction") {
    try {
      // 确保数据完整
      if (!message.data || !message.data.text || !message.data.prompt) {
        console.error('executeToolAction 数据不完整:', message.data);
        return;
      }
      
      // 生成唯一操作ID（如果没有）
      if (!message.data.actionId) {
        message.data.actionId = Date.now().toString() + Math.random().toString(36).substring(2, 8);
        console.log('为工具操作生成ID:', message.data.actionId);
      }
      
      console.log('background收到工具操作请求:', message.data.prompt, 'ID:', message.data.actionId);
      
      const actionMessage = {
        type: "executeToolAction",
        data: message.data
      };
      
      // 如果侧边栏已准备好，直接发送
      if (sidePanelReady) {
        console.log('侧边栏已准备好，直接发送工具操作', message.data.actionId);
        chrome.runtime.sendMessage(actionMessage);
      } 
      // 侧边栏未打开或正在打开中，添加到待处理队列
      else {
        // 如果侧边栏未打开，尝试打开
        if (!sidePanelOpening) {
          console.log('侧边栏未打开，正在打开侧边栏');
          sidePanelOpening = true;
          if (sender.tab) {
            chrome.sidePanel.open({ windowId: sender.tab.windowId });
          }
        } else {
          console.log('侧边栏正在打开中');
        }
        
        // 将消息添加到队列（确保队列中没有重复的相同消息）
        // 先检查队列中是否已经有相同ID的消息
        const existingIndex = pendingActions.findIndex(
          act => act.data && act.data.actionId === message.data.actionId
        );
        
        if (existingIndex >= 0) {
          console.log('队列中已存在相同ID的消息，跳过添加');
        } else {
          console.log('将工具操作添加到待处理队列', message.data.actionId);
          pendingActions.push(actionMessage);
        }
      }
    } catch (error) {
      console.error('处理工具操作请求时出错:', error);
    }
    
    return true;
  }
  
  return true; // 允许异步响应
}); 