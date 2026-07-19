import { Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./app.css";
import { lazy, Suspense, useEffect, useState, useRef } from 'react';
import { useApiWarmup } from './hooks/use-api-warmup';

import { ErrorFallback } from './components/common/error-fallback';
import { useQuery } from '@tanstack/react-query';
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { db, analytics } from './firebase';
import { logEvent } from 'firebase/analytics';
import { doc, getDoc } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';

import { useAuth } from './hooks/use-auth';
import { MAINTENANCE_MODE } from './config';
import * as Sentry from "@sentry/react";
import { handleInAppBrowserRedirect, isInAppBrowser } from './utils/browser-detection';
import { setupMessageListener, clearAllNotifications } from './utils/notification-helper';

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

// Helper to determine if a route is public (does not require auth)
const isPublicRoute = (urlStr: string) => {
  try {
    const url = new URL(urlStr, window.location.origin);
    const path = url.pathname;

    // Normalize path by removing language prefix if present (e.g. /ja/privacy -> /privacy)
    const pathParts = path.split('/');
    let cleanPath = path;
    const firstPart = pathParts[1];

    if (firstPart && (SUPPORTED_LANGUAGES as string[]).includes(firstPart)) {
      cleanPath = '/' + pathParts.slice(2).join('/');
    }

    // Normalize trailing slash
    if (cleanPath !== '/' && cleanPath.endsWith('/')) {
      cleanPath = cleanPath.slice(0, -1);
    }

    // Define public path patterns (supports '*' wildcard for directories)
    const publicPatterns = [
      '/',
      '/welcome',
      '/login',
      '/signup',
      '/forgot-password',
      '/privacy',
      '/terms',
      '/legal',
      '/join/*', // dynamic public invite link
    ];

    const matchPath = (currentPath: string, pattern: string) => {
      if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -1); // e.g. '/join/'
        return currentPath.startsWith(prefix);
      }
      return currentPath === pattern;
    };

    const isMatch = publicPatterns.some(pattern => matchPath(cleanPath, pattern)) || cleanPath === '';
    return isMatch;
  } catch {
    return true; // Fallback to safe routing
  }
};

