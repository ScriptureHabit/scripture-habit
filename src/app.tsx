import { Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import "./app.css";
import { Suspense, useEffect, useState, useRef } from 'react';

import { useQuery } from '@tanstack/react-query';
import { db, logFirebaseEvent } from './firebase';
import { FirebaseError } from 'firebase/app';

import { useAuth } from './hooks/use-auth';
import { MAINTENANCE_MODE } from './config';
import { handleInAppBrowserRedirect, isInAppBrowser } from './utils/browser-detection';
import { setupMessageListener, clearAllNotifications } from './utils/notification-helper';

import { LanguageProvider } from './context/language-provider';
import { SUPPORTED_LANGUAGES } from './config/languages';
import { SettingsProvider } from './context/settings-context';
import SEOManager from './components/seo-manager';
import PWAUpdateHandler from './components/pwaupdatehandler/pwa-update-handler';
import LanguageRedirect from './components/languageredirect/language-redirect';
import BrowserWarningWrapper from './components/browserwarningmodal/browser-warning-wrapper';

import { lazyWithRetry } from './utils/lazy-with-retry';

import LandingPage from './components/landingpage/landing-page';

import { shouldPrefetch, prefetchComponent } from './utils/prefetch';
import { requestCanceler } from './utils/request-canceler';

// Dynamic component loaders (centralized to prevent path duplication across lazy loading & prefetching)
const componentLoaders = {
  SignupForm: () => import('./components/signupform/signup-form'),
  LoginForm: () => import('./components/loginform/login-form'),
  Dashboard: () => import('./components/dashboard/dashboard'),
  GroupForm: () => import('./components/groupform/group-form'),
  JoinGroup: () => import('./components/joingroup/join-group'),
  GroupDetails: () => import('./components/groupdetails/group-details'),
  GroupOptions: () => import('./components/groupoptions/group-options'),
  Welcome: () => import('./components/welcome/welcome'),
  ForgotPassword: () => import('./components/forgotpassword/forgot-password'),
  InviteRedirect: () => import('./components/inviteredirect/invite-redirect'),
  Maintenance: () => import('./components/maintenance/maintenance'),
  InstallPrompt: () => import('./components/installprompt/install-prompt'),
  CookieConsent: () => import('./components/cookieconsent/cookie-consent'),
  PrivacyPolicy: () => import('./components/privacypolicy/privacy-policy'),
  TermsOfService: () => import('./components/termsofservice/terms-of-service'),
  LegalDisclosure: () => import('./components/legaldisclosure/legal-disclosure'),
  DemoLogin: () => import('./components/demo/demo-login'),
  ToastContainer: () => import('react-toastify').then(m => ({ default: m.ToastContainer })),
};

// Lazy load components with retry resiliency
const SignupForm = lazyWithRetry(componentLoaders.SignupForm);
const LoginForm = lazyWithRetry(componentLoaders.LoginForm);
const Dashboard = lazyWithRetry(componentLoaders.Dashboard);
const GroupForm = lazyWithRetry(componentLoaders.GroupForm);
const JoinGroup = lazyWithRetry(componentLoaders.JoinGroup);
const GroupDetails = lazyWithRetry(componentLoaders.GroupDetails);
const GroupOptions = lazyWithRetry(componentLoaders.GroupOptions);
const Welcome = lazyWithRetry(componentLoaders.Welcome);
const ForgotPassword = lazyWithRetry(componentLoaders.ForgotPassword);
const InviteRedirect = lazyWithRetry(componentLoaders.InviteRedirect);
const Maintenance = lazyWithRetry(componentLoaders.Maintenance);
const InstallPrompt = lazyWithRetry(componentLoaders.InstallPrompt);
const CookieConsent = lazyWithRetry(componentLoaders.CookieConsent);
const PrivacyPolicy = lazyWithRetry(componentLoaders.PrivacyPolicy);
const TermsOfService = lazyWithRetry(componentLoaders.TermsOfService);
const LegalDisclosure = lazyWithRetry(componentLoaders.LegalDisclosure);
const DemoLogin = lazyWithRetry(componentLoaders.DemoLogin);
const LazyToastContainer = lazyWithRetry(componentLoaders.ToastContainer);

// Route-aware prefetching: start downloading destination bundle in background AFTER initial interaction/idle
const prefetchDestinationRoute = () => {
  if (typeof window === 'undefined' || !shouldPrefetch()) return;
  const path = window.location.pathname.toLowerCase();

  const prefetchRules = [
    { match: (p: string) => p.includes('/dashboard') || p.includes('/profile'), key: 'Dashboard', load: componentLoaders.Dashboard },
    { match: (p: string) => p.includes('/login'), key: 'LoginForm', load: componentLoaders.LoginForm },
    { match: (p: string) => p.includes('/welcome'), key: 'Welcome', load: componentLoaders.Welcome },
  ];

  const target = prefetchRules.find(rule => rule.match(path));
  if (target) {
    prefetchComponent(target.key, target.load);
  }
};

// Defer prefetching strictly to idle (min 6s) to avoid competing with Lighthouse FCP/TBT
if (typeof window !== 'undefined') {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => { prefetchDestinationRoute(); }, { timeout: 8000 });
  } else {
    setTimeout(prefetchDestinationRoute, 6000);
  }
}


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
      '/demo',
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

