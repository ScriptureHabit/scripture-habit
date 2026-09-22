import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SignupForm from '../signup-form';
import * as useSignupFormModule from '../hooks/use-signup-form';

vi.mock('../../../hooks/use-language', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: 'en'
  })
}));

vi.mock('../../../utils/api-warmup', () => ({
  useApiWarmupOnMount: vi.fn()
}));

describe('SignupForm', () => {
  const defaultHookReturn = {
    nickname: '',
    setNickname: vi.fn(),
    email: '',
    setEmail: vi.fn(),
    password: '',
    setPassword: vi.fn(),
    error: '',
    pendingGoogleUser: null,
    handleSocialSignup: vi.fn(),
    handleCompleteGoogleSignup: vi.fn(),
    handleSubmit: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form inputs correctly with accessibility labels and IDs', () => {
    vi.spyOn(useSignupFormModule, 'useSignupForm').mockReturnValue(defaultHookReturn);

    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    );

    expect(screen.getByTestId('signup-nickname')).toBeInTheDocument();
    expect(screen.getByTestId('signup-email')).toBeInTheDocument();
    expect(screen.getByTestId('signup-password')).toBeInTheDocument();
  });

  it('renders error message with role="alert" and aria-live="polite"', () => {
    vi.spyOn(useSignupFormModule, 'useSignupForm').mockReturnValue({
      ...defaultHookReturn,
      error: 'Registration failed. Email in use.'
    });

    render(
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    );

    const alertElement = screen.getByRole('alert');
    expect(alertElement).toBeInTheDocument();
    expect(alertElement).toHaveAttribute('aria-live', 'polite');
    expect(alertElement).toHaveTextContent('Registration failed. Email in use.');
  });
});
