import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App';
import './assets/styles.css';

// 为侧边栏页面的body添加特定类名
if (window.location.pathname === '/index.html' || 
    window.location.href.includes('chrome-extension://')) {
  document.body.classList.add('webchat-panel');
  document.body.classList.add('webchat-extension-styles');
}

const container = document.getElementById('app');
if (container) {
  container.classList.add('webchat-extension-styles');
  const root = createRoot(container);
  root.render(<App />);
} 