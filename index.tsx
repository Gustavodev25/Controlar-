import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import Clarity from '@microsoft/clarity';

import { NovaLanding } from './components/novalandingpage/NovaLanding';

// Initialize Microsoft Clarity
Clarity.init("vrjxwi0q7x");

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
const isNovaLanding = window.location.pathname === '/novalanding';

root.render(
  <React.StrictMode>
    {isNovaLanding ? <NovaLanding onLogin={() => window.location.href = '/'} /> : <App />}
  </React.StrictMode>
);