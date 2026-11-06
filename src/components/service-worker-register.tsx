'use client';

import { useEffect } from 'react';
import { initOfflineDB } from '@/lib/offline-db';

/**
 * Componente para registrar el Service Worker
 * Debe usarse en el layout principal para inicializar offline functionality
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    const registerServiceWorker = async () => {
      // Verificar que el navegador soporte Service Workers
      if ('serviceWorker' in navigator) {
        try {
          // Inicializar la base de datos offline
          await initOfflineDB();
          console.log('[offline-init] IndexedDB initialized');

          // Registrar el Service Worker
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
          });

          console.log('[SW] Service Worker registered:', registration.scope);

          // Escuchar updates del Service Worker
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[SW] New service worker available, please refresh');
                }
              });
            }
          });

          // Verificar periódicamente si hay updates
          setInterval(() => {
            registration.update();
          }, 60000); // Cada minuto
        } catch (error) {
          console.error('[SW] Registration failed:', error);
        }
      } else {
        console.warn('[SW] Service Workers not supported in this browser');
      }
    };

    registerServiceWorker();
  }, []);

  return null;
}
