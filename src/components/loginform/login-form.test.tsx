import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LoginForm from './login-form';

// Mock dependencies
vi.mock('../../hooks/use-language', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: 'en'
  })
}));

const mockUseLoginForm = vi.fn();
vi.mock('./hooks/use-login-form', () => ({
  useLoginForm: () => mockUseLoginForm()
}));

describe('LoginForm Accessibility & Rendering', () => {
  it('renders inputs with proper labels and autocomplete attributes', () => {
    mockUseLoginForm.mockReturnValue({
      email: '',
      setEmail: vi.fn(),
      password: '',
      setPassword: vi.fn(),
      nickname: '',
      setNickname: vi.fn(),
      error: null,
      pendingGoogleUser: null,
      unverifiedUser: false,
      handleSocialLogin: vi.fn(),
      handleCompleteGoogleSignup: vi.fn(),
      handleSubmit: vi.fn(),
      handleResendVerification: vi.fn(),
      handleDevQuickLogin: vi.fn()
    });

    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    );

    const emailInput = screen.getByTestId('login-email');
    expect(emailInput).toHaveAttribute('id', 'login-email');
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(emailInput).toHaveAttribute('autocomplete', 'email');

    const passwordInput = screen.getByTestId('login-password');
    expect(passwordInput).toHaveAttribute('id', 'login-password');
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
  });

  it('renders error message with role="alert" and aria-live="polite" when error exists', () => {
    mockUseLoginForm.mockReturnValue({
      email: 'test@example.com',
      setEmail: vi.fn(),
      password: 'password123',
      setPassword: vi.fn(),
      nickname: '',
      setNickname: vi.fn(),
      error: 'Invalid email or password',
      pendingGoogleUser: null,
      unverifiedUser: false,
      handleSocialLogin: vi.fn(),
      handleCompleteGoogleSignup: vi.fn(),
      handleSubmit: vi.fn(),
      handleResendVerification: vi.fn(),
      handleDevQuickLogin: vi.fn()
    });

    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    );

    const errorAlert = screen.getByRole('alert');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
  });
});
