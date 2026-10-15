import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { MotionConfig } from 'framer-motion';
import App from './App';
import { AuthProvider } from './app/AuthProvider';
import { SiteProvider } from './app/SiteProvider';
import { queryClient } from './app/queryClient';
import { ToastProvider } from './components/ui/Toast';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">
          <BrowserRouter>
            <SiteProvider>
              <AuthProvider>
                <ToastProvider>
                  <App />
                </ToastProvider>
              </AuthProvider>
            </SiteProvider>
          </BrowserRouter>
        </MotionConfig>
      </QueryClientProvider>
    </HelmetProvider>
  </StrictMode>,
);
