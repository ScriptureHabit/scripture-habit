import { useNavigate } from 'react-router-dom';

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

export const ErrorFallback = ({ error, resetError }: ErrorFallbackProps) => {
  const navigate = useNavigate();

  return (
    <div className="App error-fallback-container">
      <div className="error-fallback-emoji">🙏</div>
      <h1 className="error-fallback-title">Something went wrong</h1>
      <p className="error-fallback-p">
        We apologize for the inconvenience. A report has been sent to our team, and we are working to fix this.
      </p>
      <button
        onClick={() => {
          resetError();
          navigate('/dashboard');
        }}
        className="error-fallback-button"
      >
        Reload Application
      </button>
      {import.meta.env.MODE === 'development' && (
        <pre className="error-fallback-pre">
          {error.toString()}
        </pre>
      )}
    </div>
  );
};
