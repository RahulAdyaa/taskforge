import React from 'react';
import { useGoogleLogin, GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../store/themeStore';

export default function GoogleAuthButton() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const { theme } = useTheme();

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const extractError = (error) => {
    if (!error) return 'Google authentication failed';
    if (typeof error === 'string') return error;
    
    const resData = error.response?.data;
    if (resData) {
      if (typeof resData === 'object') {
        if (typeof resData.error === 'string') return resData.error;
        if (typeof resData.message === 'string') return resData.message;
        if (Array.isArray(resData.details) && typeof resData.details[0] === 'string') {
          return resData.details[0];
        }
      } else if (typeof resData === 'string' && resData.length < 150) {
        return resData;
      }
    }

    if (error.response?.status === 500) {
      return 'Server Error (500). Please check server environment or logs.';
    }

    if (typeof error.error_description === 'string') return error.error_description;
    if (typeof error.error === 'string') return error.error;
    if (typeof error.message === 'string' && !error.message.includes('object Object')) {
      return error.message;
    }
    return 'Google Sign-In failed or was cancelled';
  };

  // 1. Popup OAuth flow (Works 100% on Mobile Chrome & Safari)
  const handlePopupLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const { data } = await api.post('/auth/google', {
          accessToken: tokenResponse.access_token,
        });
        setAuth(data.user, data.accessToken);
        toast.success('Google clearance granted.');
        navigate('/app');
      } catch (error) {
        const msg = extractError(error);
        toast.error(`Google Login Error: ${msg}`);
      }
    },
    onError: (error) => {
      console.error('Google Popup login failed:', error);
      const msg = extractError(error);
      toast.error(`Google Sign-In Error: ${msg}`);
    },
  });

  // 2. Standard ID Token flow handler
  const handleStandardSuccess = async (credentialResponse) => {
    try {
      const { data } = await api.post('/auth/google', {
        token: credentialResponse.credential,
      });
      setAuth(data.user, data.accessToken);
      toast.success('Google clearance granted.');
      navigate('/app');
    } catch (error) {
      const msg = extractError(error);
      toast.error(`Google Login Error: ${msg}`);
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Mobile-optimized & Popup Google Login Button */}
      <button
        type="button"
        onClick={() => {
          if (!clientId || clientId.includes('YOUR_GOOGLE_CLIENT_ID')) {
            toast.error('Google Client ID not configured. Please set VITE_GOOGLE_CLIENT_ID in environment variables.');
            return;
          }
          handlePopupLogin();
        }}
        className="btn-brutal w-full bg-white dark:bg-[#141417] text-black dark:text-white border border-[#E8E4DD] dark:border-white/10 py-3 px-4 rounded-xl font-sans text-sm font-semibold flex items-center justify-center gap-3 shadow-sm hover:bg-neutral-50 dark:hover:bg-white/10 active:scale-95 transition-all"
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

      {/* Hidden/Fallback Google ID Token Renderer */}
      {clientId && !clientId.includes('YOUR_GOOGLE_CLIENT_ID') && (
        <div className="hidden">
          <GoogleLogin
            onSuccess={handleStandardSuccess}
            onError={() => {
              console.warn('Google Standard login failed');
            }}
            useOneTap={false}
          />
        </div>
      )}
    </div>
  );
}
