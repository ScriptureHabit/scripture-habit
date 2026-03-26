/* eslint-disable react-refresh/only-export-components */
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useEffect, useState } from 'react';
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { db, auth } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

import SignupForm from './Components/SignupForm/SignupForm';
import LoginForm from './Components/LoginForm/LoginForm';
import Dashboard from './Components/Dashboard/Dashboard';
import GroupForm from './Components/GroupForm/GroupForm';
import JoinGroup from './Components/JoinGroup/JoinGroup';
import GroupDetails from "./Components/GroupDetails/GroupDetails";
import GroupOptions from './Components/GroupOptions/GroupOptions';
import LandingPage from './Components/LandingPage/LandingPage';
import Welcome from './Components/Welcome/Welcome';
import ForgotPassword from "./Components/ForgotPassword/ForgotPassword";
import InviteRedirect from './Components/InviteRedirect/InviteRedirect';
import Maintenance from './Components/Maintenance/Maintenance';
import { MAINTENANCE_MODE } from './config';
import * as Sentry from "@sentry/react";
import InstallPrompt from './Components/InstallPrompt/InstallPrompt';
import { handleInAppBrowserRedirect, isInAppBrowser } from './Utils/browserDetection';
import CookieConsent from './Components/CookieConsent/CookieConsent';
import BrowserWarningModal from './Components/BrowserWarningModal/BrowserWarningModal';

import PrivacyPolicy from './Components/PrivacyPolicy/PrivacyPolicy';
import TermsOfService from './Components/TermsOfService/TermsOfService';
import LegalDisclosure from './Components/LegalDisclosure/LegalDisclosure';
import { LanguageProvider, useLanguage, SUPPORTED_LANGUAGES } from './Context/LanguageContext';
import { SettingsProvider } from './Context/SettingsContext';
import SEOManager from './Components/SEOManager';

const PWAUpdateHandler: React.FC = () => {
  const { t } = useLanguage();

  useEffect(() => {
    const handleUpdateAvailable = (event: any) => {
      const registration = event.detail;
      const updateMessage = t('installPrompt.updateAvailable');
      const updateButtonText = t('installPrompt.updateButton');

      toast.info(
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '10px' }}>
          <span style={{ fontSize: '0.9rem' }}>{updateMessage}</span>
          <button
            onClick={() => {
              console.log('Update button clicked. Registration:', registration);

              if (registration) {
                const worker = registration.waiting || registration.installing;
                if (worker) {
                  worker.postMessage({ type: 'SKIP_WAITING' });
                }
              }

              // If no worker found or signaling failed, or as a safety measure,
              // give it a short moment to activate and then force reload
              setTimeout(() => {
                window.location.reload();
              }, 500);
            }}
            style={{
              padding: '6px 12px',
              background: '#4a90e2',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.8rem',
              whiteSpace: 'nowrap'
            }}
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
          style: {
            background: '#fff',
            color: '#1a202c',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            borderRadius: '12px',
            padding: '12px'
          }
        }
      );
    };

    window.addEventListener('pwa-update-available', handleUpdateAvailable);
    return () => window.removeEventListener('pwa-update-available', handleUpdateAvailable);
  }, [t]);

  return null;
};

interface SystemStatus {
  loading: boolean;
  error: string | null;
  maintenance?: boolean;
}

