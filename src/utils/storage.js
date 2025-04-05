/**
 * 从Chrome存储中获取数据
 * @param {string} key - 要获取的数据的键
 * @returns {Promise<any>} - 存储的数据
 */
export const getStorage = (key) => {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      console.log(`从存储中获取 ${key}:`, result[key]);
      resolve(result[key]);
    });
  });
};

/**
 * 将数据保存到Chrome存储
 * @param {string} key - 要保存的数据的键
 * @param {any} value - 要保存的数据
 * @returns {Promise<void>}
 */
export const setStorage = (key, value) => {
  return new Promise((resolve) => {
    console.log(`保存到存储 ${key}:`, value);
    chrome.storage.local.set({ [key]: value }, () => {
      resolve();
    });
  });
};

/**
 * 保存聊天数据
 * @param {Object} chats - 聊天数据对象
 * @returns {Promise<void>}
 */
export const saveChat = (chats) => {
  console.log('保存聊天数据:', chats);
  return setStorage('chats', chats);
};

/**
 * 获取所有聊天数据
 * @returns {Promise<Object>} - 所有聊天数据
 */
export const getAllChats = async () => {
  const chats = await getStorage('chats') || {};
  console.log('获取所有聊天数据:', chats);
  return chats;
};

/**
 * 删除聊天数据
 * @param {string} chatId - 要删除的聊天ID
 * @returns {Promise<void>}
 */
export const deleteChat = async (chatId) => {
  const chats = await getAllChats();
  if (chats[chatId]) {
    console.log('删除聊天数据:', chatId);
    delete chats[chatId];
    await saveChat(chats);
  }
};

/**
 * 获取所有自定义划线工具
 * @returns {Promise<Array>} - 自定义工具数组
 */
export const getCustomTools = async () => {
  const tools = await getStorage('customTools') || [];
  console.log('获取自定义工具:', tools);
  return tools;
};

/**
 * 保存自定义划线工具
 * @param {Array} tools - 自定义工具数组
 * @returns {Promise<void>}
 */
export const saveCustomTools = (tools) => {
  console.log('保存自定义工具:', tools);
  return setStorage('customTools', tools);
};

/**
 * 添加自定义划线工具
 * @param {Object} tool - 工具对象 {id, name, prompt}
 * @returns {Promise<Array>} - 更新后的工具数组
 */
export const addCustomTool = async (tool) => {
  const tools = await getCustomTools();
  
  // 确保工具有唯一ID
  if (!tool.id) {
    tool.id = Date.now().toString();
  }
  
  // 添加新工具
  const updatedTools = [...tools, tool];
  await saveCustomTools(updatedTools);
  return updatedTools;
};

/**
 * 更新自定义划线工具
 * @param {Object} tool - 工具对象 {id, name, prompt}
 * @returns {Promise<Array>} - 更新后的工具数组
 */
export const updateCustomTool = async (tool) => {
  const tools = await getCustomTools();
  const updatedTools = tools.map(t => t.id === tool.id ? tool : t);
  await saveCustomTools(updatedTools);
  return updatedTools;
};

/**
 * 删除自定义划线工具
 * @param {string} toolId - 要删除的工具ID
 * @returns {Promise<Array>} - 更新后的工具数组
 */
export const deleteCustomTool = async (toolId) => {
  const tools = await getCustomTools();
  const updatedTools = tools.filter(tool => tool.id !== toolId);
  await saveCustomTools(updatedTools);
  return updatedTools;
}; 