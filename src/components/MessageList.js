import React, { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const MessageList = ({ 
  messages, 
  onEditMessage,
  onDeleteMessage,
  onRegenerateMessage,
  onCopyMessage,
  isGenerating
}) => {
  const messagesEndRef = useRef(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    
    // 替换行内公式 \( \) 为 $ $
    let processed = content.replace(/\\\(\s*(.*?)\s*\\\)/g, '$ $1 $');
    
    // 替换行间公式 \[ \] 为 $$ $$
    processed = processed.replace(/\\\[\s*(.*?)\s*\\\)/g, '$$ $1 $$');
    
    // 替换 [ ] 中的公式（不带反斜杠）
    processed = processed.replace(/\[\s*(.*?)\s*\]/g, (match, formula) => {
      // 检查是否看起来像公式（包含数学符号）
      if (/[\^_{}\\]/.test(formula)) {
        return `$$ ${formula} $$`;
      }
      return match; // 不是公式，保留原样
    });
    
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
    <div className="message-list">
      {messages.map((message, index) => (
        <div 
          key={index} 
          className={`message ${message.role}`}
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
                    onClick={() => onRegenerateMessage && onRegenerateMessage(index)}
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
                remarkPlugins={[remarkMath]}
                rehypePlugins={[
                  [rehypeKatex, { strict: false, throwOnError: false, output: 'html' }]
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
};

export default MessageList; 