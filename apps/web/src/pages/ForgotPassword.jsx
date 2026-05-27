import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft, Loader2, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/axios';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Identifier, 2: OTP, 3: New Password
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);

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

  // Submit identifier to request OTP
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      toast.error('Please enter your email or username.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { identifier });
      setLoading(false);
      toast.success('If an account exists, a verification code has been sent.');
      setCooldown(30);
      setStep(2);
    } catch (error) {
      setLoading(false);
      toast.error(error.response?.data?.error || 'Request failed. Please try again.');
    }
  };

  // Resend OTP trigger
  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { identifier });
      setLoading(false);
      toast.success('A new verification code has been sent.');
      setCooldown(30);
      setOtp(['', '', '', '', '', '']);
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

  // Handle paste for OTP
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasteData.length === 6) {
      const newOtp = pasteData.split('');
      setOtp(newOtp);
      otpRefs[5].current.focus();
    }
  };

  // Submit OTP code
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { identifier, otp: otpCode });
      setLoading(false);
      setResetToken(data.resetToken);
      setStep(3);
    } catch (error) {
      setLoading(false);
      const errMsg = error.response?.data?.error || 'Invalid OTP code.';
      toast.error(errMsg);
    }
  };

  // Password complexity checks
  const passwordChecks = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };
  const allChecksPassed = Object.values(passwordChecks).every(Boolean);

  // Password strength calculator
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, text: 'No Password', color: 'bg-neutral-200 dark:bg-neutral-800' };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[a-z]/.test(pass)) score++;
    if (/[^a-zA-Z0-9]/.test(pass)) score++;
    
    if (score <= 2) return { score: 25, text: 'Weak', color: 'bg-[#E63B2E]' };
    if (score <= 3) return { score: 55, text: 'Medium', color: 'bg-amber-500' };
    if (score <= 4) return { score: 80, text: 'Strong', color: 'bg-green-500' };
    return { score: 100, text: 'Very Strong', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength(password);

  // Submit final reset password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!allChecksPassed) {
      toast.error('Password does not meet all requirements.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token: resetToken, password });
      setLoading(false);
      toast.success('Password reset successfully. Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error) {
      setLoading(false);
      toast.error(error.response?.data?.error || 'Failed to reset password.');
    }
  };

  const CheckItem = ({ passed, label }) => (
    <div className={`flex items-center gap-2 text-xs font-mono transition-colors ${passed ? 'text-green-600 dark:text-green-400' : 'text-black/40 dark:text-white/30'}`}>
      {passed ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
      <span>{label}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-off-white dark:bg-[#0D0D0D] flex flex-col justify-center items-center px-6 transition-colors duration-300">
      <Link to="/" className="font-display text-2xl font-bold mb-12 absolute top-8 left-8">TASKFORGE</Link>

      <div className="w-full max-w-md backdrop-blur-md bg-white/75 dark:bg-[#1A1A1A]/75 border border-[#E8E4DD] dark:border-white/10 rounded-[2rem] p-10 shadow-2xl transition-all duration-300">
        
        {/* STEP 1: IDENTIFIER */}
        {step === 1 && (
          <div>
            <h2 className="font-display font-extrabold text-4xl tracking-tight mb-2 text-center">Reset Access</h2>
            <p className="font-mono text-xs text-black/50 dark:text-[#E8E4DD]/50 text-center mb-8 uppercase tracking-widest">Forgot password protocol</p>

            <form onSubmit={handleRequestOtp} className="space-y-6">
              <div>
                <label className="block font-mono text-sm mb-2">Email or Username</label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="name@company.com or your_handle"
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
            <h2 className="font-display font-extrabold text-4xl tracking-tight mb-2 text-center">Verification</h2>
            <p className="font-mono text-xs text-black/50 dark:text-[#E8E4DD]/50 text-center mb-6 uppercase tracking-widest">Verify security OTP</p>

            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div>
                <label className="block font-mono text-xs text-center text-black/60 dark:text-[#E8E4DD]/60 uppercase tracking-wider mb-4">
                  Enter 6-Digit Code
                </label>
                
                {/* 6 Grid inputs */}
                <div className="flex justify-between gap-2.5" onPaste={handleOtpPaste}>
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
                  onClick={() => { setStep(1); setOtp(['', '', '', '', '', '']); }}
                  className="hover:underline flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Change
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
            <h2 className="font-display font-extrabold text-4xl tracking-tight mb-2 text-center">New Password</h2>
            <p className="font-mono text-xs text-black/50 dark:text-[#E8E4DD]/50 text-center mb-8 uppercase tracking-widest">Set new credentials</p>

            <form onSubmit={handleResetPassword} className="space-y-5">
              {/* New password input */}
              <div>
                <label className="block font-mono text-sm mb-2">New Password</label>
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
                <label className="block font-mono text-sm mb-2">Confirm Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-3 rounded-xl font-sans focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-signal-red mt-1 font-mono">Passwords do not match</p>
                )}
              </div>

              {/* Password Requirements Checklist */}
              {password && (
                <div className="bg-black/[0.03] dark:bg-white/5 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-mono font-bold text-black/60 dark:text-white/50 mb-2">Password Requirements</p>
                  <CheckItem passed={passwordChecks.minLength} label="At least 8 characters" />
                  <CheckItem passed={passwordChecks.hasUpper} label="One uppercase letter (A-Z)" />
                  <CheckItem passed={passwordChecks.hasLower} label="One lowercase letter (a-z)" />
                  <CheckItem passed={passwordChecks.hasNumber} label="One number (0-9)" />
                </div>
              )}

              {/* Password Strength Indicator */}
              {password && (
                <div>
                  <div className="flex justify-between items-center text-xs font-mono mb-1.5">
                    <span className="text-black/50">Strength</span>
                    <span className="font-bold">{strength.text}</span>
                  </div>
                  <div className="w-full bg-black/5 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${strength.color}`} 
                      style={{ width: `${strength.score}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !allChecksPassed || password !== confirmPassword}
                className="btn-brutal w-full text-white py-4 rounded-xl font-medium mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span className="relative z-10">Reset Password</span>
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
