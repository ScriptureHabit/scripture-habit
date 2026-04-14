import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";
import { useEffect, useState } from 'react';
import { useApiWarmup } from './hooks/useApiWarmup';

import { ErrorFallback } from './components/common/error-fallback';
import { useQuery } from '@tanstack/react-query';
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';

import SignupForm from './components/signupform/signup-form';
import LoginForm from './components/loginform/login-form';
import Dashboard from './components/dashboard/dashboard';
import { useAuth } from './hooks/useAuth';

import GroupForm from './components/groupform/group-form';
import JoinGroup from './components/joingroup/join-group';
import GroupDetails from "./components/groupdetails/group-details";
import GroupOptions from './components/groupoptions/group-options';
import LandingPage from './components/landingpage/landing-page';
import Welcome from './components/welcome/welcome';
import ForgotPassword from "./components/forgotpassword/forgot-password";
import InviteRedirect from './components/inviteredirect/invite-redirect';
import Maintenance from './components/maintenance/maintenance';
import { MAINTENANCE_MODE } from './config';
import * as Sentry from "@sentry/react";
import InstallPrompt from './components/installprompt/install-prompt';
import { handleInAppBrowserRedirect, isInAppBrowser } from './utils/browserDetection';
import CookieConsent from './components/cookieconsent/cookie-consent';

import PrivacyPolicy from './components/privacypolicy/privacy-policy';
import TermsOfService from './components/termsofservice/terms-of-service';
import LegalDisclosure from './components/legaldisclosure/legal-disclosure';
import { LanguageProvider } from './context/LanguageProvider';
import { SUPPORTED_LANGUAGES } from './config/languages';
import { SettingsProvider } from './context/SettingsContext';
import SEOManager from './components/SEOManager';
import PWAUpdateHandler from './components/pwaupdatehandler/pwa-update-handler';
import LanguageRedirect from './components/languageredirect/language-redirect';
import BrowserWarningWrapper from './components/browserwarningmodal/browser-warning-wrapper';

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
  useApiWarmup();

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

const AppWithErrorBoundary = Sentry.withErrorBoundary(App, {
  fallback: ({ error, resetError }) => (
    <ErrorFallback error={error as Error} resetError={resetError} />
  ),
});

AppWithErrorBoundary.displayName = 'AppWithErrorBoundary';

export default AppWithErrorBoundary;

