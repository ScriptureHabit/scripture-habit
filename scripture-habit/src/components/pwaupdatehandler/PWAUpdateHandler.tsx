import React, { useEffect } from 'react';
import { toast } from "react-toastify";
import { useLanguage } from '../../context/LanguageContext';

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
            onClick={() => {
              console.log('Update button clicked. Registration:', registration);

              if (registration) {
                const worker = registration.waiting || registration.installing;
                if (worker) {
                  worker.postMessage({ type: 'SKIP_WAITING' });
                }
              }

              setTimeout(() => {
                window.location.reload();
              }, 500);
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
