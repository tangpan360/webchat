import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';

// 添加自定义KaTeX样式
const katexStyles = `
.katex-display {
  overflow-x: auto;
  overflow-y: hidden;
  padding: 6px 0;
  margin: 8px 0;
  display: block !important;
  text-align: center;
}

.katex {
  font-size: 1.1em;
}

/* 确保行间公式独立成段 */
.message-text p .katex-display {
  display: block !important;
  margin: 12px auto;
}

/* 行内公式样式 */
.message-text p .katex-inline {
  display: inline-block !important;
  vertical-align: middle;
  padding: 0 2px;
}

/* 防止公式被挤压 */
.message-text p {
  overflow-wrap: break-word;
  word-break: break-word;
  hyphens: auto;
}

/* Markdown排版样式调整 */
.message-text h1, 
.message-text h2, 
.message-text h3, 
.message-text h4, 
.message-text h5, 
.message-text h6 {
  margin-top: 16px;
  margin-bottom: 8px;
}

.message-text p {
  margin-top: 8px;
  margin-bottom: 8px;
}

.message-text p + h1,
.message-text p + h2,
.message-text p + h3,
.message-text p + h4 {
  margin-top: 12px;
}

.message-text hr {
  margin: 8px 0;
  border: 0;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.message-text hr + h1,
.message-text hr + h2,
.message-text hr + h3 {
  margin-top: 12px;
}

.message-text h3 + p,
.message-text h2 + p,
.message-text h1 + p {
  margin-top: 6px;
}

.message-text ul, 
.message-text ol {
  margin-top: 8px;
  margin-bottom: 8px;
  padding-left: 24px;
}

/* 表格样式 */
.message-text table {
  border-collapse: collapse;
  margin: 12px 0;
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  display: block;
  font-size: 14px;
  table-layout: fixed;
}

.message-text .table-container {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  margin: 12px 0;
  border-radius: 4px;
  border: none;
}

.message-text thead {
  background-color: #f5f7fa;
  border-bottom: 2px solid #e0e6ed;
}

.message-text th, .message-text td {
  padding: 8px 12px;
  border: 1px solid #e0e6ed;
  text-align: left;
  word-break: break-word;
  min-width: 80px;
  max-width: 300px;
}

.message-text th {
  font-weight: 600;
  color: #4a5568;
}

.message-text tr:nth-child(even) {
  background-color: #f9fafb;
}

.message-text tr:hover {
  background-color: #f1f5f9;
}

/* 确保公式和表格不冲突 */
.message-text .katex-display + table,
.message-text table + .katex-display {
  margin-top: 16px;
}

/* 图片展示样式 */
.message-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0;
}

.message-image {
  border-radius: 8px;
  overflow: hidden;
  max-width: 100%;
  cursor: pointer;
  position: relative;
}

.message-image img {
  max-width: 100%;
  height: auto;
  object-fit: contain;
  transition: transform 0.2s;
}

.message-image img:hover {
  transform: scale(1.02);
}

.message-image-preview {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.8);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.message-image-preview img {
  max-width: 90%;
  max-height: 90%;
  object-fit: contain;
}

.message-image-preview-close {
  position: absolute;
  top: 20px;
  right: 20px;
  color: white;
  font-size: 24px;
  cursor: pointer;
  background: none;
  border: none;
}
`;

