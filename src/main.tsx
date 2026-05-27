import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { LandingPage } from './components/LandingPage';
import { ProWaitlistPage } from './components/ProWaitlistPage';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

const path = window.location.pathname.replace(/\/$/, '') || '/';

function Root() {
  if (path === '/pro') return <ProWaitlistPage />;
  if (path === '/app') return <App />;
  return <LandingPage />;   // '/' and anything else → landing
}

createRoot(rootEl).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
