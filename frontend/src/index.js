import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Fix for Node.js global in browser
if (typeof global === "undefined") {
  window.global = window;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