const App: React.FC = () => {
  const { loading: authLoading, user } = useAuth();
  const [showBrowserWarning, setShowBrowserWarning] = useState(false);
  const [pendingNavigateUrl, setPendingNavigateUrlState] = useState<string | null>(null);
  const pendingUrlRef = useRef<string | null>(null);
  const lastNavigatedTimeRef = useRef<number>(0);
  const navigate = useNavigate();
  useApiWarmup();

  // Helper to set state and ref simultaneously
  const setPendingNavigateUrl = (url: string | null) => {
    pendingUrlRef.current = url;
    setPendingNavigateUrlState(url);
  };

  // 1. Listen for Service Worker navigation messages and buffer them in state
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleNavigation = (url: string) => {
        setPendingNavigateUrl(url);
      };

      const handleServiceWorkerMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'NAVIGATE') {
          const url = event.data.url;
          console.log('[App] Received NAVIGATE message from Service Worker:', url);
          handleNavigation(url);
        }
      };

      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

      // Check if there is a pending navigation from a push notification click (e.g. on cold start/reload)
      const checkPendingNotification = (controller: ServiceWorker) => {
        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = (event) => {
          if (event.data && event.data.type === 'NAVIGATE') {
            const url = event.data.url;
            console.log('[App] Received pending NAVIGATE from Service Worker:', url);
            handleNavigation(url);
          }
        };
        controller.postMessage(
          { type: 'CHECK_PENDING_NOTIFICATION' },
          [messageChannel.port2]
        );
      };

      const triggerPendingCheck = () => {
        // [Optimization] Avoid redundant IPC checks if navigation is already pending in state,
        // or if a navigation was executed very recently (e.g., within the last 2 seconds).
        // This mitigates the race condition where visibilitychange triggers immediately after focus.
        const now = Date.now();
        if (pendingUrlRef.current || (now - lastNavigatedTimeRef.current < 2000)) {
          console.log('[App] Skip CHECK_PENDING_NOTIFICATION: Navigation already active or recently handled');
          return;
        }
        if (navigator.serviceWorker.controller) {
          checkPendingNotification(navigator.serviceWorker.controller);
        }
      };

      if (navigator.serviceWorker.controller) {
        triggerPendingCheck();
      } else {
        const handleControllerChange = () => {
          if (navigator.serviceWorker.controller) {
            triggerPendingCheck();
          }
        };
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange, { once: true });
      }

      // Check for pending notifications when returning to the foreground (avoids OS throttling issues)
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          triggerPendingCheck();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, []);

  // 2. Reactively handle the buffered navigation target once Auth loading state settles
  useEffect(() => {
    if (!pendingNavigateUrl) return;

    // Normalize and compare route URLs by stripping tracking parameters (e.g. opened_from_push)
    const isSameRoute = (targetUrlStr: string) => {
      try {
        const currentUrl = new URL(window.location.href);
        const targetUrl = new URL(targetUrlStr, window.location.origin);
        
        if (currentUrl.pathname !== targetUrl.pathname) return false;
        
        const ignoreParams = ['opened_from_push'];
        const curParams = new URLSearchParams(currentUrl.search);
        const tarParams = new URLSearchParams(targetUrl.search);
        
        ignoreParams.forEach(p => {
          curParams.delete(p);
          tarParams.delete(p);
        });
        
        curParams.sort();
        tarParams.sort();
        return curParams.toString() === tarParams.toString();
      } catch {
        return false;
      }
    };

    if (authLoading) {
      console.log('[App] Auth is loading, buffering navigation target:', pendingNavigateUrl);
      return;
    }

    const targetUrl = pendingNavigateUrl;
    setPendingNavigateUrl(null); // Consume the pending URL

    if (isSameRoute(targetUrl)) {
      console.log('[App] Already on target URL, skipping duplicate navigation:', targetUrl);
      return;
    }

    // Only route to protected pages if authenticated; otherwise let public paths pass
    if (user || isPublicRoute(targetUrl)) {
      let cleanTargetUrl = targetUrl;
      try {
        const targetUrlObj = new URL(targetUrl, window.location.origin);
        if (targetUrlObj.searchParams.get('opened_from_push') === '1') {
          if (analytics) {
            logEvent(analytics, 'notification_opened', {
              source: 'pwa_push'
            });
            console.log('[Analytics] Logged notification_opened event in-flight');
          }
          targetUrlObj.searchParams.delete('opened_from_push');
          cleanTargetUrl = targetUrlObj.pathname + targetUrlObj.search + targetUrlObj.hash;
        }
      } catch (e) {
        console.warn('[App] Failed to parse targetUrl for analytics in-flight:', e);
      }

      console.log('[App] Navigating to notification target:', cleanTargetUrl);
      lastNavigatedTimeRef.current = Date.now();
      navigate(cleanTargetUrl);
    } else {
      console.log('[App] User is unauthenticated and target is protected. Skipping navigation:', targetUrl);
    }
  }, [pendingNavigateUrl, authLoading, user, navigate]);

  useEffect(() => {
    const isRedirecting = handleInAppBrowserRedirect();
    if (!isRedirecting && isInAppBrowser()) {
      setShowBrowserWarning(true);
    }

    // Clear notifications on initial load
    clearAllNotifications();

    // Clear notifications when app returns to foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        clearAllNotifications();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

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
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('opened_from_push') === '1') {
      if (analytics) {
        logEvent(analytics, 'notification_opened', {
          source: 'pwa_push'
        });
        console.log('[Analytics] Logged notification_opened event');
      }
      
      // Clean up the URL so it doesn't log again on refresh
      searchParams.delete('opened_from_push');
      const searchStr = searchParams.toString();
      const newUrl = location.pathname + (searchStr ? `?${searchStr}` : '') + location.hash;
      // Replace history using React Router to keep browser state synchronized
      navigate(newUrl, { replace: true });
    }
  }, [location.search, location.pathname, location.hash, navigate]);

  const isMaintenance = MAINTENANCE_MODE || (systemStatusError instanceof FirebaseError && systemStatusError.code === 'resource-exhausted') || systemStatus?.maintenance;

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
          <img src="/images/mascot.png" alt="Loading..." className="loader-mascot" width="80" height="80" />
          <div className="loader-bubble">
            <p className="loader-text">Loading...</p>
            <div className="loader-bubble-tail"></div>
          </div>
        </div>
      </div>
    );

    if (authLoading) return <MascotLoader />;

    if (isMaintenance) {
      return (
        <Suspense fallback={<MascotLoader />}>
          <Maintenance isQuota={systemStatusError instanceof FirebaseError && systemStatusError.code === 'resource-exhausted'} />
        </Suspense>
      );
    }

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

