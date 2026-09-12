import React, { cloneElement, useCallback, useEffect, useRef, useState } from 'react';
import { authApi } from '../api.js';

const GOOGLE_SCRIPT_ID = 'google-identity-services';

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = GOOGLE_SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function AuthGate({ children }) {
  const buttonRef = useRef(null);
  const [state, setState] = useState({ loading: true, user: null, clientId: '', error: '' });

  const checkSession = useCallback(async () => {
    try {
      const { user } = await authApi.me();
      setState(current => ({ ...current, loading: false, user, error: '' }));
    } catch (error) {
      if (error.status !== 401) {
        setState(current => ({ ...current, loading: false, user: null, error: error.message }));
      } else {
        setState(current => ({ ...current, loading: false, user: null }));
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    authApi.config()
      .then(({ clientId }) => {
        if (cancelled) return;
        setState(current => ({ ...current, clientId }));
        return checkSession();
      })
      .catch(error => {
        if (!cancelled) {
          const missing = error.data?.missing?.join(', ');
          setState({
            loading: false,
            user: null,
            clientId: '',
            error: missing
              ? `La autenticación no está configurada. Revisa: ${missing}.`
              : 'No se pudo obtener la configuración de acceso.',
          });
        }
      });
    const requireLogin = () => setState(current => ({ ...current, user: null, loading: false }));
    window.addEventListener('auth-required', requireLogin);
    return () => {
      cancelled = true;
      window.removeEventListener('auth-required', requireLogin);
    };
  }, [checkSession]);

  useEffect(() => {
    if (state.loading || state.user || !state.clientId || !buttonRef.current) return;
    let cancelled = false;
    loadGoogleIdentity().then(() => {
      if (cancelled || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: state.clientId,
        callback: async ({ credential }) => {
          setState(current => ({ ...current, loading: true, error: '' }));
          try {
            const { user } = await authApi.login(credential);
            setState(current => ({ ...current, loading: false, user }));
          } catch (error) {
            const message = error.status === 403
              ? 'Tu cuenta de Google no está autorizada para acceder.'
              : 'No se pudo iniciar sesión con Google. Inténtalo de nuevo.';
            setState(current => ({ ...current, loading: false, user: null, error: message }));
          }
        },
      });
      buttonRef.current.replaceChildren();
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        width: 280,
      });
    }).catch(() => {
      if (!cancelled) setState(current => ({ ...current, error: 'No se pudo cargar el acceso de Google.' }));
    });
    return () => { cancelled = true; };
  }, [state.clientId, state.loading, state.user]);

  async function logout() {
    await authApi.logout().catch(() => {});
    window.google?.accounts?.id?.disableAutoSelect();
    setState(current => ({ ...current, user: null, error: '' }));
  }

  if (state.user) return cloneElement(children, { authUser: state.user, onLogout: logout });

  return (
    <main className="auth-page">
      <section className="auth-card" aria-live="polite">
        <div className="auth-mark">PM</div>
        <h1>Plan Maestro</h1>
        <p>Acceso restringido. Inicia sesión con una cuenta autorizada.</p>
        {state.error && <div className="auth-error" role="alert">{state.error}</div>}
        {state.loading ? <div className="auth-loading">Comprobando acceso…</div> : <div ref={buttonRef} className="google-signin" />}
      </section>
    </main>
  );
}
