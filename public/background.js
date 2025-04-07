// 激活侧边栏功能
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// 监听扩展安装或更新
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("WebChat扩展已安装");
  } else if (details.reason === "update") {
    console.log(`WebChat扩展已更新到版本 ${chrome.runtime.getManifest().version}`);
  }
});

// 存储引用内容的数组
let quotedTexts = [];

// 存储自定义工具
let customTools = [];

// 状态变量
let pendingActions = []; // 存储等待执行的操作
let sidePanelReady = false; // 侧边栏是否已准备好
let sidePanelOpening = false; // 侧边栏是否正在打开中
let lastActionTimestamp = 0; // 上次执行工具操作的时间戳
let lastActionData = null; // 上次执行的工具操作数据
const ACTION_DEBOUNCE_TIME = 1000; // 防抖时间，单位毫秒

// 初始化存储
chrome.storage.local.get(['customTools'], (result) => {
  if (result.customTools) {
    customTools = result.customTools;
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
  
  // 执行工具操作（自动发送引用+提示词）
  if (message.type === "executeToolAction") {
    try {
      // 确保数据完整
      if (!message.data || !message.data.text || !message.data.prompt) {
        console.error('executeToolAction 数据不完整:', message.data);
        return;
      }
      
      // 防抖检查：如果是相同内容的操作且时间间隔小于设定值，则忽略
      const currentTime = Date.now();
      if (lastActionData && 
          lastActionData.text === message.data.text && 
          lastActionData.prompt === message.data.prompt && 
          currentTime - lastActionTimestamp < ACTION_DEBOUNCE_TIME) {
        console.log('忽略重复的工具操作请求（防抖）');
        return;
      }
      
      // 更新上次操作的时间戳和数据
      lastActionTimestamp = currentTime;
      lastActionData = {...message.data};
      
      console.log('background收到工具操作请求:', message.data.prompt);
      
      const actionMessage = {
        type: "executeToolAction",
        data: message.data
      };
      
      // 如果侧边栏已准备好，直接发送
      if (sidePanelReady) {
        console.log('侧边栏已准备好，直接发送工具操作');
        chrome.runtime.sendMessage(actionMessage);
      } 
      // 如果侧边栏正在打开中，添加到待处理队列
      else if (sidePanelOpening) {
        console.log('侧边栏正在打开中，添加到待处理队列');
        pendingActions.push(actionMessage);
        
        // 设置较短的超时，如果侧边栏没有响应就强制发送
        setTimeout(() => {
          if (pendingActions.includes(actionMessage)) {
            console.log('侧边栏打开超时，强制发送工具操作');
            chrome.runtime.sendMessage(actionMessage);
            // 从队列中移除
            pendingActions = pendingActions.filter(a => a !== actionMessage);
          }
        }, 800); // 减少到800ms
      } 
      // 侧边栏可能已经打开但我们不知道其状态，尝试直接发送
      else {
        console.log('侧边栏状态未知，尝试直接发送工具操作');
        chrome.runtime.sendMessage(actionMessage);
      }
    } catch (error) {
      console.error('执行工具操作出错:', error);
    }
  }
  
  // 处理工具操作接收确认
  if (message.type === "toolActionReceived") {
    console.log('工具操作已被侧边栏接收');
  }
  
  // 检查工具操作是否已接收
  if (message.type === "checkToolActionReceived") {
    // 如果侧边栏尚未收到原始消息，则重新发送
    chrome.runtime.sendMessage({
      type: "executeToolAction",
      data: message.data
    });
  }
}); 