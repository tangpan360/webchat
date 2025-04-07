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

// 初始化存储
chrome.storage.local.get(['customTools'], (result) => {
  if (result.customTools) {
    customTools = result.customTools;
  }
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 处理打开侧边栏的请求
  if (message.action === "openSidePanel") {
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
      
      console.log('background收到工具操作请求:', message.data.prompt);
      
      // 延迟发送以确保侧边栏已加载完成
      setTimeout(() => {
        // 通知侧边栏执行工具操作
        chrome.runtime.sendMessage({
          type: "executeToolAction",
          data: message.data
        });
      }, 1500); // 增加延迟至1.5秒，确保侧边栏有足够时间完全初始化和加载历史
    } catch (error) {
      console.error('执行工具操作出错:', error);
    }
  }
}); 