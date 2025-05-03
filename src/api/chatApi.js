import { getStorage } from '../utils/storage';

/**
 * 压缩消息内容以减少token使用
 * @param {string} content - 要压缩的内容
 * @param {number} maxLength - 最大长度
 * @returns {string} - 压缩后的内容
 */
const compressContent = (content, maxLength) => {
  if (!content || content.length <= maxLength) return content;
  
  // 简单的压缩策略：保留前后部分，中间用...替代
  const firstPart = Math.floor(maxLength / 2);
  const secondPart = maxLength - firstPart - 3; // 减去"..."的长度
  
  return content.substring(0, firstPart) + '...' + content.substring(content.length - secondPart);
};

/**
 * 处理历史消息，控制数量和长度
 * @param {Array} messages - 历史消息数组
 * @param {Object} settings - 设置对象
 * @returns {Array} - 处理后的历史消息
 */
const processMessages = (messages, settings) => {
  const maxMessages = settings.maxHistoryMessages || 10; // 默认保留10条
  const compressionThreshold = settings.compressionThreshold || 1000; // 默认1000字符压缩
  
  // 限制消息数量，保留最近的消息
  let processedMessages = [...messages];
  
  if (processedMessages.length > maxMessages) {
    // 始终保留系统消息
    const systemMessages = processedMessages.filter(msg => msg.role === 'system');
    
    // 取最近的用户和助手消息
    const recentMessages = processedMessages
      .filter(msg => msg.role !== 'system')
      .slice(-maxMessages);
    
    processedMessages = [...systemMessages, ...recentMessages];
  }
  
  // 压缩过长的消息
  if (compressionThreshold > 0) {
    processedMessages = processedMessages.map(msg => {
      if (typeof msg.content === 'string' && msg.content.length > compressionThreshold) {
        return {
          ...msg,
          content: compressContent(msg.content, compressionThreshold)
        };
      }
      return msg;
    });
  }
  
  return processedMessages;
};

/**
 * 发送消息到API并获取响应
 * @param {string|Array} content - 用户消息内容，可以是文本或包含文本和图片的数组
 * @param {string} modelId - 使用的模型ID
 * @param {Array} previousMessages - 之前的消息历史
 * @param {Function} onChunkReceived - 接收到内容块时的回调函数
 * @param {AbortSignal} signal - 用于中断请求的信号
 * @returns {Promise<Object>} - 助手的响应消息
 */
export const sendMessage = async (content, modelId, previousMessages, onChunkReceived, signal) => {
  // 获取设置
  const settings = await getStorage('settings');
  const defaultApiKey = 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
  
  // 增强验证：检查密钥是否为空或默认值
  if (!settings || !settings.apiKey || settings.apiKey === defaultApiKey || settings.apiKey.trim() === '') {
    throw new Error('缺少API密钥，请在设置中配置有效的API密钥');
  }
  
  // 检查API URL是否有效
  if (!settings.apiUrl || settings.apiUrl.trim() === '') {
    throw new Error('缺少API URL，请在设置中配置有效的API URL');
  }

  // 处理消息历史，控制数量和长度
  const processedHistory = processMessages(previousMessages, settings);
  
  // 映射为API格式
  const history = processedHistory.map(msg => {
    if (typeof msg.content === 'string') {
      return {
        role: msg.role,
        content: msg.content
      };
    } else if (Array.isArray(msg.content)) {
      return {
        role: msg.role,
        content: msg.content
      };
    }
    return {
      role: msg.role,
      content: msg.content
    };
  });

  // 创建请求体
  let userMessage;
  
  // 判断content是字符串还是包含图片的数组
  if (typeof content === 'string') {
    userMessage = { role: 'user', content };
  } else if (Array.isArray(content)) {
    userMessage = { role: 'user', content };
  } else {
    throw new Error('不支持的消息格式');
  }
  
  const messages = [...history, userMessage];

  // 发送请求
  try {
    const response = await fetch(settings.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        stream: true
      }),
      signal // 传递AbortSignal以支持中断请求
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || '请求失败');
    }

    // 处理流式响应
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let content = '';

    // 这里实现流式解析响应
    // 注意：不同的API提供商可能有不同的响应格式
    // 以下是针对OpenAI API的示例实现
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.substring(6));
            const contentDelta = data.choices[0]?.delta?.content || '';
            content += contentDelta;
            
            // 使用回调函数更新UI，实现流式显示
            if (contentDelta && typeof onChunkReceived === 'function') {
              onChunkReceived(contentDelta);
            }
          } catch (e) {
            console.error('解析响应数据失败:', e);
          }
        }
      }
    }

    return {
      role: 'assistant',
      content,
      model: modelId
    };
  } catch (error) {
    console.error('API请求失败:', error);
    throw error;
  }
};

/**
 * 将图片文件转换为base64编码
 * @param {File} file - 图片文件对象
 * @returns {Promise<string>} - 包含base64编码的Promise
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}; 