
import './login-form.css';
import Button from '../button/button';
import Input from '../input/input';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../hooks/use-language';
import { isEmulator } from '../../config/firebase-config';
import { UilGoogle, UilGithub } from '@iconscout/react-unicons';
import Footer from '../footer/footer';
import { useLoginForm } from './hooks/use-login-form';

const LoginForm = () => {
  const { t, language } = useLanguage();
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
    handleResendVerification,
    handleDevQuickLogin
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

        {isEmulator && import.meta.env.DEV && (
          <button
            type="button"
            onClick={handleDevQuickLogin}
            style={{
              width: '100%',
              padding: '0.65rem 1rem',
              marginTop: '0.75rem',
              borderRadius: '8px',
              border: '1px dashed #ec4899',
              backgroundColor: 'rgba(236, 72, 153, 0.08)',
              color: '#ec4899',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            ⚡ Dev Quick Login (demo-user)
          </button>
        )}

        <div className="separator">
          <span>OR</span>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Email input */}
          <Input
            id="login-email"
            data-testid="login-email"
            label={t('login.emailLabel')}
            type="email"
            name="email"
            placeholder={t('login.emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          {/* Password input */}
          <Input
            data-testid="login-password"
            label={t('login.passwordLabel')}
            type="password"
            name="password"
            placeholder={t('login.passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          <div className="forgot-password-container">
            <Link to={`/${language}/forgot-password`} className="forgot-password-link">
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
          <p>{t('login.noAccount')} <Link to={`/${language}/signup`} className="auth-link">{t('login.signupLink')}</Link></p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default LoginForm;


