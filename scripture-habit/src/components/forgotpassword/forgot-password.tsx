import { useState, FormEvent } from "react";
import "./forgot-password.css";
import Button from "../button/button";
import Input from "../input/input";
import { auth } from "../../firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { Link } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    try {
      if (!auth) throw new Error("Authentication service is not available.");
      await sendPasswordResetEmail(auth, email);
      setMessage(t('forgotPasswordPage.successMessage'));
    } catch (err: unknown) {
      const error = err as Error;
      setError(error?.message || "An error occurred");
    }
  };

  return (
    <div className="App ForgotPassword">
      <div className="AppGlass">
        <h2>{t('forgotPasswordPage.title')}</h2>

        <form onSubmit={handleReset}>
          <Input
            label={t('forgotPasswordPage.emailLabel')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Button type="submit">{t('forgotPasswordPage.submitButton')}</Button>
        </form>

        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}

        <div className="auth-switch">
          <Link to="/login" className="auth-link">{t('forgotPasswordPage.backToLogin')}</Link>
        </div>
      </div>
    </div>
  );
}
