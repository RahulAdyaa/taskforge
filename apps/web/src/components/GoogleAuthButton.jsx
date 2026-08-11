import React from 'react';
import { useGoogleLogin, GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';

const formatGoogleError = (err) => {
  if (!err) return 'Authentication canceled';
  if (typeof err === 'string') return err;
  
  // 1. Axios API Response errors
  if (err.response?.data?.error) {
    return typeof err.response.data.error === 'string' 
      ? err.response.data.error 
      : JSON.stringify(err.response.data.error);
  }
  if (err.response?.data?.message) {
    return typeof err.response.data.message === 'string' 
      ? err.response.data.message 
      : JSON.stringify(err.response.data.message);
  }

  // 2. Google OAuth specific error objects
  if (err.error_description) return String(err.error_description);
  
  if (err.error) {
    if (typeof err.error === 'string') {
      if (err.error === 'popup_closed_by_user') return 'Sign-in window closed before completion.';
      if (err.error === 'access_denied') return 'Permission denied by user.';
      if (err.error === 'idpiframe_initialization_failed' || err.error === 'origin_mismatch') {
        return 'Domain origin mismatch: taskforge-sepia-one.vercel.app is not added to Google Cloud Console Authorized Origins.';
      }
      return err.error;
    }
    if (err.error?.message) return String(err.error.message);
    if (err.error?.error) return String(err.error.error);
  }

  if (err.details) {
    return typeof err.details === 'string' ? err.details : JSON.stringify(err.details);
  }

  // 3. JavaScript Error instance (.message)
  if (err.message && typeof err.message === 'string' && err.message !== '[object Object]') {
    return err.message;
  }

  // 4. Safe string conversion
  try {
    const str = String(err);
    if (str && str !== '[object Object]') return str;
  } catch (e) {}

  return 'Google Sign-In failed. Ensure taskforge-sepia-one.vercel.app is whitelisted in Google Cloud Console.';
};

export default function GoogleAuthButton() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // 1. OAuth Token handler
  const handleTokenSuccess = async (tokenResponse) => {
    try {
      const { data } = await api.post('/auth/google', {
        accessToken: tokenResponse.access_token,
      });
      setAuth(data.user, data.accessToken);
      toast.success('Google clearance granted.');
      navigate('/app');
    } catch (error) {
      toast.error(`Google Login: ${formatGoogleError(error)}`);
    }
  };

  // 2. ID Token handler for standard button
  const handleCredentialSuccess = async (credentialResponse) => {
    try {
      const { data } = await api.post('/auth/google', {
        token: credentialResponse.credential,
      });
      setAuth(data.user, data.accessToken);
      toast.success('Google clearance granted.');
      navigate('/app');
    } catch (error) {
      toast.error(`Google Login: ${formatGoogleError(error)}`);
    }
  };

  const handleCustomPopupLogin = useGoogleLogin({
    onSuccess: handleTokenSuccess,
    onError: (errorResponse) => {
      console.warn('Google popup error:', errorResponse);
      toast.error(`Google Login: ${formatGoogleError(errorResponse)}`);
    },
  });

  return (
    <div className="w-full flex flex-col items-center justify-center space-y-2">
      {!clientId || clientId.includes('YOUR_GOOGLE_CLIENT_ID') ? (
        <p className="text-xs font-mono text-signal-red text-center">
          VITE_GOOGLE_CLIENT_ID missing in Vercel environment variables.
        </p>
      ) : (
        /* SINGLE Branded Dark Google Button */
        <button
          type="button"
          onClick={() => {
            try {
              handleCustomPopupLogin();
            } catch (e) {
              toast.error(`Google Login: ${formatGoogleError(e)}`);
            }
          }}
          className="btn-brutal w-full bg-white dark:bg-[#141417] text-black dark:text-white border border-[#E8E4DD] dark:border-white/10 py-3.5 px-4 rounded-xl font-sans text-sm font-semibold flex items-center justify-center gap-3 shadow-sm hover:bg-neutral-50 dark:hover:bg-white/10 active:scale-95 transition-all"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>
      )}
    </div>
  );
}
