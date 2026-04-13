
import React, { useState } from 'react';
import Button from '../button/Button';
import { auth, db } from '../../firebase';
import { createUserWithEmailAndPassword, GoogleAuthProvider, GithubAuthProvider, signInWithPopup, sendEmailVerification, signOut, signInWithCredential, AuthProvider, User, AuthError, UserCredential } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import Input from '../input/Input';
import './SignupForm.css'
import { useLanguage } from '../../hooks/useLanguage';
import { UilGoogle, UilGithub } from '@iconscout/react-unicons';
import { toast } from 'react-toastify';
import Footer from '../footer/Footer';

export default function SignupForm() {
  const { t, language } = useLanguage();
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingGoogleUser, setPendingGoogleUser] = useState<User | null>(null);
  const navigate = useNavigate();

  const handleSocialSignup = async (provider: AuthProvider) => {
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
        // Fallback for Github etc 
        result = await signInWithPopup(auth!, provider);
      }

      const user = result.user;

      // Check if user doc exists
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        // User needs to set nickname
        setPendingGoogleUser(user);
        setNickname(user.displayName || '');
      } else {
        // User exists, redirect to dashboard
        navigate(`/${language}/dashboard`);
      }

    } catch (err: unknown) {
      console.error("Error signing in with provider:", err);
      const error = err as AuthError;
      if (error.code === 'auth/account-exists-with-different-credential') {
        setError(t('signup.errorAccountExistsWithDifferentCredential'));
      } else if (error.code === 'auth/invalid-credential') {
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

      const isTestUser = pendingGoogleUser.email?.endsWith('@example.com');
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
        kickThreshold: 3,
        hasSetKickThreshold: isTestUser ? true : false,
        ...(isTestUser ? { hasSeenWelcomeStory: true } : {})
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

    try {
      const userCredential = await createUserWithEmailAndPassword(auth!, email, password);
      const user = userCredential.user;

      // Send verification email
      await sendEmailVerification(user);
      const now = Timestamp.now();
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const isTestUser = user.email?.endsWith('@example.com');
      const userData = {
        createdAt: now,
        email: user.email,
        groupId: "",
        joinedAt: now,
        lastPostDate: "",
        nickname: nickname,
        preferredCheckInTime: "00:00",
        streakCount: 0,
        totalNotes: 0,
        timeZone: timeZone,
        kickThreshold: 3,
        hasSetKickThreshold: isTestUser ? true : false,
        ...(isTestUser ? { hasSeenWelcomeStory: true } : {})
      };

      try {
        await setDoc(doc(db, 'users', user.uid), userData);
      } catch (firestoreError) {
        console.error("Error writing user data to Firestore:", firestoreError);
        setError(t('signup.errorSaveProfile'));
        return;
      }

      await signOut(auth!);
      toast.info(t('signup.verificationSent'));
      navigate(`/${language}/login`);

    } catch (err: unknown) {
      const authError = err as AuthError;
      console.error("Error creating user in Authentication:", authError);
      if (authError.code === 'auth/email-already-in-use') {
        setError(t('signup.errorEmailInUse'));
      } else if (authError.code === 'resource-exhausted' || authError.message?.toLowerCase().includes('quota exceeded')) {
        setError(t('systemErrors.quotaExceededMessage'));
      } else {
        setError(authError.message);
      }
    }
  };

  if (pendingGoogleUser) {
    return (
      <div className="App SignupForm">
        <div className='AppGlass Form'>
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
    <div className="App SignupForm">
      <div className='AppGlass Form'>
        <h2>{t('signup.title')}</h2>

        <div className="browser-warning">
          {t('signup.browserWarning')}
        </div>

        <button
          onClick={() => handleSocialSignup(new GoogleAuthProvider())}
          className="google-btn"
          type="button"
        >
          <UilGoogle size="20" />
          {t('signup.googleButton')}
        </button>
        <button
          onClick={() => handleSocialSignup(new GithubAuthProvider())}
          className="github-btn"
          type="button"
        >
          <UilGithub size="20" />
          {t('signup.githubButton')}
        </button>

        <div className="separator">
          <span>OR</span>
        </div>

        <form onSubmit={handleSubmit}>
          <Input
            data-testid="signup-nickname"
            label={t('signup.nicknameLabel')}
            type="text"
            value={nickname}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setNickname(e.target.value)}
            required
          />
          <Input
            data-testid="signup-email"
            label={t('signup.emailLabel')}
            type="email"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEmail(e.target.value)}
            required />
          <Input
            data-testid="signup-password"
            label={t('signup.passwordLabel')}
            type="password"
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setPassword(e.target.value)}
            required
          />
          <p className="form-note">{t('signup.spamWarning')}</p>
          <Button type="submit" data-testid="signup-submit">
            {t('signup.submitButton')}
          </Button>
        </form>
        {error && (
          <div className='error-container' data-testid="signup-error">
            <p className='error-message'>{error}</p>
          </div>
        )}

        <div className="auth-switch">
          <p>{t('signup.hasAccount')} <Link to="/login" className="auth-link">{t('signup.loginLink')}</Link></p>
        </div>
      </div>
      <Footer />
    </div>
  );
}


