
import React, { useEffect } from 'react';
import { toast } from "react-toastify";
import { useLanguage } from '../../hooks/use-language';

interface PWAUpdateEvent extends CustomEvent {
  detail: ServiceWorkerRegistration;
}

const PWAUpdateHandler: React.FC = () => {
  const { t } = useLanguage();

  useEffect(() => {
    const handleUpdateAvailable = (event: Event) => {
      const pwaEvent = event as PWAUpdateEvent;
      const registration = pwaEvent.detail;
      const updateMessage = t('installPrompt.updateAvailable');
      const updateButtonText = t('installPrompt.updateButton');

      toast.info(
        <div className="pwa-update-toast-container">
          <span className="pwa-update-message">{updateMessage}</span>
          <button
            onClick={(e) => {
              console.log('Update button clicked. Registration:', registration);
              
              // Immediate visual feedback
              const btn = e.currentTarget;
              btn.disabled = true;
              btn.innerHTML = '<span class="loading-spinner" style="display:inline-block; margin-right:8px; width:12px; height:12px; border:2px solid white; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite;"></span> Updating...';
              btn.style.opacity = '0.7';
              btn.style.cursor = 'not-allowed';

              if (registration) {
                const worker = registration.waiting || registration.installing;
                if (worker) {
                  worker.postMessage({ type: 'SKIP_WAITING' });
                  // Fallback reload if controllerchange doesn't fire within 3 seconds
                  setTimeout(() => window.location.reload(), 3000);
                } else {
                  window.location.reload();
                }
              } else {
                window.location.reload();
              }
            }}
            className="pwa-update-button"
          >
            {updateButtonText}
          </button>
        </div>,
        {
          toastId: 'pwa-update',
          position: "bottom-center",
          autoClose: false,
          closeOnClick: false,
          draggable: false,
          closeButton: false,
          className: 'pwa-update-toast-custom'
        }
      );
    };

    window.addEventListener('pwa-update-available', handleUpdateAvailable);
    return () => window.removeEventListener('pwa-update-available', handleUpdateAvailable);
  }, [t]);

  return null;
};

export default PWAUpdateHandler;


