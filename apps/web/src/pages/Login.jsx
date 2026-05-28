import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { GoogleLogin } from '@react-oauth/google';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show2FA, setShow2FA] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const navigate = useNavigate();
  const setAuth = useAuthStore(state => state.setAuth);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { identifier, password };
      if (show2FA) {
        payload.code = totpCode;
      }

      const { data } = await api.post('/auth/login', payload);
      
      if (data.twoFactorRequired) {
        setShow2FA(true);
        toast.success('Two-factor authentication required.');
        return;
      }
      
      setAuth(data.user, data.accessToken);
      toast.success('Access granted.');
      navigate('/app');
    } catch (error) {
      const errorData = error.response?.data;
      const errorMessage = errorData?.details?.[0]?.message || errorData?.error || 'Authentication failed';
      toast.error(errorMessage);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const { data } = await api.post('/auth/google', { token: credentialResponse.credential });
      setAuth(data.user, data.accessToken);
      toast.success('Google clearance granted.');
      navigate('/app');
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message || 'Google authentication failed';
      toast.error(`Google authentication failed: ${errorMsg}`);
    }
  };

  return (
    <div className="min-h-screen bg-off-white flex flex-col justify-center items-center px-6">
      <Link to="/" className="font-display text-2xl font-bold mb-12 absolute top-8 left-8">TASKFORGE</Link>
      
      <div className="w-full max-w-md bg-[#F5F3EE] p-10 rounded-[2rem] border border-[#E8E4DD] shadow-xl">
        <h2 className="font-display font-extrabold text-4xl tracking-tight mb-2 text-center">Login Protocol</h2>
        <p className="font-mono text-xs text-black/50 text-center mb-8 uppercase tracking-widest">
          {show2FA ? 'Secure Verification' : 'Authenticate to proceed'}
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {!show2FA ? (
            <>
              <div>
                <label className="block font-mono text-sm mb-2">Email or Username</label>
                <input 
                  type="text" 
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="name@company.com or your_handle"
                  className="w-full bg-white border border-[#E8E4DD] px-4 py-3 rounded-xl font-sans focus:outline-none focus:border-signal-red transition-colors"
                  required 
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block font-mono text-sm">Access Code</label>
                  <Link to="/forgot-password" className="font-mono text-xs text-signal-red hover:underline">Forgot Password?</Link>
                </div>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-[#E8E4DD] px-4 py-3 rounded-xl font-sans focus:outline-none focus:border-signal-red transition-colors"
                  required 
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block font-mono text-sm mb-2 text-center">Two-Factor Authentication Code</label>
              <input 
                type="text" 
                maxLength={6}
                placeholder="000000"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-white border border-[#E8E4DD] px-4 py-3 rounded-xl font-mono text-center text-2xl tracking-widest focus:outline-none focus:border-signal-red transition-colors"
                required 
              />
            </div>
          )}
          
          <button type="submit" className="btn-brutal w-full bg-black text-white py-4 rounded-xl font-medium mt-4">
            <span className="relative z-10">{show2FA ? 'Verify 2FA Code' : 'Initialize Session'}</span>
          </button>

          {show2FA && (
            <button 
              type="button" 
              onClick={() => { setShow2FA(false); setTotpCode(''); }} 
              className="w-full font-mono text-xs text-black/50 hover:underline mt-4 text-center block"
            >
              Back to Login
            </button>
          )}
        </form>

        {!show2FA && (
          <>
            <div className="my-6 flex items-center gap-4">
              <div className="h-px bg-[#E8E4DD] flex-1"></div>
              <span className="font-mono text-xs text-black/50">OR</span>
              <div className="h-px bg-[#E8E4DD] flex-1"></div>
            </div>

            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => {
                  toast.error('Google Sign-In Failed');
                }}
              />
            </div>
            
            <div className="mt-8 text-center font-sans text-sm">
              <span className="text-black/60">No clearance? </span>
              <Link to="/signup" className="text-signal-red font-medium hover:underline">Request Access</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
