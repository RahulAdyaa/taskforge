import React from 'react';
import { useGoogleLogin, GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';

const formatGoogleError = (err) => {
  if (!err) return 'Authentication canceled';
  if (typeof err === 'string') return err;
  if (err.response?.data?.error) return err.response.data.error;
  if (err.response?.data?.message) return err.response.data.message;
  if (err.error_description) return err.error_description;
  if (err.details) return typeof err.details === 'string' ? err.details : JSON.stringify(err.details);
  if (err.error) {
    if (typeof err.error === 'string') {
      if (err.error === 'popup_closed_by_user') return 'Sign-in window closed before completion.';
      if (err.error === 'access_denied') return 'Permission denied by user.';
      if (err.error === 'idpiframe_initialization_failed' || err.error === 'origin_mismatch') {
        return 'Domain origin mismatch: taskforge-sepia-one.vercel.app is not added to Google Cloud Console Authorized Origins.';
      }
      return err.error;
    }
    return JSON.stringify(err.error);
  }
  if (err.message) return err.message;
  try {
    return JSON.stringify(err);
  } catch (e) {
    return 'Google Sign-In failed';
  }
};

export default function GoogleAuthButton() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // 1. OAuth Access Token handler
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

  const handlePopupLogin = useGoogleLogin({
    onSuccess: handleTokenSuccess,
    onError: (errorResponse) => {
      console.warn('Google login error:', errorResponse);
      toast.error(`Google Login: ${formatGoogleError(errorResponse)}`);
    },
  });

  return (
    <div className="w-full flex flex-col items-center justify-center">
      {!clientId || clientId.includes('YOUR_GOOGLE_CLIENT_ID') ? (
        <p className="text-xs font-mono text-signal-red text-center">
          VITE_GOOGLE_CLIENT_ID missing in Vercel env vars.
        </p>
      ) : (
        /* SINGLE Unified Google Login Button (Official GIS Button with 100% Mobile & Desktop Compatibility) */
        <div className="w-full flex justify-center overflow-hidden rounded-xl shadow-sm">
          <GoogleLogin
            onSuccess={handleCredentialSuccess}
            onError={(err) => {
              console.warn('Google Standard login failed:', err);
              toast.error(`Google Login: ${formatGoogleError(err)}`);
            }}
            useOneTap={false}
            theme="filled_black"
            shape="pill"
            size="large"
            text="continue_with"
            width="320"
          />
        </div>
      )}
    </div>
  );
}
