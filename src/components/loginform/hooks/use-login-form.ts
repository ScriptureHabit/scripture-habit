import React, { useState } from 'react';
import { auth, db } from '../../../firebase';
import { signInWithEmailAndPassword, GoogleAuthProvider, GithubAuthProvider, signInWithPopup, sendEmailVerification, signOut, User, AuthError } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../../hooks/use-language';
import { toast } from 'react-toastify';
import apiClient from '../../../utils/api-client';
import axios from 'axios';

export function useLoginForm() {
  const { t, language } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingGoogleUser, setPendingGoogleUser] = useState<User | null>(null);
  const [unverifiedUser, setUnverifiedUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const handleSocialLogin = async (providerType: 'google' | 'github') => {
    try {
      console.log('[LoginForm] handleSocialLogin start', { providerType, language, state: location.state });
      const provider = providerType === 'google'
        ? new GoogleAuthProvider()
        : new GithubAuthProvider();

      const result = await signInWithPopup(auth!, provider);
      const user = result.user;

      console.log('[LoginForm] social login success', { uid: user.uid, email: user.email, emailVerified: user.emailVerified });

      const creationTime = new Date(user.metadata.creationTime || 0).getTime();
      const lastSignInTime = new Date(user.metadata.lastSignInTime || 0).getTime();
      const isBrandNewAuthUser = Math.abs(creationTime - lastSignInTime) < 5000;

      let userExists = false;
      try {
        await user.getIdToken(true);
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        userExists = userDoc.exists();
      } catch (docErr) {
        console.warn('[LoginForm] Firestore getDoc failed:', docErr);
        userExists = !isBrandNewAuthUser;
      }

      if (!userExists) {
        setPendingGoogleUser(user);
        setNickname(user.displayName || '');
      } else {
        const from = location.state?.from;
        if (from) {
          console.log('[LoginForm] navigate from location.state.from', { from });
          navigate(from);
        } else {
          console.log('[LoginForm] navigate to dashboard via social login', { target: `/${language}/dashboard` });
          navigate(`/${language}/dashboard`);
        }
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
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await apiClient.post('/api/auth/initialize-profile', {
        nickname: nickname || 'New User',
        timeZone: timeZone
      });

      const from = location.state?.from;
      if (from) {
        navigate(from);
      } else {
        navigate(`/${language}/dashboard`);
      }
    } catch (apiError: unknown) {
      console.error("Error initializing profile via API:", apiError);
      let message = t('signup.errorSaveProfile');
      if (axios.isAxiosError(apiError) && apiError.response?.data?.error) {
        message = apiError.response.data.error;
      }
      setError(message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUnverifiedUser(null);

    console.log('[LoginForm] handleSubmit start', { email, language, state: location.state });

    try {
      const userCredential = await signInWithEmailAndPassword(auth!, email, password);
      console.log('[LoginForm] email login success', { uid: userCredential.user.uid, emailVerified: userCredential.user.emailVerified });

      const isTestUser = !import.meta.env.PROD && userCredential.user.email?.endsWith('@example.com');
      if (!userCredential.user.emailVerified && !isTestUser) {
        setUnverifiedUser(userCredential.user);
        await signOut(auth!);
        setError(t('login.emailNotVerified'));
        return;
      }

      const from = location.state?.from;
      if (from) {
        console.log('[LoginForm] navigate from location.state.from', { from });
        navigate(from);
      } else {
        console.log('[LoginForm] navigate to dashboard after email login', { target: `/${language}/dashboard` });
        navigate(`/${language}/dashboard`);
      }
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

  const handleDevQuickLogin = async () => {
    if (!auth) return;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('sh_dev_signed_out');
      }
      await signInWithEmailAndPassword(auth, 'existing-user@example.com', 'password123');
      navigate(`/${language}/dashboard`);
    } catch (e) {
      console.error('Dev quick login failed:', e);
    }
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    nickname,
    setNickname,
    error,
    pendingGoogleUser,
    unverifiedUser,
    handleSocialLogin,
    handleCompleteGoogleSignup,
    handleSubmit,
    handleResendVerification,
    handleDevQuickLogin
  };
}