const App: React.FC = () => {
  const [authLoading, setAuthLoading] = useState(true);
  const [showBrowserWarning, setShowBrowserWarning] = useState(false);

  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, () => {
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const isRedirecting = handleInAppBrowserRedirect();
    if (!isRedirecting && isInAppBrowser()) {
      setShowBrowserWarning(true);
    }
  }, []);

  const [systemStatus, setSystemStatus] = useState<SystemStatus>({ loading: true, error: null });

  useEffect(() => {
    if (!db) return;
    // Probe Firestore for status/quota
    const statusRef = doc(db, 'system', 'status');
    const unsubscribe = onSnapshot(statusRef, (docSnap) => {
      if (docSnap.exists()) {
        setSystemStatus({ ...docSnap.data(), loading: false, error: null } as SystemStatus);
      } else {
        setSystemStatus({ loading: false, error: null });
      }
    }, (err) => {
      console.error("System probe failed:", err);
      const isQuota = err.code === 'resource-exhausted' || err.message.toLowerCase().includes('quota exceeded');

      // Log legitimate errors to Sentry, but ignore expected quota issues
      if (!isQuota) {
        Sentry.captureException(err);
      }

      setSystemStatus({ loading: false, error: isQuota ? 'quota' : err.message });
    });
    return unsubscribe;
  }, []);

  const location = useLocation();

  if (MAINTENANCE_MODE || systemStatus.error === 'quota' || systemStatus.maintenance) {
    return (
      <SettingsProvider>
        <LanguageProvider>
          <SEOManager />
          <Maintenance isQuota={systemStatus.error === 'quota'} />
        </LanguageProvider>
      </SettingsProvider>
    );
  }
  const getAppClass = () => {
    const path = location.pathname;
    const pathParts = path.split('/');
    const firstPart = pathParts[1];

    // Determine the base path regardless of language prefix
    let base = path;
    if ((SUPPORTED_LANGUAGES as string[]).includes(firstPart)) {
      base = '/' + pathParts.slice(2).join('/');
    }

    // Normalize to handle trailing slashes
    if (base !== '/' && base.endsWith('/')) {
      base = base.slice(0, -1);
    }

    if (base === '' || base === '/') return 'App LandingPage';
    if (base === '/welcome') return 'App Welcome';
    if (base === '/login') return 'App LoginForm';
    if (base === '/signup') return 'App SignupForm';
    if (base === '/dashboard') return 'App Dashboard';
    return 'App';
  };

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

  const renderContent = () => {
    if (authLoading) {
      return (
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #FF919D 0%, #FFD1FF 100%)',
          color: 'white',
          fontFamily: "'Outfit', sans-serif"
        }}>
          <div className="loading-spinner-container" style={{
            width: '60px',
            height: '60px',
            border: '6px solid rgba(255,255,255,0.3)',
            borderTop: '6px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '1rem'
          }}></div>
          <style>{`
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          `}</style>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '600', animation: 'fadeIn 0.5s ease-in' }}>
            Scripture Habit
          </h2>
        </div>
      );
    }

    return (
      <div className={getAppClass()}>
        <Routes>
          {SUPPORTED_LANGUAGES.map(lang => (
            <Route key={lang} path={lang}>
              <Route
                index
                element={isStandalone ? <Navigate to="dashboard" replace /> : <LandingPage />}
              />
              <Route path="welcome" element={<Welcome />} />
              <Route path="login" element={<LoginForm />} />
              <Route path="signup" element={<SignupForm />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="group-form" element={<GroupForm />} />
              <Route path="join-group" element={<JoinGroup />} />

              <Route path="group-options" element={<GroupOptions />} />
              <Route path="group/:id" element={<GroupDetails group={null} />} />
              <Route path="forgot-password" element={<ForgotPassword />} />
              <Route path="join/:inviteCode" element={<InviteRedirect />} />
              <Route path="privacy" element={<PrivacyPolicy />} />
              <Route path="terms" element={<TermsOfService />} />
              <Route path="legal" element={<LegalDisclosure />} />
              {/* Catch-all for invalid paths within a language prefix */}
              <Route path="*" element={<Navigate to="" replace />} />
            </Route>
          ))}
          {/* Support root path and any prefix-less path by redirecting to detected lang */}
          <Route path="*" element={<LanguageRedirect location={location} />} />
        </Routes>
      </div>
    );
  };

  return (
    <SettingsProvider>
      <LanguageProvider>
        <SEOManager />
        <PWAUpdateHandler />
        {renderContent()}
        <ToastContainer position="top-right" autoClose={3000} />
        <Analytics />
        <SpeedInsights />
        <InstallPrompt />
        <CookieConsent />
        <BrowserWarningWrapper
          isOpen={showBrowserWarning}
          onClose={() => setShowBrowserWarning(false)}
        />
      </LanguageProvider>
    </SettingsProvider>
  );
};

interface LanguageRedirectProps {
  location: any;
}

const LanguageRedirect: React.FC<LanguageRedirectProps> = ({ location }) => {
  const { language } = useLanguage();
  const path = location.pathname;
  const pathParts = path.split('/');
  const firstPart = pathParts[1];

  // Exclude API routes and public assets from language redirection
  const excludedPaths = ['api', 'sw.js', 'manifest.json', 'images', 'favicon.ico', 'logo.svg'];
  if (SUPPORTED_LANGUAGES.includes(firstPart) || excludedPaths.includes(firstPart)) {
    return null;
  }

  // Otherwise, prefix with current detected language
  let newPath = `/${language}${path === '/' ? '/' : path}`;
  if (!newPath.endsWith('/')) {
    newPath += '/';
  }

  // Preserve query parameters
  if (location.search) {
    newPath += location.search;
  }

  return <Navigate to={newPath} replace state={location.state} />;
};

interface BrowserWarningWrapperProps {
  isOpen: boolean;
  onClose: () => void;
}

const BrowserWarningWrapper: React.FC<BrowserWarningWrapperProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  return (
    <BrowserWarningModal
      isOpen={isOpen}
      onClose={onClose}
      onContinue={onClose}
      t={t}
    />
  );
};

export default Sentry.withErrorBoundary(App, {
  fallback: ({ error, resetError }) => (
    <div className="App" style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      textAlign: 'center',
      background: 'linear-gradient(135deg, #f6f8fb 0%, #e9edf5 100%)'
    }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🙏</div>
      <h1 style={{ color: '#2d3748', marginBottom: '1rem' }}>Something went wrong</h1>
      <p style={{ color: '#4a5568', marginBottom: '2rem', maxWidth: '500px' }}>
        We apologize for the inconvenience. A report has been sent to our team, and we are working to fix this.
      </p>
      <button
        onClick={() => {
          resetError();
          window.location.href = '/dashboard';
        }}
        style={{
          padding: '0.8rem 2rem',
          background: 'linear-gradient(135deg, #FF919D 0%, #4a90e2 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(107, 70, 193, 0.2)'
        }}
      >
        Reload Application
      </button>
      {import.meta.env.MODE === 'development' && (
        <pre style={{
          marginTop: '2rem',
          textAlign: 'left',
          fontSize: '0.8rem',
          background: '#fff',
          padding: '1rem',
          borderRadius: '8px',
          maxWidth: '90%',
          overflow: 'auto',
          border: '1px solid #e2e8f0'
        }}>
          {(error as Error).toString()}
        </pre>
      )}
    </div>
  ),
});
