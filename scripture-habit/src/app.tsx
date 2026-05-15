import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./app.css";
import { lazy, Suspense, useEffect, useState } from 'react';
import { useApiWarmup } from './hooks/use-api-warmup';

import { ErrorFallback } from './components/common/error-fallback';
import { useQuery } from '@tanstack/react-query';
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';

import { useAuth } from './hooks/use-auth';
import { MAINTENANCE_MODE } from './config';
import * as Sentry from "@sentry/react";
import { handleInAppBrowserRedirect, isInAppBrowser } from './utils/browser-detection';
import { setupMessageListener } from './utils/notification-helper';

import { LanguageProvider } from './context/language-provider';
import { SUPPORTED_LANGUAGES } from './config/languages';
import { SettingsProvider } from './context/settings-context';
import SEOManager from './components/seo-manager';
import PWAUpdateHandler from './components/pwaupdatehandler/pwa-update-handler';
import LanguageRedirect from './components/languageredirect/language-redirect';
import BrowserWarningWrapper from './components/browserwarningmodal/browser-warning-wrapper';

// Lazy load components
const SignupForm = lazy(() => import('./components/signupform/signup-form'));
const LoginForm = lazy(() => import('./components/loginform/login-form'));
const Dashboard = lazy(() => import('./components/dashboard/dashboard'));
const GroupForm = lazy(() => import('./components/groupform/group-form'));
const JoinGroup = lazy(() => import('./components/joingroup/join-group'));
const GroupDetails = lazy(() => import('./components/groupdetails/group-details'));
const GroupOptions = lazy(() => import('./components/groupoptions/group-options'));
const LandingPage = lazy(() => import('./components/landingpage/landing-page'));
const Welcome = lazy(() => import('./components/welcome/welcome'));
const ForgotPassword = lazy(() => import('./components/forgotpassword/forgot-password'));
const InviteRedirect = lazy(() => import('./components/inviteredirect/invite-redirect'));
const Maintenance = lazy(() => import('./components/maintenance/maintenance'));
const InstallPrompt = lazy(() => import('./components/installprompt/install-prompt'));
const CookieConsent = lazy(() => import('./components/cookieconsent/cookie-consent'));
const PrivacyPolicy = lazy(() => import('./components/privacypolicy/privacy-policy'));
const TermsOfService = lazy(() => import('./components/termsofservice/terms-of-service'));
const LegalDisclosure = lazy(() => import('./components/legaldisclosure/legal-disclosure'));


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

    // Setup foreground notifications
    const unsubscribe = setupMessageListener((payload) => {
      const title = payload.data?.title || payload.notification?.title || 'Notification';
      const body = payload.data?.body || payload.notification?.body || '';
      if (body) {
        toast.info(`${title}: ${body}`, { autoClose: 5000 });
      } else {
        toast.info(title, { autoClose: 5000 });
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
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
    if (base === '/dashboard' || base === '/profile') return 'App Dashboard';
    return 'App';
  };

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || !!navigator.standalone;

  const renderContent = () => {
    // If auth is still determining, show nothing or a very light shell
    // This avoids the flicker of the landing page before redirecting to dashboard
    const MascotLoader = () => (
      <div className="App">
        <div className="AppGlass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
          <img src="/images/mascot.png" alt="Loading..." className="loader-mascot" />
          <div className="loader-bubble">
            <p className="loader-text">Loading...</p>
            <div className="loader-bubble-tail"></div>
          </div>
        </div>
      </div>
    );

    if (authLoading) return <MascotLoader />;

    return (
      <div className={getAppClass()}>
        <Suspense fallback={<MascotLoader />}>
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
                <Route path="profile" element={<Dashboard />} />
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
        </Suspense>
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

