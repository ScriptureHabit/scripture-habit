
import React, { FC } from 'react';
import './login-form.css';
import Button from '../button/button';
import Input from '../input/input';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../hooks/use-language';
import { UilGoogle, UilGithub } from '@iconscout/react-unicons';
import Footer from '../footer/footer';
import { useLoginForm } from './hooks/use-login-form';

const LoginForm: FC = () => {
  const { t } = useLanguage();
  const {
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
    handleResendVerification
  } = useLoginForm();

  if (pendingGoogleUser) {
    return (
      <div className='App LoginForm'>
        <div className='AppGlass'>
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
    <div className='App LoginForm'>
      <main className='AppGlass'>
        <h2>{t('login.title')}</h2>

        <div className="browser-warning">
          {t('login.browserWarning')}
        </div>

        <button
          onClick={() => handleSocialLogin('google')}
          className="google-btn"
          type="button"
        >
          <UilGoogle size="20" />
          {t('login.googleButton')}
        </button>

        <button
          onClick={() => handleSocialLogin('github')}
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
            data-testid="login-email"
            label={t('login.emailLabel')}
            type="email"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEmail(e.target.value)}
            required
          />

          <Input
            data-testid="login-password"
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

          <Button type="submit" data-testid="login-submit">
            {t('login.submitButton')}
          </Button>
        </form>

        {/* Error message */}
        {error && (
          <div className='error-container' data-testid="login-error">
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
      </main>
      <Footer />
    </div>
  );
}

export default LoginForm;


