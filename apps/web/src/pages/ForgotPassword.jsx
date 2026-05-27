import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldAlert, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/axios';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [devOtpMsg, setDevOtpMsg] = useState(''); // Developer OTP display for sandbox testing

  // Step 2 States: OTP
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];
  const [cooldown, setCooldown] = useState(0);

  // Step 3 States: Password
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetToken, setResetToken] = useState('');

  // Countdown timer for OTP resend
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Auto-focus first input on Step 2 active
  useEffect(() => {
    if (step === 2 && otpRefs[0].current) {
      otpRefs[0].current.focus();
    }
  }, [step]);

  // Submit email to request OTP
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setLoading(false);
      
      // Save devOtp if backend returned it (development environment only)
      if (data.devOtp) {
        setDevOtpMsg(data.devOtp);
      }
      
      toast.success('Clearance OTP dispatched to email.');
      setCooldown(30); // 30 seconds cooldown
      setStep(2);
    } catch (error) {
      setLoading(false);
      toast.error(error.response?.data?.error || 'Password reset request failed.');
    }
  };

  // Resend OTP trigger
  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setLoading(false);
      if (data.devOtp) {
        setDevOtpMsg(data.devOtp);
      }
      toast.success('A new OTP has been dispatched.');
      setCooldown(30);
    } catch (error) {
      setLoading(false);
      toast.error(error.response?.data?.error || 'Failed to resend code.');
    }
  };

  // OTP typing auto-forwarders
  const handleOtpChange = (e, index) => {
    const val = e.target.value;
    if (isNaN(val)) return;
    
    const newOtp = [...otp];
    newOtp[index] = val.slice(-1);
    setOtp(newOtp);

    // Shift focus forward
    if (val && index < 5) {
      otpRefs[index + 1].current.focus();
    }
  };

  const handleOtpKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1].current.focus();
    }
  };

  // Submit OTP code
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      toast.error('Please input a valid 6-digit OTP code.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { email, otp: otpCode });
      setLoading(false);
      setResetToken(data.resetToken);
      setStep(3);
    } catch (error) {
      setLoading(false);
      toast.error(error.response?.data?.error || 'Invalid OTP code.');
    }
  };

  // Password strength calculator
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, text: 'No Password Entered', color: 'bg-neutral-200 dark:bg-neutral-800' };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[^a-zA-Z0-9]/.test(pass)) score++;
    
    if (score <= 1) return { score: 25, text: 'Weak (Min 8 chars, 1 number)', color: 'bg-[#E63B2E]' };
    if (score <= 3) return { score: 60, text: 'Medium Strength', color: 'bg-amber-500' };
    return { score: 100, text: 'Strong Password Security', color: 'bg-green-500' };
  };

  const strength = getPasswordStrength(password);

  // Submit final reset password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('New access codes do not match.');
      return;
    }
    if (password.length < 8) {
      toast.error('Access code must be at least 8 characters long.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token: resetToken, password });
      setLoading(false);
      toast.success('Access code updated. Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error) {
      setLoading(false);
      toast.error(error.response?.data?.error || 'Failed to update access code.');
    }
  };

  return (
    <div className="min-h-screen bg-off-white dark:bg-[#0D0D0D] flex flex-col justify-center items-center px-6 transition-colors duration-300">
      <Link to="/" className="font-display text-2xl font-bold mb-12 absolute top-8 left-8">TASKFORGE</Link>

      <div className="w-full max-w-md backdrop-blur-md bg-white/75 dark:bg-[#1A1A1A]/75 border border-[#E8E4DD] dark:border-white/10 rounded-[2rem] p-10 shadow-2xl transition-all duration-300">
        
        {/* STEP 1: EMAIL */}
        {step === 1 && (
          <div>
            <h2 className="font-display italic text-4xl mb-2 text-center">Reset Access</h2>
            <p className="font-mono text-xs text-black/50 dark:text-[#E8E4DD]/50 text-center mb-8 uppercase tracking-widest">Forgot password protocol</p>

            <form onSubmit={handleRequestOtp} className="space-y-6">
              <div>
                <label className="block font-mono text-sm mb-2">Registered Email Identity</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-3 rounded-xl font-sans focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-brutal w-full text-white py-4 rounded-xl font-medium mt-4 flex items-center justify-center gap-2"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span className="relative z-10">Send Verification Code</span>
                )}
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: OTP VERIFICATION */}
        {step === 2 && (
          <div>
            <h2 className="font-display italic text-4xl mb-2 text-center">Verification</h2>
            <p className="font-mono text-xs text-black/50 dark:text-[#E8E4DD]/50 text-center mb-6 uppercase tracking-widest">Verify security OTP</p>

            {devOtpMsg && (
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 rounded-2xl mb-6 flex items-start gap-2.5">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-sans font-bold text-xs text-green-800 dark:text-green-300">Sandbox Debug Mode</div>
                  <div className="font-mono text-[10px] text-green-700 dark:text-green-400 mt-0.5">
                    Your verification code is: <span className="font-bold underline">{devOtpMsg}</span>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div>
                <label className="block font-mono text-xs text-center text-black/60 dark:text-[#E8E4DD]/60 uppercase tracking-wider mb-4">
                  Enter 6-Digit OTP Sent to {email}
                </label>
                
                {/* 6 Grid inputs */}
                <div className="flex justify-between gap-2.5">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={otpRefs[idx]}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(e, idx)}
                      onKeyDown={e => handleOtpKeyDown(e, idx)}
                      className="w-12 h-14 bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] rounded-xl text-center text-xl font-bold font-mono focus:outline-none focus:border-[var(--color-accent)] transition-all"
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center text-xs font-mono text-black/50 dark:text-[#E8E4DD]/50">
                {cooldown > 0 ? (
                  <span>Resend in {cooldown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className="text-signal-red hover:underline font-bold"
                  >
                    Resend OTP Code
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="hover:underline flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Change Email
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || otp.join('').length !== 6}
                className="btn-brutal w-full text-white py-4 rounded-xl font-medium mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span className="relative z-10">Verify & Continue</span>
                )}
              </button>
            </form>
          </div>
        )}

        {/* STEP 3: RESET PASSWORD */}
        {step === 3 && (
          <div>
            <h2 className="font-display italic text-4xl mb-2 text-center">New Password</h2>
            <p className="font-mono text-xs text-black/50 dark:text-[#E8E4DD]/50 text-center mb-8 uppercase tracking-widest">Update credentials keys</p>

            <form onSubmit={handleResetPassword} className="space-y-6">
              {/* New password input */}
              <div>
                <label className="block font-mono text-sm mb-2">New Access Code</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-3 rounded-xl font-sans focus:outline-none focus:border-[var(--color-accent)] transition-colors pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-3.5 text-black/40 hover:text-black dark:text-[#E8E4DD]/40 dark:hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm password input */}
              <div>
                <label className="block font-mono text-sm mb-2">Confirm New Access Code</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-3 rounded-xl font-sans focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                />
              </div>

              {/* Password Strength Indicator */}
              <div>
                <div className="flex justify-between items-center text-xs font-mono mb-1.5">
                  <span className="text-black/50">Security Strength</span>
                  <span className="font-bold">{strength.text}</span>
                </div>
                <div className="w-full bg-black/5 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${strength.color}`} 
                    style={{ width: `${strength.score}%` }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || password !== confirmPassword}
                className="btn-brutal w-full text-white py-4 rounded-xl font-medium mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span className="relative z-10">Reset Access Code</span>
                )}
              </button>
            </form>
          </div>
        )}

        <div className="mt-8 text-center font-sans text-sm">
          <Link to="/login" className="text-black/60 dark:text-[#E8E4DD]/60 hover:text-black dark:hover:text-white hover:underline flex items-center justify-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to Login
          </Link>
        </div>

      </div>
    </div>
  );
}
