import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";
import { useEffect, useState } from 'react';

const ErrorFallback = ({ error, resetError }: { error: Error; resetError: () => void }) => {
  const navigate = useNavigate();

  return (
    <div className="App error-fallback-container">
      <div className="error-fallback-emoji">🙏</div>
      <h1 className="error-fallback-title">Something went wrong</h1>
      <p className="error-fallback-p">
        We apologize for the inconvenience. A report has been sent to our team, and we are working to fix this.
      </p>
      <button
        onClick={() => {
          resetError();
          navigate('/dashboard');
        }}
        className="error-fallback-button"
      >
        Reload Application
      </button>
      {import.meta.env.MODE === 'development' && (
        <pre className="error-fallback-pre">
          {error.toString()}
        </pre>
      )}
    </div>
  );
};
import { useQuery } from '@tanstack/react-query';
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';

import SignupForm from './Components/SignupForm/SignupForm';
import LoginForm from './Components/LoginForm/LoginForm';
import Dashboard from './Components/Dashboard/Dashboard';
import { useAuth } from './Context/AuthContext';
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

import PrivacyPolicy from './Components/PrivacyPolicy/PrivacyPolicy';
import TermsOfService from './Components/TermsOfService/TermsOfService';
import LegalDisclosure from './Components/LegalDisclosure/LegalDisclosure';
import { LanguageProvider, SUPPORTED_LANGUAGES } from './Context/LanguageContext';
import { SettingsProvider } from './Context/SettingsContext';
import SEOManager from './Components/SEOManager';
import PWAUpdateHandler from './Components/PWAUpdateHandler/PWAUpdateHandler';
import LanguageRedirect from './Components/LanguageRedirect/LanguageRedirect';
import BrowserWarningWrapper from './Components/BrowserWarningModal/BrowserWarningWrapper';

declare global {
  interface Navigator {
    standalone?: boolean;
  }
}

interface SystemStatus {
  loading: boolean;
  error: string | null;
  maintenance?: boolean;
}

const App: React.FC = () => {
  const { loading: authLoading } = useAuth();
  const [showBrowserWarning, setShowBrowserWarning] = useState(false);

  useEffect(() => {
    const isRedirecting = handleInAppBrowserRedirect();
    if (!isRedirecting && isInAppBrowser()) {
      setShowBrowserWarning(true);
    }
  }, []);

  const { data: systemStatus, error: systemStatusError } = useQuery<SystemStatus>({
    queryKey: ['system', 'status'],
    queryFn: async () => {
      if (!db) throw new Error("Firestore not initialized");

      const statusRef = doc(db, 'system', 'status');
      const docSnap = await getDoc(statusRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as SystemStatus;
        return data;
      }
      return { loading: false, error: null };
    },
    enabled: !!db,
    staleTime: 1000 * 60 * 30, // 30 mins memory cache
    throwOnError: (err: unknown) => {
      // Suppress permission-denied errors to prevent full app crashes
      if (err instanceof FirebaseError) {
        const isQuota = err.code === 'resource-exhausted' || err.message?.toLowerCase().includes('quota exceeded');
        if (err.code !== 'permission-denied' && !isQuota) {
          console.error("System probe failed:", err);
          Sentry.captureException(err);
        }
      } else if (err instanceof Error) {
        console.error("System probe failed:", err);
        Sentry.captureException(err);
      } else {
        console.error("System probe failed with unknown error:", err);
        Sentry.captureException(new Error(String(err)));
      }
      return false; // Don't trigger error boundary for these
    }
  });

  const location = useLocation();

  const isMaintenance = MAINTENANCE_MODE || (systemStatusError instanceof FirebaseError && systemStatusError.code === 'resource-exhausted') || systemStatus?.maintenance;
  if (isMaintenance) {
    return (
      <SettingsProvider>
        <LanguageProvider>
          <SEOManager />
          <Maintenance isQuota={systemStatusError instanceof FirebaseError && systemStatusError.code === 'resource-exhausted'} />
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

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || !!window.navigator.standalone;

  const renderContent = () => {
    if (authLoading) {
      return (
        <div className="auth-loading-screen">
          <div className="loading-spinner-container"></div>
          <h2 className="auth-loading-text">
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

export default Sentry.withErrorBoundary(App, {
  fallback: ({ error, resetError }) => (
    <ErrorFallback error={error as Error} resetError={resetError} />
  ),
});
