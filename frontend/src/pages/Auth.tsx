import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import logo from '../assets/GG Logo Transparent.png';
import './Auth.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Auth = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [orgId, setOrgId] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // db.ts's apiFetch sets this when a 401 clears an expired/invalid token
  // and bounces here — show it once, then clear it so it doesn't reappear.
  useEffect(() => {
    const authMessage = sessionStorage.getItem('auth_message');
    if (authMessage) {
      setError(authMessage);
      sessionStorage.removeItem('auth_message');
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (!email || !password) {
      setError('Please fill in all fields.');
      setLoading(false);
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    if (isSignUp && !orgId.trim()) {
      setError('Organization Code / ID is required.');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        const res = await fetch(`${API_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            organisation_id: orgId.trim(),
          }),
        });

        let data: any = {};
        try { data = await res.json(); } catch { /* non-JSON body — keep empty object */ }
        if (!res.ok) throw new Error(data.error || `Registration failed (HTTP ${res.status}).`);

        // Automatically log the user in
        login(data.token, data.user);
      } else {
        const res = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        let data: any = {};
        try { data = await res.json(); } catch { /* non-JSON body — keep empty object */ }
        if (!res.ok) throw new Error(data.error || `Login failed (HTTP ${res.status}).`);

        login(data.token, data.user);
      }
    } catch (err: any) {
      console.error('Authentication error:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (toSignUp: boolean) => {
    setIsSignUp(toSignUp);
    setError(null);
    setMessage(null);
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-background-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>
      <div className="auth-card">
        <div className="auth-brand">
          <img src={logo} alt="Green Generation Logo" className="auth-logo" />
          <h1 className="auth-title">Green Generation</h1>
          <p className="auth-subtitle">ESG Project Management Portal</p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${!isSignUp ? 'active' : ''}`}
            onClick={() => switchTab(false)}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${isSignUp ? 'active' : ''}`}
            onClick={() => switchTab(true)}
          >
            Register
          </button>
        </div>

        {/* Inputs intentionally have no `required` attribute — native browser
            validation would block the submit handler before handleAuth's own
            checks ever ran, replacing this form's styled error alerts with an
            inconsistent native tooltip. */}
        <form onSubmit={handleAuth} className="auth-form">
          {error && <div className="auth-alert auth-alert-error">{error}</div>}
          {message && <div className="auth-alert auth-alert-success">{message}</div>}

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="auth-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="auth-input"
            />
          </div>

          {isSignUp && (
            <>
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="auth-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="orgId">Organization Code / ID</label>
                <input
                  type="text"
                  id="orgId"
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                  placeholder="Enter organization UUID"
                  className="auth-input"
                />
              </div>
            </>
          )}

          <button type="submit" disabled={loading} className="auth-submit-btn">
            {loading ? (
              <span className="spinner"></span>
            ) : isSignUp ? (
              'Create Account'
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            {isSignUp ? (
              <>
                Already have an account?{' '}
                <button type="button" className="auth-link" onClick={() => switchTab(false)}>
                  Sign In
                </button>
              </>
            ) : (
              <>
                New to Green Generation?{' '}
                <button type="button" className="auth-link" onClick={() => switchTab(true)}>
                  Create an account
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
