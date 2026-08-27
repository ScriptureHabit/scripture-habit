
import React from 'react';
import Button from '../button/button';
import { Link } from 'react-router-dom';
import Input from '../input/input';
import './signup-form.css';
import { useLanguage } from '../../hooks/use-language';
import { UilGoogle, UilGithub } from '@iconscout/react-unicons';
import Footer from '../footer/footer';
import { useSignupForm } from './hooks/use-signup-form';
import { useApiWarmupOnMount } from '../../utils/api-warmup';

export default function SignupForm() {
  useApiWarmupOnMount();
  const { t, language } = useLanguage();
  const {
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
  } = useSignupForm();

  if (pendingGoogleUser) {
    return (
      <div className="App SignupForm">
        <div className='AppGlass Form'>
          <h2>{t('signup.completeProfile')}</h2>
          <form onSubmit={handleCompleteGoogleSignup}>
            <Input
              data-testid="complete-nickname"
              label={t('signup.nicknameLabel')}
              type="text"
              value={nickname}
              onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setNickname(e.target.value)}
              required
              maxLength={30}
            />
            <Button type="submit" data-testid="complete-submit">
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
      <main className='AppGlass Form'>
        <h2>{t('signup.title')}</h2>

        <div className="browser-warning">
          {t('signup.browserWarning')}
        </div>

        <button
          onClick={() => handleSocialSignup('google')}
          className="google-btn"
          type="button"
        >
          <UilGoogle size="20" />
          {t('signup.googleButton')}
        </button>
        <button
          onClick={() => handleSocialSignup('github')}
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
            id="signup-nickname"
            name="nickname"
            autoComplete="nickname"
            data-testid="signup-nickname"
            label={t('signup.nicknameLabel')}
            type="text"
            value={nickname}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setNickname(e.target.value)}
            required
            maxLength={30}
          />
          <Input
            id="signup-email"
            name="email"
            autoComplete="email"
            data-testid="signup-email"
            label={t('signup.emailLabel')}
            type="email"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEmail(e.target.value)}
            required />
          <Input
            id="signup-password"
            name="password"
            autoComplete="new-password"
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
          <p>{t('signup.hasAccount')} <Link to={`/${language}/login`} className="auth-link">{t('signup.loginLink')}</Link></p>
        </div>
      </main>
      <Footer />
    </div>
  );
}


