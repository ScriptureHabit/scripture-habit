import React, { useState } from 'react';
import { auth, db } from '../../../firebase';
import { createUserWithEmailAndPassword, GoogleAuthProvider, GithubAuthProvider, signInWithPopup, sendEmailVerification, signOut, User, AuthError } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../../hooks/use-language';
import { toast } from 'react-toastify';
import apiClient from '../../../utils/api-client';
import axios from 'axios';

export function useSignupForm() {
  const { t, language } = useLanguage();
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingGoogleUser, setPendingGoogleUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const handleSocialSignup = async (providerType: 'google' | 'github') => {
    try {
      const provider = providerType === 'google'
        ? new GoogleAuthProvider()
        : new GithubAuthProvider();

      const result = await signInWithPopup(auth!, provider);
      const user = result.user;
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        setPendingGoogleUser(user);
        setNickname(user.displayName || '');
      } else {
        const from = location.state?.from;
        if (from) {
          navigate(from);
        } else {
          navigate(`/${language}/dashboard`);
        }
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

    try {
      const userCredential = await createUserWithEmailAndPassword(auth!, email, password);
      const user = userCredential.user;

      await sendEmailVerification(user);
      try {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        await apiClient.post('/api/auth/initialize-profile', {
          nickname: nickname,
          timeZone: timeZone
        });
      } catch (apiError: unknown) {
        console.error("Error initializing profile via API:", apiError);
        let message = t('signup.errorSaveProfile');
        if (axios.isAxiosError(apiError) && apiError.response?.data?.error) {
          message = apiError.response.data.error;
        }
        setError(message);
        return;
      }

      await signOut(auth!);
      toast.info(t('signup.verificationSent'));
      navigate(`/${language}/login`, { state: location.state });
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

  return {
    nickname,
    setNickname,
    email,
    setEmail,
    password,
    setPassword,
    error,
    pendingGoogleUser,
    handleSocialSignup,
    handleCompleteGoogleSignup,
    handleSubmit
  };
}
