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
      if (msg.content && msg.content.length > compressionThreshold) {
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
 * @param {string} content - 用户消息内容
 * @param {string} modelId - 使用的模型ID
 * @param {Array} previousMessages - 之前的消息历史
 * @param {Function} onChunkReceived - 接收到内容块时的回调函数
 * @param {AbortSignal} signal - 用于中断请求的信号
 * @returns {Promise<Object>} - 助手的响应消息
 */
export const sendMessage = async (content, modelId, previousMessages, onChunkReceived, signal) => {
  // 获取设置
  const settings = await getStorage('settings');
  if (!settings || !settings.apiKey) {
    throw new Error('缺少API密钥，请在设置中配置API密钥');
  }

  // 处理消息历史，控制数量和长度
  const processedHistory = processMessages(previousMessages, settings);
  
  // 映射为API格式
  const history = processedHistory.map(msg => ({
    role: msg.role,
    content: msg.content
  }));

  // 创建请求体
  const messages = [
    ...history,
    { role: 'user', content }
  ];

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
      content
    };
  } catch (error) {
    console.error('API请求失败:', error);
    throw error;
  }
}; 