// Fix for Node.js global in browser - MUST be first
if (typeof global === "undefined") {
  window.global = window;
}

/* eslint-disable import/first */
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
/* eslint-enable import/first */

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
