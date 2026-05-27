import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { ProWaitlistPage } from './components/ProWaitlistPage';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

const isProPage = window.location.pathname === '/pro' || window.location.pathname === '/pro/';

createRoot(rootEl).render(
  <StrictMode>
    {isProPage ? <ProWaitlistPage /> : <App />}
  </StrictMode>,
);