const App = () => {
  const { loading: authLoading, user } = useAuth();
  const [showBrowserWarning, setShowBrowserWarning] = useState(false);
  const [pendingNavigateUrl, setPendingNavigateUrlState] = useState<string | null>(null);
  const pendingUrlRef = useRef<string | null>(null);
  const lastNavigatedTimeRef = useRef<number>(0);
  const navigate = useNavigate();
  const location = useLocation();

  // Cancel any in-flight GET requests when navigating between routes
  useEffect(() => {
    requestCanceler.cancelPendingGetRequests();
  }, [location.pathname]);

  // Helper to set state and ref simultaneously
  const setPendingNavigateUrl = (url: string | null) => {
    pendingUrlRef.current = url;
    setPendingNavigateUrlState(url);
  };

  // Load Toastify CSS asynchronously so it does not block critical path initial render
  useEffect(() => {
    import("react-toastify/dist/ReactToastify.css");
  }, []);

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
    queueMicrotask(() => {
      setPendingNavigateUrl(null); // Consume the pending URL
    });

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
          void logFirebaseEvent('notification_opened', { source: 'pwa_push' });
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
      queueMicrotask(() => {
        setShowBrowserWarning(true);
      });
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

    if (!user) return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };

    // Setup foreground notifications (only when logged in)
    const unsubscribe = setupMessageListener(async (payload) => {
      const title = payload.data?.title || payload.notification?.title || 'Notification';
      const body = payload.data?.body || payload.notification?.body || '';
      const { toast } = await import('react-toastify');
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
  }, [user]);

  const { data: systemStatus, error: systemStatusError } = useQuery<SystemStatus>({
    queryKey: ['system', 'status'],
    queryFn: async () => {
      if (!db) return { loading: false, error: null };

      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const statusRef = doc(db, 'system', 'status');
        const docSnap = await getDoc(statusRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as SystemStatus;
          return data;
        }
        return { loading: false, error: null };
      } catch (err: unknown) {
        const errObj = err as { code?: string; message?: string };
        const isOffline = errObj?.code === 'unavailable' ||
          errObj?.message?.toLowerCase().includes('offline') ||
          errObj?.message?.toLowerCase().includes('failed to fetch');
        if (isOffline) {
          return { loading: false, error: null };
        }
        throw err;
      }
    },
    enabled: !!db && !!user,
    staleTime: 1000 * 60 * 30, // 30 mins memory cache
    retry: (failureCount, error) => {
      const errObj = error as { code?: string; message?: string };
      const isOffline = errObj?.code === 'unavailable' || errObj?.message?.toLowerCase().includes('offline');
      if (isOffline) return false;
      return failureCount < 2;
    },
    throwOnError: (err: unknown) => {
      // Suppress permission-denied, quota, and offline/unavailable errors to prevent noise and crashes
      const errObj = err as { code?: string; message?: string };
      const isQuota = errObj?.code === 'resource-exhausted' || errObj?.message?.toLowerCase().includes('quota exceeded');
      const isOffline = errObj?.code === 'unavailable' || errObj?.message?.toLowerCase().includes('offline') || errObj?.message?.toLowerCase().includes('failed to fetch');
      const isPermissionDenied = errObj?.code === 'permission-denied' || errObj?.message?.toLowerCase().includes('permission-denied');

      if (!isPermissionDenied && !isQuota && !isOffline) {
        console.error("System probe failed:", err);
        if (err instanceof Error) {
          reportException(err);
        } else {
          reportException(new Error(String(err)));
        }
      }
      return false; // Don't trigger error boundary for these
    }
  });

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('opened_from_push') === '1') {
      void logFirebaseEvent('notification_opened', { source: 'pwa_push' });

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
    if (base === '/demo') return 'App DemoLogin';
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
          <img src="/images/mascot-96.webp" alt="Loading..." className="loader-mascot" width="80" height="80" />
          <div className="loader-bubble">
            <p className="loader-text">Loading...</p>
            <div className="loader-bubble-tail"></div>
          </div>
        </div>
      </div>
    );

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
                <Route path="demo" element={<DemoLogin />} />
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
        <Suspense fallback={null}>
          <LazyToastContainer position="top-right" autoClose={3000} />
          <InstallPrompt />
          <CookieConsent />
          <BrowserWarningWrapper
            isOpen={showBrowserWarning}
            onClose={() => setShowBrowserWarning(false)}
          />
        </Suspense>
      </LanguageProvider>
    </SettingsProvider>
  );
};

const reportException = (error: Error) => {
  const sentry = (window as typeof window & { Sentry?: { captureException?: (value: Error) => void } }).Sentry;
  sentry?.captureException?.(error);
};

export default App;

