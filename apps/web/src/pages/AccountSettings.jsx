import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, User, Lock, Shield, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';

export default function AccountSettings() {
  const user = useAuthStore(state => state.user);
  const setAuth = useAuthStore(state => state.setAuth);
  const [activeSection, setActiveSection] = useState('profile');

  // Profile form
  const [name, setName] = useState(user?.name || '');
  const [email] = useState(user?.email || '');

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.patch('/auth/profile', { name });
      setAuth(data, localStorage.getItem('accessToken'));
      toast.success('Profile updated.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update profile.');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    try {
      await api.patch('/auth/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated successfully.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to change password.');
    }
  };

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
  ];

  return (
    <div className="min-h-screen bg-off-white flex">
      {/* Sidebar */}
      <div className="w-72 bg-[#F5F3EE] border-r border-[#E8E4DD] flex flex-col p-6 fixed h-full">
        <Link to="/app" className="flex items-center gap-3 text-black/60 hover:text-black transition-colors mb-8">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back to Projects</span>
        </Link>

        <h2 className="font-display text-xl font-bold mb-6">Account Settings</h2>

        <div className="space-y-1">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeSection === s.id
                  ? 'bg-white border border-[#E8E4DD] text-black shadow-sm'
                  : 'text-black/60 hover:text-black hover:bg-white/50'
              }`}
            >
              <s.icon className="w-4 h-4" />
              {s.label}
            </button>
          ))}
        </div>

        <div className="mt-auto border-t border-[#E8E4DD] pt-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center font-bold text-sm">
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <div className="font-sans font-medium text-sm">{user?.name}</div>
              <div className="font-mono text-xs text-black/50">{user?.email}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 ml-72 p-12 max-w-2xl">
        {activeSection === 'profile' && (
          <div>
            <h1 className="font-display italic text-4xl mb-2">Profile</h1>
            <p className="font-mono text-xs text-black/50 uppercase tracking-widest mb-8">Identity Configuration</p>

            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div>
                <label className="block font-mono text-sm mb-2">Designation (Name)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-[#E8E4DD] px-4 py-3 rounded-xl font-sans focus:outline-none focus:border-signal-red transition-colors"
                />
              </div>

              <div>
                <label className="block font-mono text-sm mb-2">Email Identity</label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-[#F5F3EE] border border-[#E8E4DD] px-4 py-3 rounded-xl font-sans text-black/50 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {email}
                  </div>
                  <div className="flex items-center gap-1 px-3 py-1 bg-green-50 border border-green-200 rounded-lg">
                    <Shield className="w-3 h-3 text-green-600" />
                    <span className="font-mono text-xs text-green-700">Verified</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4">
                <button
                  type="submit"
                  className="btn-brutal bg-black text-white px-8 py-3 rounded-xl font-medium"
                >
                  <span className="relative z-10">Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {activeSection === 'security' && (
          <div>
            <h1 className="font-display italic text-4xl mb-2">Security</h1>
            <p className="font-mono text-xs text-black/50 uppercase tracking-widest mb-8">Access Code Management</p>

            <form onSubmit={handleChangePassword} className="space-y-6">
              <div>
                <label className="block font-mono text-sm mb-2">Current Access Code</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-white border border-[#E8E4DD] px-4 py-3 rounded-xl font-sans focus:outline-none focus:border-signal-red transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block font-mono text-sm mb-2">New Access Code</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-white border border-[#E8E4DD] px-4 py-3 rounded-xl font-sans focus:outline-none focus:border-signal-red transition-colors"
                  required
                />
                <p className="font-mono text-xs text-black/40 mt-1">Min 8 characters, must contain a number</p>
              </div>

              <div>
                <label className="block font-mono text-sm mb-2">Confirm New Access Code</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-white border border-[#E8E4DD] px-4 py-3 rounded-xl font-sans focus:outline-none focus:border-signal-red transition-colors"
                  required
                />
              </div>

              <div className="flex items-center gap-4 pt-4">
                <button
                  type="submit"
                  className="btn-brutal bg-signal-red text-white px-8 py-3 rounded-xl font-medium"
                >
                  <span className="relative z-10">Update Access Code</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
