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
  display: block;
  text-align: center;
}

.katex {
  font-size: 1.1em;
}

/* 确保行间公式独立成段 */
.message-text p .katex-display {
  display: block;
  margin: 12px auto;
}

/* 行内公式样式 */
.message-text p .katex-inline {
  display: inline-block;
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
}

.message-text thead {
  background-color: #f5f7fa;
  border-bottom: 2px solid #e0e6ed;
}

.message-text th, .message-text td {
  padding: 8px 12px;
  border: 1px solid #e0e6ed;
  text-align: left;
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
        if (!element) return;
        const rect = element.getBoundingClientRect();
        // 如果元素在视口中，并且中点在可视区域最中间
        if (rect.top <= midpoint && rect.bottom >= midpoint) {
          visibleMessageIndex = parseInt(index, 10);
        }
      });
      
      // 记录可见元素的顶部偏移量，用于精确恢复位置
      let topElementOffset = 0;
      if (visibleMessageIndex !== -1 && messageRefs.current[visibleMessageIndex]) {
        const element = messageRefs.current[visibleMessageIndex];
        topElementOffset = element.getBoundingClientRect().top - containerRect.top;
      }
      
      // 返回一个函数，用于在DOM更新后恢复滚动位置
      return () => {
        if (!messageListRef.current) return;
        
        // 使用多次尝试的方式确保滚动位置恢复
        const attemptScroll = (attempt = 0) => {
          if (attempt > 5) return; // 最多尝试5次
          
          // 直接设置滚动位置
          messageListRef.current.scrollTop = currentScrollTop;
          
          // 检查是否滚动成功
          if (Math.abs(messageListRef.current.scrollTop - currentScrollTop) < 50) {
            return; // 滚动成功
          }
          
          // 如果直接设置scrollTop失败，尝试使用备用方法
          if (visibleMessageIndex !== -1 && messageRefs.current[visibleMessageIndex]) {
            const element = messageRefs.current[visibleMessageIndex];
            element.scrollIntoView({
              behavior: 'auto',
              block: 'start'
            });
            
            // 调整到精确位置
            if (topElementOffset && messageListRef.current) {
              // 延迟一帧再调整精确位置
              requestAnimationFrame(() => {
                const newRect = element.getBoundingClientRect();
                const containerRect = messageListRef.current.getBoundingClientRect();
                const currentOffset = newRect.top - containerRect.top;
                messageListRef.current.scrollTop += (currentOffset - topElementOffset);
              });
            }
          }
          
          // 如果还没成功，稍后再试
          requestAnimationFrame(() => {
            attemptScroll(attempt + 1);
          });
        };
        
        // 开始尝试滚动恢复
        attemptScroll();
      };
    }
  }));
  
  // 检测用户是否已经滚动到接近底部
  const checkIfUserNearBottom = () => {
    if (!messageListRef.current) return true;
    
    const container = messageListRef.current;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    isUserNearBottomRef.current = isNearBottom;
    
    // 如果用户滚动到底部，重置向上滚动标记
    if (isNearBottom) {
      userHasScrolledUpRef.current = false;
    }
    
    return isNearBottom;
  };
  
  // 强制滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // 智能滚动判断
  const smartScrollToBottom = () => {
    // 如果用户没有主动向上滚动，则始终滚动到底部
    if (!userHasScrolledUpRef.current) {
      scrollToBottom();
    } 
    // 如果用户已向上滚动，但当前在底部附近，也滚动
    else if (isUserNearBottomRef.current) {
      scrollToBottom();
    }
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

  // 处理公式格式，将 \( \) 和 \[ \] 转为 $ $ 和 $$ $$
  const preprocessMarkdown = (content) => {
    if (!content) return '';
    
    // 首先处理已经存在的 $ 和 $$ 格式的公式，避免重复处理
    let processed = content;
    
    // 替换行内公式 \( \) 为 $ $
    processed = processed.replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, '$ $1 $');
    
    // 替换行间公式 \[ \] 为 $$ $$，确保前后有足够的换行符
    processed = processed.replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (match, formula) => {
      // 确保公式前后有空行，使其成为独立段落
      return '\n\n$$\n' + formula.trim() + '\n$$\n\n';
    });
    
    // 确保多行公式正确渲染
    processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
      // 不论公式是否包含换行，都确保它被处理为独立段落
      return '\n\n$$\n' + formula.trim() + '\n$$\n\n';
    });
    
    // 处理连续段落间可能出现的多余空行
    processed = processed.replace(/\n{3,}/g, '\n\n');
    
    // 处理连续的标题和分隔符
    processed = processed.replace(/---\s*\n+\s*###/g, '---\n###');
    
    // 确保分段标记和公式之间的正确空间
    processed = processed.replace(/(\n\n)(#+\s+)/g, '$1$2');
    
    return processed;
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

  return (
    <div 
      className="message-list" 
      ref={messageListRef}
      style={{ overflow: 'auto', height: '100%' }} // 确保容器有明确的高度和滚动行为
    >
      <style>{katexStyles}</style>
      {messages.map((message, index) => (
        <div 
          key={index} 
          className={`message ${message.role}`}
          ref={el => messageRefs.current[index] = el}
        >
          <div className="message-header">
            <div className="message-role">
              {message.role === 'user' ? '你' : (message.model || 'AI')}
            </div>
            
            <div className="message-actions">
              {deleteConfirmIndex === index ? (
                // 删除确认按钮
                <div className="delete-confirm-actions">
                  <span className="delete-confirm-text">确定删除?</span>
                  <button 
                    className="confirm-btn yes" 
                    onClick={() => handleConfirmDelete(index)}
                  >
                    是
                  </button>
                  <button 
                    className="confirm-btn no" 
                    onClick={() => setDeleteConfirmIndex(null)}
                  >
                    否
                  </button>
                </div>
              ) : (
                // 正常操作按钮
                <>
                  <button 
                    className={`message-action-btn ${copiedIndex === index ? 'copied' : ''}`}
                    onClick={() => handleCopy(index, message.content)}
                    title={copiedIndex === index ? "已复制" : "复制"}
                  >
                    {copiedIndex === index ? (
                      // 复制成功图标
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    ) : (
                      // 默认复制图标
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    )}
                  </button>
                  
                  <button 
                    className="message-action-btn" 
                    onClick={() => onEditMessage && onEditMessage(index, message)}
                    title="编辑"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                    </svg>
                  </button>
                  
                  <button 
                    className="message-action-btn" 
                    onClick={() => handleRegenerateClick(index)}
                    title="重新生成"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 4v6h-6"></path>
                      <path d="M1 20v-6h6"></path>
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
                      <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"></path>
                    </svg>
                  </button>
                  
                  <button 
                    className="message-action-btn delete" 
                    onClick={() => handleDeleteClick(index)}
                    title="删除"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"></path>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
          
          <div className="message-content">
            <div className="message-text">
              <ReactMarkdown
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[
                  [rehypeKatex, { 
                    strict: false, 
                    throwOnError: false, 
                    output: 'html',
                    trust: true,
                    macros: {
                      "\\mathbb": "\\mathbf",
                      "\\R": "\\mathbb{R}",
                      "\\N": "\\mathbb{N}"
                    },
                    maxSize: 500,
                    maxExpand: 1000,
                    displayMode: true
                  }]
                ]}
                components={{
                  code: ({ node, inline, className, children, ...props }) => {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <div className="code-block">
                        <div className="code-header">
                          <span className="code-language">{match[1]}</span>
                          <button 
                            className="copy-button"
                            onClick={() => copyToClipboard(String(children).replace(/\n$/, ''))}
                          >
                            复制
                          </button>
                        </div>
                        <SyntaxHighlighter
                          style={vscDarkPlus}
                          language={match[1]}
                          PreTag="div"
                          {...props}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                  // 自定义引用块渲染
                  blockquote: ({ node, ...props }) => (
                    <blockquote className="markdown-quote" {...props} />
                  ),
                  // 自定义表格渲染
                  table: ({ node, ...props }) => (
                    <table className="markdown-table" {...props} />
                  ),
                }}
              >
                {preprocessMarkdown(message.content)}
              </ReactMarkdown>
              
              {/* 在最后AI消息并且正在生成回复时显示加载指示器 */}
              {isGenerating && index === messages.length - 1 && message.role === 'assistant' && (
                <div className="message-loading">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
});

export default MessageList; 