import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { GoogleLogin } from '@react-oauth/google';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';

export default function Signup() {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const setAuth = useAuthStore(state => state.setAuth);

  const handleUsernameChange = (e) => {
    // Force lowercase, only allow alphanumeric and underscores
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (username.length < 3) {
      toast.error('Username must be at least 3 characters.');
      return;
    }
    try {
      const { data } = await api.post('/auth/signup', { name, username, email, password });
      setAuth(data.user, data.accessToken);
      toast.success('Identity registered.');
      navigate('/app');
    } catch (error) {
      if (error.response?.data?.details) {
         toast.error(error.response.data.details[0].message);
      } else {
         toast.error(error.response?.data?.error || 'Registration failed');
      }
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
        <h2 className="font-display font-extrabold text-4xl tracking-tight mb-2 text-center">New Identity</h2>
        <p className="font-mono text-xs text-black/50 text-center mb-8 uppercase tracking-widest">Register in system</p>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block font-mono text-sm mb-2">Designation (Name)</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white border border-[#E8E4DD] px-4 py-3 rounded-xl font-sans focus:outline-none focus:border-signal-red transition-colors"
              required 
            />
          </div>
          <div>
            <label className="block font-mono text-sm mb-2">Username</label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-black/40 font-mono text-sm">@</span>
              <input 
                type="text" 
                value={username}
                onChange={handleUsernameChange}
                placeholder="your_handle"
                maxLength={30}
                className="w-full bg-white border border-[#E8E4DD] pl-9 pr-4 py-3 rounded-xl font-mono text-sm focus:outline-none focus:border-signal-red transition-colors"
                required 
              />
            </div>
            {username && username.length < 3 && (
              <p className="text-xs text-signal-red mt-1 font-mono">Min 3 characters</p>
            )}
          </div>
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
            <label className="block font-mono text-sm mb-2">Access Code</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white border border-[#E8E4DD] px-4 py-3 rounded-xl font-sans focus:outline-none focus:border-signal-red transition-colors"
              required 
              placeholder="Min 8 chars, 1 number"
            />
          </div>
          
          <button type="submit" className="btn-brutal w-full bg-signal-red text-white py-4 rounded-xl font-medium mt-4">
            <span className="relative z-10">Establish Clearance</span>
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
          <span className="text-black/60">Already registered? </span>
          <Link to="/login" className="text-black font-medium hover:underline">Authenticate</Link>
        </div>
      </div>
    </div>
  );
}
