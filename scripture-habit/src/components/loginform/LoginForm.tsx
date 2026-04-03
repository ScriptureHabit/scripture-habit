import React, { useState, FC } from 'react';
import './LoginForm.css';
import Button from '../Button/Button';
import Input from '../Input/Input';
import { auth, db } from '../../firebase';
import { signInWithEmailAndPassword, GoogleAuthProvider, GithubAuthProvider, signInWithPopup, sendEmailVerification, signInWithCredential, signOut, User, AuthProvider, AuthError, UserCredential } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../../Context/LanguageContext';
import { UilGoogle, UilGithub } from '@iconscout/react-unicons';
import { toast } from 'react-toastify';
import Footer from '../Footer/Footer';

const LoginForm: FC = () => {
  const { t, language } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingGoogleUser, setPendingGoogleUser] = useState<User | null>(null);
  const [unverifiedUser, setUnverifiedUser] = useState<User | null>(null);
  const navigate = useNavigate();


  const handleSocialLogin = async (provider: AuthProvider) => {
    try {
      let result: UserCredential;
      // Check if this is a Google login request
      if (provider instanceof GoogleAuthProvider) {
        try {
          // For native platforms (Android/iOS)
          if (Capacitor.isNativePlatform()) {
            await GoogleAuth.initialize({
              clientId: '346318604907-7su40hveemp8e6vi0b9hnqrhvvtpsb9j.apps.googleusercontent.com',
              scopes: ['profile', 'email'],
              grantOfflineAccess: true,
            });
            const googleUser = await GoogleAuth.signIn();
            const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
            result = await signInWithCredential(auth!, credential);
          } else {
            // For Web
            result = await signInWithPopup(auth!, provider);
          }
        } catch (e) {
          console.error("Native Google Auth failed, falling back to web popup:", e);
          // Fallback to web popup if native fails
          result = await signInWithPopup(auth!, provider);
        }
      } else {
        // Fallback for Github etc (which still might need special handling on native, but standard for now)
        result = await signInWithPopup(auth!, provider);
      }

      const user = result.user;

      // Check if user doc exists
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        // User needs to set nickname (Treat as signup)
        setPendingGoogleUser(user);
        setNickname(user.displayName || '');
      } else {
        navigate(`/${language}/dashboard`);
      }

    } catch (err: unknown) {
      console.error("Error signing in with provider:", err);
      const error = err as AuthError;
      if (error.code === 'auth/account-exists-with-different-credential') {
        setError(t('signup.errorAccountExistsWithDifferentCredential'));
      } else if (error.code === 'auth/invalid-credential' ||
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/wrong-password') {
        setError(t('login.errorInvalidCredential'));
      } else {
        setError(error.message);
      }
    }
  };

  const handleCompleteGoogleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingGoogleUser) return;

    try {
      const now = Timestamp.now();
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const userData = {
        createdAt: now,
        email: pendingGoogleUser.email,
        groupId: "",
        joinedAt: now,
        lastPostDate: "",
        nickname: nickname || 'New User',
        preferredCheckInTime: "00:00",
        streakCount: 0,
        totalNotes: 0,
        timeZone: timeZone,

      };

      await setDoc(doc(db, 'users', pendingGoogleUser.uid), userData);

      // Profile complete, redirect to dashboard
      navigate(`/${language}/dashboard`);

    } catch (firestoreError) {
      console.error("Error writing user data to Firestore:", firestoreError);
      setError(t('signup.errorSaveProfile'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUnverifiedUser(null);

    try {
      const userCredential = await signInWithEmailAndPassword(auth!, email, password);

      if (!userCredential.user.emailVerified) {
        setUnverifiedUser(userCredential.user);
        await signOut(auth!); // Sign out so the session isn't persisted for unverified user
        setError(t('login.emailNotVerified'));
        return;
      }

      navigate(`/${language}/dashboard`);
    } catch (err: unknown) {
      console.error("Error signing in with email/password:", err);
      const error = err as AuthError;
      if (error.code === 'auth/invalid-credential' ||
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/wrong-password') {
        setError(t('login.errorInvalidCredential'));
      } else if (error.code === 'resource-exhausted' || error.message?.toLowerCase().includes('quota exceeded')) {
        setError(t('systemErrors.quotaExceededMessage'));
      } else {
        setError(error.message);
      }
    }
  };

  const handleResendVerification = async () => {
    if (unverifiedUser) {
      try {
        await sendEmailVerification(unverifiedUser);
        toast.info(t('login.verificationResent'));
      } catch (err: unknown) {
        console.error("Error resending verification email:", err);
        const error = err as Error;
        setError("Error: " + error.message);
      }
    }
  };

  if (pendingGoogleUser) {
    return (
      <div className='App LoginForm'>
        <div className='AppGlass'>
          <h2>{t('signup.completeProfile')}</h2>
          <form onSubmit={handleCompleteGoogleSignup}>
            <Input
              label={t('signup.nicknameLabel')}
              type="text"
              value={nickname}
              onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setNickname(e.target.value)}
              required
            />
            <Button type="submit">
              {t('signup.finishSignup')}
            </Button>
          </form>
          {error && (
            <div className='error-container'>
              <p className='error-message'>{error}</p>
            </div>
          )}
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className='App LoginForm'>
      <div className='AppGlass'>
        <h2>{t('login.title')}</h2>

        <div className="browser-warning">
          {t('login.browserWarning')}
        </div>

        <button
          onClick={() => handleSocialLogin(new GoogleAuthProvider())}
          className="google-btn"
          type="button"
        >
          <UilGoogle size="20" />
          {t('login.googleButton')}
        </button>

        <button
          onClick={() => handleSocialLogin(new GithubAuthProvider())}
          className="github-btn"
          type="button"
        >
          <UilGithub size="20" />
          {t('login.githubButton')}
        </button>

        <div className="separator">
          <span>OR</span>
        </div>

        <form onSubmit={handleSubmit}>
          <Input
            label={t('login.emailLabel')}
            type="email"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEmail(e.target.value)}
            required
          />

          <Input
            label={t('login.passwordLabel')}
            type='password'
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setPassword(e.target.value)}
            required
          />

          <div className="forgot-password-container">
            <Link to="/forgot-password" className="forgot-password-link">
              {t('login.forgotPassword')}
            </Link>
          </div>

          <Button type="submit">
            {t('login.submitButton')}
          </Button>
        </form>

        {/* Error message */}
        {error && (
          <div className='error-container'>
            <p className='error-message'>{error}</p>
            {unverifiedUser && (
              <button
                type="button"
                onClick={handleResendVerification}
                className="resend-verification-btn"
              >
                {t('login.resendVerification')}
              </button>
            )}
          </div>
        )}

        <div className="auth-switch">
          <p>{t('login.noAccount')} <Link to="/signup" className="auth-link">{t('login.signupLink')}</Link></p>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default LoginForm;
