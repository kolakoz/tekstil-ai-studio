// Production'da console loglarını devre dışı bırak
if (process.env.NODE_ENV === 'production') {
  console.log = () => {};
  console.warn = () => {};
  console.info = () => {};
  // console.error'u bırak (hatalar için)
}

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';
import './styles/main.css';
import './App.css';

const root = createRoot(document.getElementById('root'));
root.render(<App />);
