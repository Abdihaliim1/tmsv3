import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initAppCheck } from './lib/appCheck';
import { initSentry } from './lib/sentry';

// Initialize Sentry (optional - requires VITE_SENTRY_DSN)
initSentry();

// Initialize Firebase App Check for rate limiting and abuse prevention
// This should be called before rendering the app
initAppCheck();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);