import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { GoogleLogin } from '@react-oauth/google';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const setAuth = useAuthStore(state => state.setAuth);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/login', { email, password });
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
      toast.error('Google authentication failed');
    }
  };

  return (
    <div className="min-h-screen bg-off-white flex flex-col justify-center items-center px-6">
      <Link to="/" className="font-display text-2xl font-bold mb-12 absolute top-8 left-8">TASKFORGE</Link>
      
      <div className="w-full max-w-md bg-[#F5F3EE] p-10 rounded-[2rem] border border-[#E8E4DD] shadow-xl">
        <h2 className="font-display italic text-4xl mb-2 text-center">Login Protocol</h2>
        <p className="font-mono text-xs text-black/50 text-center mb-8 uppercase tracking-widest">Authenticate to proceed</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block font-mono text-sm mb-2">Email Identity</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
          
          <button type="submit" className="btn-brutal w-full bg-black text-white py-4 rounded-xl font-medium mt-4">
            <span className="relative z-10">Initialize Session</span>
          </button>
        </form>

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
      </div>
    </div>
  );
}