const MessageList = forwardRef(({ 
  messages, 
  onEditMessage,
  onDeleteMessage,
  onRegenerateMessage,
  onCopyMessage,
  isGenerating
}, ref) => {
  const messagesEndRef = useRef(null);
  const messageListRef = useRef(null);
  const messageRefs = useRef({});
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const prevMessagesLengthRef = useRef(messages.length);
  const lastContentRef = useRef('');
  const isUserNearBottomRef = useRef(true);
  const userHasScrolledUpRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const [previewImage, setPreviewImage] = useState(null);
  
  // 暴露滚动方法给父组件
  useImperativeHandle(ref, () => ({
    scrollToBottom: () => {
      scrollToBottom();
    },
    // 用于重置用户滚动状态
    resetUserScrollState: () => {
      userHasScrolledUpRef.current = false;
      scrollToBottom();
    },
    // 滚动到特定消息索引的位置 - 使用即时滚动，无动画
    scrollToMessage: (index) => {
      if (messageRefs.current[index]) {
        messageRefs.current[index].scrollIntoView({
          behavior: 'auto', // 改为即时滚动，没有动画
          block: 'center'
        });
      }
    },
    // 精确保持滚动位置不变
    preserveScrollPosition: () => {
      if (!messageListRef.current) return () => {};
      
      // 保存当前的滚动位置
      const currentScrollTop = messageListRef.current.scrollTop || 0;
      
      // 备用方法：记录当前在视口中的消息元素
      let visibleMessageIndex = -1;
      const container = messageListRef.current;
      const containerRect = container.getBoundingClientRect();
      const midpoint = containerRect.top + containerRect.height / 2;
      
      // 找到视口中间位置的消息索引
      Object.entries(messageRefs.current).forEach(([index, element]) => {
        const rect = element.getBoundingClientRect();
        if (rect.top <= midpoint && rect.bottom >= midpoint) {
          visibleMessageIndex = parseInt(index);
        }
      });
      
      // 返回一个函数，用于恢复滚动位置
      return () => {
        // 尝试保持原滚动位置
        if (messageListRef.current) {
          messageListRef.current.scrollTop = currentScrollTop;
          
          // 如果滚动位置没有正确恢复，使用备选方案
          if (visibleMessageIndex !== -1) {
            const attemptScroll = (attempt = 0) => {
              if (messageRefs.current[visibleMessageIndex] && attempt < 5) {
                try {
                  messageRefs.current[visibleMessageIndex].scrollIntoView({
                    block: 'center',
                    inline: 'nearest',
                    behavior: 'auto'
                  });
                } catch (e) {
                  console.error('尝试滚动到可见消息失败:', e);
                  
                  // 重试几次
                  setTimeout(() => attemptScroll(attempt + 1), 50);
                }
              }
            };
            
            // 尝试滚动到之前可见的消息
            setTimeout(attemptScroll, 10);
          }
        }
      };
    }
  }));
  
  // 渲染消息内容
  const renderMessageContent = (message) => {
    if (typeof message.content === 'string') {
      // 处理纯文本消息
      return (
        <div className="message-text">
          <style>{katexStyles}</style>
          <ReactMarkdown
            remarkPlugins={[remarkMath, remarkGfm]}
            rehypePlugins={[rehypeKatex]}
            components={{
              code({node, inline, className, children, ...props}) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={match[1]}
                    PreTag="div"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
              table({node, ...props}) {
                return (
                  <div className="table-container">
                    <table {...props} />
                  </div>
                );
              }
            }}
          >
            {preprocessMarkdown(message.content)}
          </ReactMarkdown>
        </div>
      );
    } else if (Array.isArray(message.content)) {
      // 处理多模态消息（包含文本和图片）
      return (
        <div className="message-multimodal">
          {message.content.map((item, index) => {
            if (item.type === 'text') {
              // 渲染文本内容
              return (
                <div className="message-text" key={`text-${index}`}>
                  <style>{katexStyles}</style>
                  <ReactMarkdown
                    remarkPlugins={[remarkMath, remarkGfm]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      code({node, inline, className, children, ...props}) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                          <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={match[1]}
                            PreTag="div"
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                      table({node, ...props}) {
                        return (
                          <div className="table-container">
                            <table {...props} />
                          </div>
                        );
                      }
                    }}
                  >
                    {preprocessMarkdown(item.text)}
                  </ReactMarkdown>
                </div>
              );
            } else if (item.type === 'image_url') {
              // 渲染图片内容
              return (
                <div className="message-image" key={`image-${index}`} onClick={() => setPreviewImage(item.image_url.url)}>
                  <img src={item.image_url.url} alt="用户上传的图片" />
                </div>
              );
            }
            return null;
          })}
        </div>
      );
    }
    return <div className="message-text">无法显示的消息格式</div>;
  };

  // 检查是否靠近底部
  const checkIfUserNearBottom = () => {
    if (!messageListRef.current) return true;
    
    const container = messageListRef.current;
    const threshold = 150; // 像素阈值，如果用户滚动到距离底部小于此值，认为他们在底部附近
    
    const isNearBottom = 
      container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    
    isUserNearBottomRef.current = isNearBottom;
    
    return isNearBottom;
  };
  
  // 滚动到底部的基本函数
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // 智能滚动函数，考虑用户滚动行为
  const smartScrollToBottom = () => {
    // 如果用户靠近底部或未滚动，自动滚动到最新消息
    if (isUserNearBottomRef.current || !userHasScrolledUpRef.current) {
      scrollToBottom();
    }
  };

  // 处理滚动事件，检测用户滚动行为
  const handleScroll = () => {
    if (!messageListRef.current) return;
    
    const currentScrollTop = messageListRef.current.scrollTop;
    
    // 如果向上滚动，标记用户已主动滚动
    if (currentScrollTop < lastScrollTopRef.current) {
      userHasScrolledUpRef.current = true;
    }
    
    // 如果滚动到底部，重置向上滚动标记
    if (checkIfUserNearBottom()) {
      userHasScrolledUpRef.current = false;
    }
    
    // 保存当前滚动位置
    lastScrollTopRef.current = currentScrollTop;
  };

  // 处理图片预览关闭
  const handleClosePreview = () => {
    setPreviewImage(null);
  };

  // 处理消息变化
  useEffect(() => {
    const isNewMessage = messages.length > prevMessagesLengthRef.current;
    
    // 流式响应中最后一条消息的内容变化
    let isContentChanged = false;
    if (isGenerating && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant' && lastMessage.content !== lastContentRef.current) {
        lastContentRef.current = lastMessage.content;
        isContentChanged = true;
      }
    }
    
    // 新消息处理逻辑
    if (isNewMessage) {
      // 获取最新的消息
      const latestMessage = messages[messages.length - 1];
      
      // 如果是用户消息，始终滚动到底部，无论用户是否滚动过
      if (latestMessage && latestMessage.role === 'user') {
        scrollToBottom();
      } else {
        // 如果是AI消息，遵循智能滚动逻辑
        smartScrollToBottom();
      }
    } 
    // 在内容更新时，如果在生成回复则滚动到底部
    else if (isGenerating && isContentChanged) {
      smartScrollToBottom();
    }
    
    prevMessagesLengthRef.current = messages.length;
  }, [messages, isGenerating]);
  
  // 添加滚动监听
  useEffect(() => {
    const messageListElement = messageListRef.current;
    if (messageListElement) {
      const handleScroll = () => {
        // 获取当前滚动位置
        const currentScrollTop = messageListElement.scrollTop;
        
        // 检测是否是向上滚动
        if (currentScrollTop < lastScrollTopRef.current) {
          userHasScrolledUpRef.current = true;
        }
        
        // 更新上次滚动位置
        lastScrollTopRef.current = currentScrollTop;
        
        // 检查是否在底部附近
        checkIfUserNearBottom();
      };
      
      messageListElement.addEventListener('scroll', handleScroll);
      return () => {
        messageListElement.removeEventListener('scroll', handleScroll);
      };
    }
  }, []);

  // 处理重新生成按钮点击
  const handleRegenerateClick = (index) => {
    // 立即滚动到底部，除非用户手动滚动过
    if (!userHasScrolledUpRef.current) {
      scrollToBottom();
    }
    // 调用父组件传入的重新生成回调
    onRegenerateMessage && onRegenerateMessage(index);
  };

  // 处理复制消息
  const handleCopy = (index, content) => {
    navigator.clipboard.writeText(content).then(() => {
      // 设置复制状态，然后在短时间后清除
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }).catch(err => {
      console.error('复制失败：', err);
    });
  };

  // 处理删除确认
  const handleDeleteClick = (index) => {
    setDeleteConfirmIndex(index);
    // 3秒后自动取消确认状态
    setTimeout(() => {
      setDeleteConfirmIndex(null);
    }, 3000);
  };

  const handleConfirmDelete = (index) => {
    onDeleteMessage && onDeleteMessage(index);
    setDeleteConfirmIndex(null);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // 使用无声通知，不显示alert
    }).catch(err => {
      console.error('复制失败：', err);
    });
  };

  // 预处理Markdown内容，确保正确渲染
  const preprocessMarkdown = (content) => {
    if (!content) return '';
    
    // 如果content不是字符串（可能是数组），则返回空字符串
    if (typeof content !== 'string') {
      return '';
    }
    
    // 确保代码块中的内容被正确转义和渲染
    let processedContent = content
      // 修复围栏代码块的渲染
      .replace(/```([a-zA-Z0-9]*)\n([\s\S]*?)```/g, (match, lang, code) => {
        // 确保代码块中的内容被正确转义
        return '```' + lang + '\n' + code + '```';
      })
      // 修复行内代码的渲染
      .replace(/`([^`]+)`/g, (match, code) => {
        return '`' + code + '`';
      });
      
    // 确保引用块被正确渲染
    processedContent = ensureQuoteRendering(processedContent);
    
    return processedContent;
  };

  // 确保引用内容正确渲染的函数
  const ensureQuoteRendering = (content) => {
    if (!content) return '';
    
    // 处理引用符号，确保 > 引用内容 的格式正确渲染
    // 将行首的 > 替换为更明确的Markdown引用格式
    const processedContent = content.replace(/^(>\s+.*?)$/gm, (match) => {
      return match; // 保持原样，让ReactMarkdown正确处理
    });
    
    return processedContent;
  };

  // 渲染消息列表
  return (
    <div 
      className="message-list" 
      ref={messageListRef}
      onScroll={handleScroll}
    >
      {messages.map((message, index) => {
        const isUser = message.role === 'user';
        const isSystem = message.role === 'system';
        const isLastMessage = index === messages.length - 1;
        
        return (
          <div
            key={index}
            className={`message ${isUser ? 'user-message' : ''} ${isSystem ? 'system-message' : ''}`}
            ref={el => { messageRefs.current[index] = el; }}
          >
            <div className="message-header">
              <div className="message-role">
                {isUser ? '用户' : (isSystem ? '系统' : '助手')}
                {message.model && !isUser && !isSystem && (
                  <span className="message-model">
                    {message.model}
                  </span>
                )}
              </div>
              {!isSystem && (
                <div className="message-actions">
                  {!isUser && (
                    <button
                      className="copy-btn"
                      onClick={() => handleCopy(index, message.content)}
                      title="复制内容"
                    >
                      {copiedIndex === index ? '已复制' : '复制'}
                    </button>
                  )}
                  {!isLastMessage && (
                    <button
                      className="edit-btn"
                      onClick={() => onEditMessage(index, message)}
                      title={isUser ? "编辑消息" : "编辑成默认回复"}
                    >
                      编辑
                    </button>
                  )}
                  {!isLastMessage && (
                    <>
                      {deleteConfirmIndex === index ? (
                        <button
                          className="delete-confirm-btn"
                          onClick={() => handleConfirmDelete(index)}
                        >
                          确认删除
                        </button>
                      ) : (
                        <button
                          className="delete-btn"
                          onClick={() => handleDeleteClick(index)}
                        >
                          删除
                        </button>
                      )}
                    </>
                  )}
                  {isUser && !isLastMessage && (
                    <button
                      className="regenerate-btn"
                      onClick={() => handleRegenerateClick(index)}
                    >
                      重新生成
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="message-content">
              {renderMessageContent(message)}
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
      
      {/* 图片预览弹窗 */}
      {previewImage && (
        <div className="message-image-preview" onClick={handleClosePreview}>
          <img src={previewImage} alt="预览图片" onClick={(e) => e.stopPropagation()} />
          <button className="message-image-preview-close" onClick={handleClosePreview}>×</button>
        </div>
      )}
    </div>
  );
});

export default MessageList; 