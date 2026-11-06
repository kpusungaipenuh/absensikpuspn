import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Auto-update Service Worker for PWA republish on mobile devices
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Auto-update to latest version without requiring app reinstallation
      updateSW(true);
    },
    onOfflineReady() {
      console.log('SITENANG KPU PWA siap digunakan saat offline');
    },
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        // Periodic check every 15 minutes for new updates
        setInterval(() => {
          registration.update().catch(() => {});
        }, 15 * 60 * 1000);

        // Check for updates whenever window regains focus (user re-opens the app)
        window.addEventListener('focus', () => {
          registration.update().catch(() => {});
        });
      }
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
