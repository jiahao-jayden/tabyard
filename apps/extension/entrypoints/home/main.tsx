import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initI18n } from '@/utils/i18n';
import '@/assets/globals.css';

void initI18n().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
