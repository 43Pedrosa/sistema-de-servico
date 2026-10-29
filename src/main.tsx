import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { ThemeProvider } from './context/ThemeContext';

// Register service worker for PWA
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('Nova versão da Store Acessórios PWA pronta para atualização.');
  },
  onOfflineReady() {
    console.log('Store Acessórios PWA pronta para funcionamento offline.');
  },
});

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
