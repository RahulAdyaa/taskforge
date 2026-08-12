import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import GoogleAuthButton from '../components/GoogleAuthButton';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';

export default function Signup() {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/app');
    }
  }, [isAuthenticated, navigate]);

  const handleUsernameChange = (e) => {
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
      const data = error.response?.data;
      let msg = 'Registration failed';
      if (typeof data?.error === 'string') {
        msg = data.error;
      } else if (Array.isArray(data?.details) && data.details.length > 0) {
        const first = data.details[0];
        msg = typeof first === 'string' ? first : (first?.message || JSON.stringify(first));
      } else if (typeof data === 'string' && data.length < 150) {
        msg = data;
      }
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen bg-off-white flex flex-col justify-center items-center px-6">
      <Link to="/" className="font-display text-2xl font-bold mb-12 absolute top-8 left-8">
        TASKFORGE
      </Link>

      <div className="w-full max-w-md bg-[#F5F3EE] p-10 rounded-[2rem] border border-[#E8E4DD] shadow-xl">
        <h2 className="font-display font-extrabold text-4xl tracking-tight mb-2 text-center">New Identity</h2>
        <p className="font-mono text-xs text-black/50 text-center mb-8 uppercase tracking-widest">
          Register in system
        </p>

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
            <label className="block font-mono text-sm mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white border border-[#E8E4DD] px-4 py-3 rounded-xl font-sans focus:outline-none focus:border-signal-red transition-colors"
              required
            />
          </div>
          <div>
            <label className="block font-mono text-sm mb-2">Access Code (Password)</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-[#E8E4DD] px-4 py-3 pr-12 rounded-xl font-sans focus:outline-none focus:border-signal-red transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black/70 transition-colors p-1"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-brutal w-full bg-black text-white py-4 rounded-xl font-medium mt-4">
            <span className="relative z-10">Create Clearance</span>
          </button>
        </form>

        <div className="my-6 flex items-center gap-4">
          <div className="h-px bg-[#E8E4DD] flex-1"></div>
          <span className="font-mono text-xs text-black/50">OR</span>
          <div className="h-px bg-[#E8E4DD] flex-1"></div>
        </div>

        <div className="flex justify-center w-full">
          <GoogleAuthButton />
        </div>

        <div className="mt-8 text-center font-sans text-sm">
          <span className="text-black/60">Already have clearance? </span>
          <Link to="/login" className="text-signal-red font-medium hover:underline">
            Login Protocol
          </Link>
        </div>
      </div>
    </div>
  );
}
