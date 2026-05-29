import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, User, Lock, Shield, Mail, Phone, MapPin, Globe, Link2,
  FileText, Code, BarChart2, Key, Bell,
  CreditCard, Palette, Trash2, Cpu, Eye, EyeOff, Layout, LogOut, Check,
  Plus, X, Upload, Download, Terminal, PlusCircle, Settings, Users,
  BookOpen, AlertOctagon, HelpCircle, Activity, Sparkles, CheckCircle, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../store/themeStore';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

const Github = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
  </svg>
);

const Linkedin = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
    <rect x="2" y="9" width="4" height="12"></rect>
    <circle cx="4" cy="4" r="2"></circle>
  </svg>
);

const Twitter = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
  </svg>
);

const accentColors = {
  red: { bg: 'bg-[#E63B2E]', text: 'text-[#E63B2E]', border: 'border-[#E63B2E]', ring: 'focus:ring-[#E63B2E]', label: 'Signal Red' },
  blue: { bg: 'bg-[#2563EB]', text: 'text-[#2563EB]', border: 'border-[#2563EB]', ring: 'focus:ring-[#2563EB]', label: 'Electric Blue' },
  green: { bg: 'bg-[#10B981]', text: 'text-[#10B981]', border: 'border-[#10B981]', ring: 'focus:ring-[#10B981]', label: 'Emerald Green' },
  yellow: { bg: 'bg-[#F59E0B]', text: 'text-[#F59E0B]', border: 'border-[#F59E0B]', ring: 'focus:ring-[#F59E0B]', label: 'Amber Yellow' },
  purple: { bg: 'bg-[#8B5CF6]', text: 'text-[#8B5CF6]', border: 'border-[#8B5CF6]', ring: 'focus:ring-[#8B5CF6]', label: 'Royal Purple' }
};

export default function AccountSettings() {
  const user = useAuthStore(state => state.user);
  const setAuth = useAuthStore(state => state.setAuth);
  const logout = useAuthStore(state => state.logout);
  const [activeSection, setActiveSection] = useState('profile');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { setThemeExplicitly } = useTheme();

  // Load fresh user data and workspaces count on mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await api.get('/auth/me');
        setAuth(data, localStorage.getItem('accessToken'));
      } catch (err) {
        console.error('Failed to load user details', err);
      }
    };
    const loadProjects = async () => {
      try {
        const { data } = await api.get('/projects');
        setMyProjects(data || []);
      } catch (err) {
        console.error(err);
      }
    };
    const loadAnalytics = async () => {
      try {
        const { data } = await api.get('/settings/analytics');
        setAnalyticsData(data);
      } catch (err) {
        console.error('Failed to load settings analytics', err);
      } finally {
        setLoadingAnalytics(false);
      }
    };
    fetchUser();
    loadProjects();
    loadAnalytics();
  }, []);



  // Sidebar sections
  const sections = [
    { id: 'profile', label: 'Basic Profile', icon: User },
    { id: 'personal', label: 'Personal Info', icon: Globe },
    { id: 'socials', label: 'Social & Portfolio', icon: Link2 },
    { id: 'stats', label: 'Dashboard Stats', icon: BarChart2 },
    { id: 'preferences', label: 'Preferences', icon: Bell },
    { id: 'security', label: 'Security & 2FA', icon: Shield },
    { id: 'developer', label: 'Developer SDK', icon: Terminal },
    { id: 'workspaces', label: 'Workspaces', icon: Users },
    { id: 'activity', label: 'Activity Log', icon: Activity },
    { id: 'ai', label: 'AI Configuration', icon: Sparkles },
    { id: 'billing', label: 'Billing & Plan', icon: CreditCard },
    { id: 'data', label: 'Data & Danger Zone', icon: AlertOctagon }
  ];

  // Forms states
  const [profileName, setProfileName] = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [profileHeadline, setProfileHeadline] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [avatar, setAvatar] = useState('');
  const [banner, setBanner] = useState('');

  const [personalPhone, setPersonalPhone] = useState('');
  const [personalLocation, setPersonalLocation] = useState('');
  const [personalTimezone, setPersonalTimezone] = useState('UTC');

  const [socialGithub, setSocialGithub] = useState('');
  const [socialLinkedin, setSocialLinkedin] = useState('');
  const [socialTwitter, setSocialTwitter] = useState('');
  const [socialPortfolio, setSocialPortfolio] = useState('');
  const [socialResume, setSocialResume] = useState('');
  const [techStackInput, setTechStackInput] = useState('');
  const [techStack, setTechStack] = useState([]);
  const [skillsInput, setSkillsInput] = useState('');
  const [skills, setSkills] = useState([]);
  const [experienceLevel, setExperienceLevel] = useState('Mid-Level');
  const [interestInput, setInterestInput] = useState('');
  const [interests, setInterests] = useState([]);
  const [certificationInput, setCertificationInput] = useState('');
  const [certifications, setCertifications] = useState([]);

  const [emailNewsletter, setEmailNewsletter] = useState(true);
  const [emailSecurity, setEmailSecurity] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(false);
  const [notifPush, setNotifPush] = useState(true);
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifDigest, setNotifDigest] = useState(false);
  const [prefLang, setPrefLang] = useState('English');
  const [prefTheme, setPrefTheme] = useState('light');
  const [prefAccent, setPrefAccent] = useState('red');
  const [prefAnimations, setPrefAnimations] = useState(true);
  const [prefLayout, setPrefLayout] = useState('kanban');
  const [prefVisibility, setPrefVisibility] = useState('public');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Developer states
  const [apiKeys, setApiKeys] = useState([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [webhooks, setWebhooks] = useState([]);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [devMode, setDevMode] = useState(false);

  // AI config states
  const [aiTemp, setAiTemp] = useState(0.7);
  const [aiMaxTokens, setAiMaxTokens] = useState(2048);
  const [aiSystemPrompt, setAiSystemPrompt] = useState('You are a helpful assistant.');
  const [savedPrompts, setSavedPrompts] = useState([]);
  const [newPromptName, setNewPromptName] = useState('');
  const [newPromptText, setNewPromptText] = useState('');

  // 2FA setups
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');

  // Active Sessions
  const [activeSessions, setActiveSessions] = useState([]);
  const [loginActivity, setLoginActivity] = useState([]);

  // Activities Log
  const [activities, setActivities] = useState([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);

  // Workspaces
  const [myProjects, setMyProjects] = useState([]);
  const [inviteModalProj, setInviteModalProj] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [orgName, setOrgName] = useState('My Core Org');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  // Load forms fields when user loads
  useEffect(() => {
    if (user) {
      setProfileName(user.name || '');
      setProfileUsername(user.username || '');
      setProfileHeadline(user.headline || '');
      setProfileBio(user.bio || '');
      setAvatar(user.avatarUrl || '');
      setBanner(user.bannerUrl || '');

      setPersonalPhone(user.phone || '');
      setPersonalLocation(user.location || '');
      setPersonalTimezone(user.timezone || 'UTC');

      setSocialGithub(user.githubUrl || '');
      setSocialLinkedin(user.linkedinUrl || '');
      setSocialTwitter(user.twitterUrl || '');
      setSocialPortfolio(user.portfolioUrl || '');
      setSocialResume(user.resumeUrl || '');
      setTechStack(user.techStack || []);
      setSkills(user.skills || []);
      setExperienceLevel(user.experienceLevel || 'Mid-Level');
      setInterests(user.interests || []);
      setCertifications(user.certifications || []);

      setEmailNewsletter(user.emailPreferences?.newsletter ?? true);
      setEmailSecurity(user.emailPreferences?.securityAlerts ?? true);
      setEmailUpdates(user.emailPreferences?.productUpdates ?? false);
      setNotifPush(user.notificationSettings?.push ?? true);
      setNotifEmail(user.notificationSettings?.email ?? true);
      setNotifDigest(user.notificationSettings?.digest ?? false);
      setPrefLang(user.language || 'English');
      setPrefTheme(user.theme || 'light');
      setPrefAccent(user.accentColor || 'red');
      setPrefAnimations(user.animationsEnabled ?? true);
      setPrefLayout(user.dashboardLayout || 'kanban');
      setPrefVisibility(user.profileVisibility || 'public');

      setApiKeys(user.apiKeys || []);
      setWebhooks(user.webhooks || []);
      setDevMode(user.developerMode || false);

      setAiTemp(user.customModelSettings?.temperature ?? 0.7);
      setAiMaxTokens(user.customModelSettings?.maxTokens ?? 2048);
      setAiSystemPrompt(user.customModelSettings?.systemPrompt ?? 'You are a helpful assistant.');
      setSavedPrompts(user.savedPrompts || []);
    }
  }, [user]);

  // Load sessions, projects or activities dynamically on active tab select
  useEffect(() => {
    if (activeSection === 'security') {
      fetchSessions();
    }
    if (activeSection === 'workspaces') {
      fetchProjects();
    }
    if (activeSection === 'activity') {
      fetchActivities();
    }
  }, [activeSection]);

  const fetchSessions = async () => {
    try {
      const { data } = await api.get('/settings/sessions');
      setActiveSessions(data.activeSessions || []);
      setLoginActivity(data.loginActivity || []);
    } catch (err) {
      toast.error('Failed to load session logs.');
    }
  };

  const fetchProjects = async () => {
    try {
      const { data } = await api.get('/projects');
      setMyProjects(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchActivities = async () => {
    setIsLoadingActivities(true);
    try {
      const { data } = await api.get('/settings/activity');
      setActivities(data || []);
    } catch (err) {
      toast.error('Failed to load activity logs.');
    } finally {
      setIsLoadingActivities(false);
    }
  };

  // Profile completion calculator
  const getProfileCompletion = () => {
    let score = 0;
    let total = 6;
    if (avatar) score++;
    if (profileUsername) score++;
    if (profileHeadline) score++;
    if (profileBio) score++;
    if (personalPhone) score++;
    if (personalLocation) score++;
    return Math.round((score / total) * 100);
  };

  // Base64 file reader simulation helper
  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'avatar') setAvatar(reader.result);
      if (type === 'banner') setBanner(reader.result);
      if (type === 'resume') {
        setSocialResume(file.name);
        toast.success(`Resume uploaded: ${file.name}`);
      }
    };
    reader.readAsDataURL(file);
  };

  // Update profile
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.patch('/settings/profile', {
        name: profileName,
        username: profileUsername,
        avatarUrl: avatar,
        bannerUrl: banner,
        headline: profileHeadline,
        bio: profileBio
      });
      setAuth(data, localStorage.getItem('accessToken'));
      toast.success('Basic profile updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Username already taken or invalid update.');
    }
  };

  // Update Personal Info
  const handleUpdatePersonal = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.patch('/settings/personal', {
        phone: personalPhone,
        location: personalLocation,
        timezone: personalTimezone
      });
      setAuth(data, localStorage.getItem('accessToken'));
      toast.success('Personal details stored.');
    } catch (err) {
      toast.error('Failed to update personal details.');
    }
  };

  // Update Socials & Skills
  const handleUpdateSocials = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.patch('/settings/socials', {
        githubUrl: socialGithub,
        linkedinUrl: socialLinkedin,
        portfolioUrl: socialPortfolio,
        resumeUrl: socialResume,
        twitterUrl: socialTwitter,
        techStack,
        skills,
        experienceLevel,
        interests,
        certifications
      });
      setAuth(data, localStorage.getItem('accessToken'));
      toast.success('Social profiles & skills updated.');
    } catch (err) {
      toast.error('Failed to update credentials.');
    }
  };

  // Update preferences
  const handleUpdatePreferences = async (e) => {
    if (e) e.preventDefault();
    try {
      const { data } = await api.patch('/settings/preferences', {
        emailPreferences: {
          newsletter: emailNewsletter,
          securityAlerts: emailSecurity,
          productUpdates: emailUpdates
        },
        notificationSettings: {
          push: notifPush,
          email: notifEmail,
          digest: notifDigest
        },
        language: prefLang,
        theme: prefTheme,
        accentColor: prefAccent,
        animationsEnabled: prefAnimations,
        dashboardLayout: prefLayout,
        profileVisibility: prefVisibility
      });
      setAuth(data, localStorage.getItem('accessToken'));
      toast.success('Application preferences saved.');
    } catch (err) {
      toast.error('Failed to save settings.');
    }
  };

  // Change password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    try {
      await api.patch('/auth/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed successfully.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update access code.');
    }
  };

  // 2FA Setup trigger
  const handleSetup2FA = async () => {
    try {
      const { data } = await api.post('/settings/2fa/setup');
      setQrCode(data.qrCodeUrl);
      setTotpSecret(data.secret);
      setShow2FAModal(true);
    } catch (err) {
      toast.error('Failed to initialize 2FA Setup.');
    }
  };

  // Verify and enable 2FA
  const handleConfirm2FA = async () => {
    try {
      const { data } = await api.post('/settings/2fa/enable', { code: totpCode });
      setShow2FAModal(false);
      setTotpCode('');
      setAuth({ ...user, twoFactorEnabled: true }, localStorage.getItem('accessToken'));
      toast.success('Two-factor authentication enabled!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid 2FA authentication code.');
    }
  };

  // Disable 2FA
  const handleDisable2FA = async () => {
    try {
      const { data } = await api.post('/settings/2fa/disable');
      setAuth({ ...user, twoFactorEnabled: false }, localStorage.getItem('accessToken'));
      toast.success('2FA security disabled.');
    } catch (err) {
      toast.error('Failed to disable 2FA.');
    }
  };

  // Revoke session
  const handleRevokeSession = async (sessionId) => {
    try {
      await api.delete(`/settings/sessions/${sessionId}`);
      setActiveSessions(prev => prev.filter(s => s.id !== sessionId));
      toast.success('Session terminated.');
    } catch (err) {
      toast.error('Could not revoke session.');
    }
  };

  // Generate API key
  const handleGenerateApiKey = async (e) => {
    e.preventDefault();
    if (!newKeyName) return;
    try {
      const { data } = await api.post('/settings/api-keys', { name: newKeyName });
      setApiKeys(data.apiKeys);
      setNewKeyName('');
      toast.success(`Key generated: ${data.newKey.key}`);
    } catch (err) {
      toast.error('Failed to create developer token.');
    }
  };

  // Revoke key
  const handleRevokeApiKey = async (keyId) => {
    try {
      await api.delete(`/settings/api-keys/${keyId}`);
      setApiKeys(prev => prev.filter(k => k.id !== keyId));
      toast.success('API key revoked.');
    } catch (err) {
      toast.error('Failed to revoke key.');
    }
  };

  // Create Webhook
  const handleCreateWebhook = async (e) => {
    e.preventDefault();
    if (!webhookUrl) return;
    try {
      const { data } = await api.post('/settings/webhooks', { url: webhookUrl });
      setWebhooks(data.webhooks);
      setWebhookUrl('');
      toast.success('Webhook target registered.');
    } catch (err) {
      toast.error('Webhook initialization failed.');
    }
  };

  // Revoke webhook
  const handleRevokeWebhook = async (webhookId) => {
    try {
      await api.delete(`/settings/webhooks/${webhookId}`);
      setWebhooks(prev => prev.filter(w => w.id !== webhookId));
      toast.success('Webhook deleted.');
    } catch (err) {
      toast.error('Could not remove webhook.');
    }
  };

  // Developer Mode toggle
  const handleToggleDevMode = async (checked) => {
    try {
      await api.patch('/settings/developer/mode', { developerMode: checked });
      setDevMode(checked);
      setAuth({ ...user, developerMode: checked }, localStorage.getItem('accessToken'));
      toast.success(checked ? 'Developer mode initialized.' : 'Developer mode disabled.');
    } catch (err) {
      toast.error('Failed to toggle developer mode.');
    }
  };

  // AI settings
  const handleSaveAISettings = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.patch('/settings/ai/settings', {
        temperature: aiTemp,
        maxTokens: aiMaxTokens,
        systemPrompt: aiSystemPrompt
      });
      setAuth(data, localStorage.getItem('accessToken'));
      toast.success('AI Model settings stored.');
    } catch (err) {
      toast.error('Could not update AI presets.');
    }
  };

  // Save Prompt
  const handleSavePrompt = async (e) => {
    e.preventDefault();
    if (!newPromptName || !newPromptText) return;
    try {
      const { data } = await api.post('/settings/ai/prompts', {
        name: newPromptName,
        prompt: newPromptText
      });
      setSavedPrompts(data.savedPrompts);
      setNewPromptName('');
      setNewPromptText('');
      toast.success('Prompt configuration saved.');
    } catch (err) {
      toast.error('Failed to save prompt.');
    }
  };

  const handleDeletePrompt = async (promptId) => {
    try {
      await api.delete(`/settings/ai/prompts/${promptId}`);
      setSavedPrompts(prev => prev.filter(p => p.id !== promptId));
      toast.success('Prompt configuration deleted.');
    } catch (err) {
      toast.error('Could not remove prompt.');
    }
  };

  // Invite workspace member
  const handleInviteMember = async (e) => {
    e.preventDefault();
    if (!inviteEmail || !inviteModalProj) return;
    try {
      await api.post(`/projects/${inviteModalProj.id}/members`, {
        email: inviteEmail,
        role: 'MEMBER'
      });
      setInviteEmail('');
      setInviteModalProj(null);
      toast.success('Workspace invitation sent successfully.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invitation dispatch failed.');
    }
  };

  // Export JSON
  const handleExportData = () => {
    window.open(`${api.defaults.baseURL}/settings/export?token=${localStorage.getItem('accessToken')}`, '_blank');
    toast.success('Gathering archives... Your export file download has started.');
  };

  // Delete account completely
  const handleDeleteAccount = async () => {
    const confirmText = prompt('WARNING: This action is irreversible. All comments, task mappings, and organizational alignments will be terminated permanently. Type "DELETE" to confirm:');
    if (confirmText !== 'DELETE') {
      toast.error('Account deletion aborted.');
      return;
    }
    try {
      await api.delete('/settings/account');
      toast.success('Account purged. Logging out...');
      logout();
    } catch (err) {
      toast.error('Purge request failed.');
    }
  };

  const handleLogoutSession = () => {
    api.post('/auth/logout').finally(() => logout());
  };

  // Helper arrays/actions for tag fields
  const addTag = (val, list, setList, inputVal, setInputVal) => {
    if (!val || list.includes(val.trim())) return;
    setList([...list, val.trim()]);
    setInputVal('');
  };

  const removeTag = (idx, list, setList) => {
    setList(list.filter((_, i) => i !== idx));
  };

  return (
    <div className="min-h-screen bg-off-white dark:bg-[#0D0D0D] flex transition-all duration-300">
      {/* Sidebar Toggle Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-5 left-5 z-50 w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-[#1A1A1A] border border-[#E8E4DD] dark:border-[#2A2A2A] shadow-md hover:shadow-lg transition-all duration-200"
        title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {sidebarOpen ? (
          <X className="w-4 h-4" />
        ) : (
          <Layout className="w-4 h-4" />
        )}
      </button>

      {/* Sidebar Navigation */}
      <div className={`bg-[#F5F3EE] dark:bg-[#141414] border-r border-[#E8E4DD] dark:border-[#2A2A2A] flex flex-col p-6 pt-20 fixed h-full overflow-y-auto transition-all duration-300 z-40 ${
        sidebarOpen ? 'w-80 translate-x-0' : 'w-80 -translate-x-full'
      }`}>
        <Link to="/app" className="flex items-center gap-3 text-black/60 dark:text-[#E8E4DD]/60 hover:text-black dark:hover:text-white transition-colors mb-6">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-sans font-medium text-sm">Dashboard Overview</span>
        </Link>

        {/* Completion Widget */}
        <div className="bg-white dark:bg-[#1A1A1A] border border-[#E8E4DD] dark:border-[#2A2A2A] rounded-2xl p-4 mb-6 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="font-sans font-bold text-xs">Profile Completion</span>
            <span className="font-mono text-xs text-var-accent">{getProfileCompletion()}%</span>
          </div>
          <div className="w-full bg-[#F5F3EE] dark:bg-[#2A2A2A] h-2 rounded-full overflow-hidden">
            <div 
              className="bg-black dark:bg-white h-full transition-all duration-500" 
              style={{ width: `${getProfileCompletion()}%`, backgroundColor: 'var(--color-accent)' }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          {sections.map(s => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                  activeSection === s.id
                    ? 'bg-white dark:bg-[#1A1A1A] border-[#E8E4DD] dark:border-[#2A2A2A] text-black dark:text-white shadow-md'
                    : 'border-transparent text-black/60 dark:text-[#E8E4DD]/60 hover:text-black dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5 hover:border-[#E8E4DD]/50 dark:hover:border-[#2A2A2A]/50 hover:shadow-sm'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${activeSection === s.id ? 'text-[var(--color-accent)]' : ''}`} />
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-auto border-t border-[#E8E4DD] dark:border-[#2A2A2A] pt-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-black text-white flex items-center justify-center font-bold text-sm border border-[#E8E4DD] dark:border-[#2A2A2A]">
              {avatar ? (
                <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                user?.name?.charAt(0)?.toUpperCase() || '?'
              )}
            </div>
            <div>
              <div className="font-sans font-bold text-sm leading-tight">{user?.name}</div>
              <div className="font-mono text-xs text-black/50 dark:text-[#E8E4DD]/50">@{user?.username || 'handle'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Settings Panel */}
      <div className={`flex-1 p-12 overflow-x-hidden relative transition-all duration-300 ${sidebarOpen ? 'ml-80' : 'ml-0 pl-20'}`}>
        {/* Page-level dynamic ambient color glow */}
        <div 
          className="absolute -top-20 left-1/3 w-[500px] h-[500px] rounded-full filter blur-[120px] opacity-[0.06] pointer-events-none transition-all duration-1000"
          style={{ backgroundColor: 'var(--color-accent)' }}
        />

        {/* Banner Mockup preview if active */}
        <div className="relative h-44 rounded-3xl overflow-hidden border border-[#E8E4DD] dark:border-[#2A2A2A] bg-neutral-900 dark:bg-neutral-950 mb-8 shadow-md flex items-center p-6 transition-all duration-300">
          {/* Ambient Glow reflecting dynamic accent color */}
          <div 
            className="absolute top-0 right-0 w-64 h-64 rounded-full filter blur-[50px] opacity-25 pointer-events-none transition-all duration-500"
            style={{ backgroundColor: 'var(--color-accent)' }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.05),transparent)] pointer-events-none" />
          
          {banner && (
            <>
              <img src={banner} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/35" />
            </>
          )}

          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center w-full gap-4">
            {/* Left side: Avatar and Info */}
            <div className="flex items-center gap-4">
              <div 
                className="w-20 h-20 rounded-2xl overflow-hidden border-2 bg-neutral-950 shadow-lg transition-all duration-300 flex items-center justify-center"
                style={{ borderColor: 'var(--color-accent)' }}
              >
                {avatar ? (
                  <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="font-bold text-white text-2xl font-display">
                    {user?.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <div>
                <h2 className="font-display font-extrabold text-4xl tracking-tight text-white drop-shadow-md leading-tight">{user?.name}</h2>
                <p className="font-mono text-xs text-white/70 drop-shadow-md">
                  {user?.headline || 'No professional headline set.'}
                </p>
              </div>
            </div>

            {/* Right side: Member info */}
            <div className="flex flex-col items-end gap-1 md:self-center text-right">
              <span className="font-mono text-[10px] text-white/40 uppercase tracking-widest">Member since</span>
              <span className="font-sans font-medium text-sm text-white/90">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'N/A'}
              </span>
              <span className="font-mono text-[10px] text-white/50 mt-2">{user?.email}</span>
              <span className="font-mono text-[10px] text-white/40 mt-1">{myProjects.length || 0} projects</span>
            </div>
          </div>
        </div>

        <div className="settings-panel-card border border-[#E8E4DD] dark:border-[#2A2A2A] shadow-2xl rounded-[2rem] p-10 transition-all duration-300">
          
          {/* TAB 1: BASIC PROFILE */}
          {activeSection === 'profile' && (
            <div>
              <h2 className="font-display font-extrabold text-4xl tracking-tight mb-1">Basic Profile</h2>
              <p className="font-mono text-xs text-black/50 dark:text-[#E8E4DD]/50 uppercase tracking-widest mb-8">Identity Settings & Visuals</p>

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block font-mono text-xs uppercase text-black/60 dark:text-[#E8E4DD]/60 mb-2">Display Name</label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-3 rounded-xl font-sans focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-xs uppercase text-black/60 dark:text-[#E8E4DD]/60 mb-2">Unique Username / Handle</label>
                    <div className="relative">
                      <span className="absolute left-4 top-3.5 text-black/40 dark:text-[#E8E4DD]/40 font-mono text-sm">@</span>
                      <input
                        type="text"
                        value={profileUsername}
                        onChange={(e) => setProfileUsername(e.target.value)}
                        className="w-full bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] pl-8 pr-4 py-3 rounded-xl font-sans focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                        placeholder="handle"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-xs uppercase text-black/60 dark:text-[#E8E4DD]/60 mb-2">Professional Headline</label>
                  <input
                    type="text"
                    value={profileHeadline}
                    onChange={(e) => setProfileHeadline(e.target.value)}
                    className="w-full bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-3 rounded-xl font-sans focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                    placeholder="e.g. Lead Devops Architect | Full Stack Developer"
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs uppercase text-black/60 dark:text-[#E8E4DD]/60 mb-2">Short Bio / About Section</label>
                  <textarea
                    rows={4}
                    value={profileBio}
                    onChange={(e) => setProfileBio(e.target.value)}
                    className="w-full bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-3 rounded-xl font-sans focus:outline-none focus:border-[var(--color-accent)] transition-colors resize-none"
                    placeholder="Tell us about yourself..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="border border-dashed border-[#E8E4DD] dark:border-[#2A2A2A] rounded-xl p-4 flex flex-col items-center justify-center text-center">
                    <span className="font-sans font-bold text-sm mb-1">Upload Avatar</span>
                    <span className="font-mono text-[10px] text-black/40 dark:text-[#E8E4DD]/40 mb-3">JPG, PNG (max 500kb base64)</span>
                    <label className="cursor-pointer bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-xs font-bold hover:opacity-85 transition-opacity">
                      Select Avatar Image
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'avatar')} />
                    </label>
                  </div>
                  <div className="border border-dashed border-[#E8E4DD] dark:border-[#2A2A2A] rounded-xl p-4 flex flex-col items-center justify-center text-center">
                    <span className="font-sans font-bold text-sm mb-1">Upload Banner</span>
                    <span className="font-mono text-[10px] text-black/40 dark:text-[#E8E4DD]/40 mb-3">Cover image banner background</span>
                    <label className="cursor-pointer bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-xs font-bold hover:opacity-85 transition-opacity">
                      Select Cover Image
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'banner')} />
                    </label>
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-[#E8E4DD] dark:border-[#2A2A2A]">
                  <button
                    type="submit"
                    className="btn-brutal text-white px-8 py-3 rounded-xl font-medium"
                    style={{ backgroundColor: 'var(--color-accent)' }}
                  >
                    <span className="relative z-10">Save Core Profile</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: PERSONAL INFO */}
          {activeSection === 'personal' && (
            <div>
              <h2 className="font-display font-extrabold text-4xl tracking-tight mb-1">Personal Information</h2>
              <p className="font-mono text-xs text-black/50 dark:text-[#E8E4DD]/50 uppercase tracking-widest mb-8">Localization & Contacts</p>

              <form onSubmit={handleUpdatePersonal} className="space-y-6">
                <div>
                  <label className="block font-mono text-xs uppercase text-black/60 dark:text-[#E8E4DD]/60 mb-2">Email Address (Read-Only)</label>
                  <div className="bg-[#F5F3EE] dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-3 rounded-xl font-sans text-black/50 dark:text-[#E8E4DD]/50 flex items-center gap-3">
                    <Mail className="w-4 h-4" />
                    <span>{user?.email}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block font-mono text-xs uppercase text-black/60 dark:text-[#E8E4DD]/60 mb-2">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-3.5 w-4 h-4 text-black/40 dark:text-[#E8E4DD]/40" />
                      <input
                        type="text"
                        value={personalPhone}
                        onChange={(e) => setPersonalPhone(e.target.value)}
                        className="w-full bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] pl-12 pr-4 py-3 rounded-xl font-sans focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-mono text-xs uppercase text-black/60 dark:text-[#E8E4DD]/60 mb-2">Location / Office City</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-3.5 w-4 h-4 text-black/40 dark:text-[#E8E4DD]/40" />
                      <input
                        type="text"
                        value={personalLocation}
                        onChange={(e) => setPersonalLocation(e.target.value)}
                        className="w-full bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] pl-12 pr-4 py-3 rounded-xl font-sans focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                        placeholder="San Francisco, CA"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-xs uppercase text-black/60 dark:text-[#E8E4DD]/60 mb-2">Timezone Selection</label>
                  <select
                    value={personalTimezone}
                    onChange={(e) => setPersonalTimezone(e.target.value)}
                    className="w-full bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-3 rounded-xl font-sans focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                  >
                    <option value="UTC">UTC (GMT+0)</option>
                    <option value="EST">EST (GMT-5)</option>
                    <option value="PST">PST (GMT-8)</option>
                    <option value="GMT">GMT (GMT+0)</option>
                    <option value="CET">CET (GMT+1)</option>
                    <option value="IST">IST (GMT+5:30)</option>
                    <option value="JST">JST (GMT+9)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-xs uppercase text-black/60 dark:text-[#E8E4DD]/60 mb-2">Date Joined Registry</label>
                  <div className="font-mono text-xs text-black/50 dark:text-[#E8E4DD]/50">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { dateStyle: 'full' }) : 'Unknown'}
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-[#E8E4DD] dark:border-[#2A2A2A]">
                  <button
                    type="submit"
                    className="btn-brutal text-white px-8 py-3 rounded-xl font-medium"
                    style={{ backgroundColor: 'var(--color-accent)' }}
                  >
                    <span className="relative z-10">Save Personal Settings</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: SOCIALS & PORTFOLIO */}
          {activeSection === 'socials' && (
            <div>
              <h2 className="font-display font-extrabold text-4xl tracking-tight mb-1">Credentials & Socials</h2>
              <p className="font-mono text-xs text-black/50 dark:text-[#E8E4DD]/50 uppercase tracking-widest mb-8">Professional Links & Skills</p>

              <form onSubmit={handleUpdateSocials} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block font-mono text-xs uppercase mb-2">GitHub URL</label>
                    <div className="relative">
                      <Github className="absolute left-4 top-3.5 w-4 h-4 text-black/40" />
                      <input
                        type="text"
                        value={socialGithub}
                        onChange={(e) => setSocialGithub(e.target.value)}
                        className="w-full bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] pl-12 pr-4 py-3 rounded-xl font-sans focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                        placeholder="https://github.com/username"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-mono text-xs uppercase mb-2">LinkedIn URL</label>
                    <div className="relative">
                      <Linkedin className="absolute left-4 top-3.5 w-4 h-4 text-black/40" />
                      <input
                        type="text"
                        value={socialLinkedin}
                        onChange={(e) => setSocialLinkedin(e.target.value)}
                        className="w-full bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] pl-12 pr-4 py-3 rounded-xl font-sans focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                        placeholder="https://linkedin.com/in/username"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block font-mono text-xs uppercase mb-2">Portfolio Website</label>
                    <div className="relative">
                      <Globe className="absolute left-4 top-3.5 w-4 h-4 text-black/40" />
                      <input
                        type="text"
                        value={socialPortfolio}
                        onChange={(e) => setSocialPortfolio(e.target.value)}
                        className="w-full bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] pl-12 pr-4 py-3 rounded-xl font-sans focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                        placeholder="https://mywebsite.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-mono text-xs uppercase mb-2">Twitter/X Handle</label>
                    <div className="relative">
                      <Twitter className="absolute left-4 top-3.5 w-4 h-4 text-black/40" />
                      <input
                        type="text"
                        value={socialTwitter}
                        onChange={(e) => setSocialTwitter(e.target.value)}
                        className="w-full bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] pl-12 pr-4 py-3 rounded-xl font-sans focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                        placeholder="https://x.com/username"
                      />
                    </div>
                  </div>
                </div>

                {/* File Upload Resume */}
                <div>
                  <label className="block font-mono text-xs uppercase mb-2">Resume upload</label>
                  <div className="border border-dashed border-[#E8E4DD] dark:border-[#2A2A2A] p-4 rounded-xl flex items-center justify-between bg-white dark:bg-[#141414]">
                    <div className="flex items-center gap-3">
                      <FileText className="w-6 h-6 text-black/40" />
                      <div>
                        <div className="font-sans font-medium text-sm">{socialResume || 'No resume uploaded.'}</div>
                        <div className="font-mono text-[10px] text-black/40">PDF, DOCX formats supported</div>
                      </div>
                    </div>
                    <label className="cursor-pointer bg-[#F5F3EE] hover:bg-[#E8E4DD] text-black px-4 py-2 rounded-lg text-xs font-bold transition-colors">
                      Attach Resume
                      <input type="file" className="hidden" onChange={(e) => handleFileChange(e, 'resume')} />
                    </label>
                  </div>
                </div>

                {/* Tech Stack Input */}
                <div>
                  <label className="block font-mono text-xs uppercase mb-2">Tech Stack Tags</label>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={techStackInput}
                      onChange={(e) => setTechStackInput(e.target.value)}
                      placeholder="Type a technology (e.g. React) and press Add..."
                      className="flex-1 bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-2.5 rounded-xl font-sans focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => addTag(techStackInput, techStack, setTechStack, techStackInput, setTechStackInput)}
                      className="bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-xl text-xs font-bold"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {techStack.map((tag, idx) => (
                      <span key={idx} className="flex items-center gap-1.5 px-3 py-1 bg-black/5 dark:bg-white/10 rounded-full font-mono text-xs">
                        {tag}
                        <button type="button" onClick={() => removeTag(idx, techStack, setTechStack)} className="hover:text-signal-red">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Skills Section */}
                <div>
                  <label className="block font-mono text-xs uppercase mb-2">Skills & Expertise</label>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={skillsInput}
                      onChange={(e) => setSkillsInput(e.target.value)}
                      placeholder="Add a skill (e.g. Product Design)..."
                      className="flex-1 bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-2.5 rounded-xl font-sans focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => addTag(skillsInput, skills, setSkills, skillsInput, setSkillsInput)}
                      className="bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-xl text-xs font-bold"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill, idx) => (
                      <span key={idx} className="flex items-center gap-1.5 px-3 py-1 bg-black/5 dark:bg-white/10 rounded-full font-mono text-xs">
                        {skill}
                        <button type="button" onClick={() => removeTag(idx, skills, setSkills)} className="hover:text-signal-red">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Experience level */}
                <div>
                  <label className="block font-mono text-xs uppercase mb-2">Experience level</label>
                  <select
                    value={experienceLevel}
                    onChange={(e) => setExperienceLevel(e.target.value)}
                    className="w-full bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-3 rounded-xl font-sans focus:outline-none"
                  >
                    <option value="Junior">Junior (0-2 years)</option>
                    <option value="Mid-Level">Mid-Level (2-5 years)</option>
                    <option value="Senior">Senior (5-8 years)</option>
                    <option value="Lead/Principal">Lead / Principal (8+ years)</option>
                  </select>
                </div>

                {/* Interests Tag Input */}
                <div>
                  <label className="block font-mono text-xs uppercase mb-2">Interests</label>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={interestInput}
                      onChange={(e) => setInterestInput(e.target.value)}
                      placeholder="Add an interest..."
                      className="flex-1 bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-2.5 rounded-xl font-sans focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => addTag(interestInput, interests, setInterests, interestInput, setInterestInput)}
                      className="bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-xl text-xs font-bold"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {interests.map((int, idx) => (
                      <span key={idx} className="flex items-center gap-1.5 px-3 py-1 bg-black/5 dark:bg-white/10 rounded-full font-mono text-xs">
                        {int}
                        <button type="button" onClick={() => removeTag(idx, interests, setInterests)} className="hover:text-signal-red">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Certifications Tag Input */}
                <div>
                  <label className="block font-mono text-xs uppercase mb-2">Certifications</label>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={certificationInput}
                      onChange={(e) => setCertificationInput(e.target.value)}
                      placeholder="Add a certification..."
                      className="flex-1 bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-2.5 rounded-xl font-sans focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => addTag(certificationInput, certifications, setCertifications, certificationInput, setCertificationInput)}
                      className="bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-xl text-xs font-bold"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {certifications.map((cert, idx) => (
                      <span key={idx} className="flex items-center gap-1.5 px-3 py-1 bg-black/5 dark:bg-white/10 rounded-full font-mono text-xs">
                        {cert}
                        <button type="button" onClick={() => removeTag(idx, certifications, setCertifications)} className="hover:text-signal-red">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-[#E8E4DD] dark:border-[#2A2A2A]">
                  <button
                    type="submit"
                    className="btn-brutal text-white px-8 py-3 rounded-xl font-medium"
                    style={{ backgroundColor: 'var(--color-accent)' }}
                  >
                    <span className="relative z-10">Save Credentials</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 4: STATISTICS & DASHBOARD */}
          {activeSection === 'stats' && (
            <div>
              <h2 className="font-display font-extrabold text-4xl tracking-tight mb-1">Operational Analytics</h2>
              <p className="font-mono text-xs text-black/50 dark:text-[#E8E4DD]/50 uppercase tracking-widest mb-8">Performance & Usage Dashboard</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-[#F5F3EE] dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] rounded-2xl p-5 text-center shadow-sm">
                  <div className="font-mono text-xs uppercase text-black/40 mb-2">Projects</div>
                  <div className="font-sans font-bold text-4xl tracking-tight">{loadingAnalytics ? '...' : (analyticsData?.projectsCount ?? 0)}</div>
                </div>
                <div className="bg-[#F5F3EE] dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] rounded-2xl p-5 text-center shadow-sm">
                  <div className="font-mono text-xs uppercase text-black/40 mb-2">API Calls</div>
                  <div className="font-sans font-bold text-4xl tracking-tight">{loadingAnalytics ? '...' : (analyticsData?.apiCalls?.toLocaleString() ?? '0')}</div>
                </div>
                <div className="bg-[#F5F3EE] dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] rounded-2xl p-5 text-center shadow-sm">
                  <div className="font-mono text-xs uppercase text-black/40 mb-2">AI Runs</div>
                  <div className="font-sans font-bold text-4xl tracking-tight">{loadingAnalytics ? '...' : (analyticsData?.aiRuns ?? 0)}</div>
                </div>
                <div className="bg-[#F5F3EE] dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] rounded-2xl p-5 text-center shadow-sm">
                  <div className="font-mono text-xs uppercase text-black/40 mb-2">Storage</div>
                  <div className="font-sans font-bold text-4xl tracking-tight">{loadingAnalytics ? '...' : (analyticsData?.storageStr ?? '0 KB')}</div>
                </div>
              </div>

              {/* Monthly activity mini chart */}
              <div className="bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] rounded-2xl p-6 shadow-sm mb-6">
                <div className="flex justify-between items-center mb-6">
                  <span className="font-sans font-bold text-sm">Monthly Operational Traffic</span>
                  <span className="font-mono text-[10px] text-black/50">Last Active: Today</span>
                </div>
                <div className="h-44 w-full">
                  {loadingAnalytics ? (
                    <div className="w-full h-full flex items-center justify-center font-mono text-xs text-black/40">
                      Analyzing activity logs...
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={analyticsData?.trafficData || []}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="opChartGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="name"
                          stroke="#888"
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                          dy={10}
                        />
                        <YAxis
                          stroke="#888"
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '11px',
                            fontFamily: 'monospace'
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="traffic"
                          stroke="var(--color-accent)"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#opChartGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PREFERENCES */}
          {activeSection === 'preferences' && (
            <div>
              <h2 className="font-display font-extrabold text-4xl tracking-tight mb-1">Preferences & Toggles</h2>
              <p className="font-mono text-xs text-black/50 dark:text-[#E8E4DD]/50 uppercase tracking-widest mb-8">Personalize TaskForge Environment</p>

              <form onSubmit={handleUpdatePreferences} className="space-y-6">
                <div>
                  <h3 className="font-sans font-bold text-sm mb-4">Visual Aesthetics</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block font-mono text-xs uppercase mb-2">Display Theme</label>
                      <select
                        value={prefTheme}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPrefTheme(val);
                          setThemeExplicitly(val);
                        }}
                        className="w-full bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-3 rounded-xl font-sans focus:outline-none"
                      >
                        <option value="light">Light Mode</option>
                        <option value="dark">Dark Mode</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-mono text-xs uppercase mb-2">Dashboard Default Layout</label>
                      <select
                        value={prefLayout}
                        onChange={(e) => setPrefLayout(e.target.value)}
                        className="w-full bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-3 rounded-xl font-sans focus:outline-none"
                      >
                        <option value="kanban">Kanban Board</option>
                        <option value="list">List View</option>
                        <option value="grid">Grid Dashboard</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Accent Color Circle Selector */}
                <div>
                  <label className="block font-mono text-xs uppercase mb-3">Accent Theme Color</label>
                  <div className="flex gap-4">
                    {Object.keys(accentColors).map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setPrefAccent(color)}
                        className={`w-10 h-10 rounded-full border-2 transition-all ${
                          accentColors[color].bg
                        } ${
                          prefAccent === color ? 'border-black dark:border-white scale-110 shadow-md' : 'border-transparent hover:scale-105'
                        }`}
                        title={accentColors[color].label}
                      />
                    ))}
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-4 border-t border-[#E8E4DD] dark:border-[#2A2A2A] pt-6">
                  <h3 className="font-sans font-bold text-sm mb-4">Notification Feeds</h3>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-sans font-medium text-sm">Security Alerts</div>
                      <div className="font-mono text-[10px] text-black/50">Notify on new login devices/attempts</div>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={emailSecurity} 
                      onChange={e => setEmailSecurity(e.target.checked)}
                      className="w-10 h-5 accent-[var(--color-accent)] cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-sans font-medium text-sm">Product Newsletters</div>
                      <div className="font-mono text-[10px] text-black/50">Receive operational updates and guides</div>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={emailNewsletter} 
                      onChange={e => setEmailNewsletter(e.target.checked)}
                      className="w-10 h-5 accent-[var(--color-accent)] cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-sans font-medium text-sm">Daily Digest Summaries</div>
                      <div className="font-mono text-[10px] text-black/50">Receive daily logs of all tasks changes</div>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={notifDigest} 
                      onChange={e => setNotifDigest(e.target.checked)}
                      className="w-10 h-5 accent-[var(--color-accent)] cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-sans font-medium text-sm">Interface micro-animations</div>
                      <div className="font-mono text-[10px] text-black/50">Enable visual transitions and click physics</div>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={prefAnimations} 
                      onChange={e => setPrefAnimations(e.target.checked)}
                      className="w-10 h-5 accent-[var(--color-accent)] cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-[#E8E4DD] dark:border-[#2A2A2A]">
                  <button
                    type="submit"
                    className="btn-brutal text-white px-8 py-3 rounded-xl font-medium"
                    style={{ backgroundColor: 'var(--color-accent)' }}
                  >
                    <span className="relative z-10">Save Preferences</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 6: SECURITY & 2FA */}
          {activeSection === 'security' && (
            <div>
              <h2 className="font-display font-extrabold text-4xl tracking-tight mb-1">Access Security</h2>
              <p className="font-mono text-xs text-black/50 dark:text-[#E8E4DD]/50 uppercase tracking-widest mb-8">2FA, Password & Sessions</p>

              {/* 2FA Card */}
              <div className="bg-[#F5F3EE] dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] rounded-2xl p-6 mb-8 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="w-8 h-8 text-[var(--color-accent)]" />
                    <div>
                      <h3 className="font-sans font-bold text-sm">Two-Factor Authentication (2FA)</h3>
                      <p className="font-mono text-[10px] text-black/50">Secure verification on login attempts.</p>
                    </div>
                  </div>
                  {user?.twoFactorEnabled ? (
                    <button
                      onClick={handleDisable2FA}
                      className="bg-signal-red text-white text-xs font-bold px-4 py-2 rounded-lg"
                    >
                      Disable 2FA
                    </button>
                  ) : (
                    <button
                      onClick={handleSetup2FA}
                      className="bg-black dark:bg-white text-white dark:text-black text-xs font-bold px-4 py-2 rounded-lg"
                    >
                      Setup 2FA
                    </button>
                  )}
                </div>
              </div>

              {/* 2FA SETUP MODAL POPUP */}
              {show2FAModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                  <div className="bg-white dark:bg-[#1A1A1A] max-w-sm w-full border border-[#E8E4DD] dark:border-[#2A2A2A] rounded-3xl p-6 shadow-2xl">
                    <h3 className="font-display text-xl font-bold mb-4">Enroll 2FA Device</h3>
                    <p className="font-sans text-xs text-black/60 dark:text-[#E8E4DD]/60 mb-4">
                      Scan the QR code below using your authentication app (Google Authenticator, Duo, or 1Password):
                    </p>
                    
                    {qrCode && (
                      <div className="flex justify-center border border-[#E8E4DD] p-4 bg-white rounded-xl mb-4">
                        <img src={qrCode} alt="2FA QR Code" />
                      </div>
                    )}
                    
                    <div className="bg-off-white dark:bg-[#141414] p-3 rounded-lg border border-[#E8E4DD] dark:border-[#2A2A2A] font-mono text-[10px] break-all text-center mb-4">
                      SECRET: {totpSecret}
                    </div>

                    <input
                      type="text"
                      maxLength={6}
                      value={totpCode}
                      onChange={e => setTotpCode(e.target.value)}
                      placeholder="Enter 6-digit Code..."
                      className="w-full text-center bg-off-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-3 rounded-xl font-mono focus:outline-none mb-4"
                    />

                    <div className="flex gap-3">
                      <button
                        onClick={handleConfirm2FA}
                        disabled={totpCode.length !== 6}
                        className="flex-1 bg-black text-white dark:bg-white dark:text-black py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                      >
                        Confirm Code
                      </button>
                      <button
                        onClick={() => setShow2FAModal(false)}
                        className="flex-1 bg-[#F5F3EE] dark:bg-[#2A2A2A] py-2 rounded-lg text-xs font-bold"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Password update form */}
              <form onSubmit={handleChangePassword} className="space-y-6 border-t border-[#E8E4DD] dark:border-[#2A2A2A] pt-6 mb-8">
                <h3 className="font-sans font-bold text-sm">Change Access Password</h3>
                <div>
                  <label className="block font-mono text-xs uppercase mb-2">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-3 rounded-xl font-sans focus:outline-none"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block font-mono text-xs uppercase mb-2">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-3 rounded-xl font-sans focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-xs uppercase mb-2">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-3 rounded-xl font-sans focus:outline-none"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="btn-brutal text-white px-6 py-2.5 rounded-xl text-xs font-bold"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                >
                  <span className="relative z-10">Update Password</span>
                </button>
              </form>

              {/* Sessions list */}
              <div className="border-t border-[#E8E4DD] dark:border-[#2A2A2A] pt-6">
                <h3 className="font-sans font-bold text-sm mb-4">Active Logged Sessions</h3>
                <div className="space-y-4">
                  {activeSessions.map(sess => (
                    <div key={sess.id} className="flex justify-between items-center bg-[#F5F3EE] dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] p-4 rounded-xl">
                      <div>
                        <div className="font-sans font-bold text-xs">{sess.device}</div>
                        <div className="font-mono text-[10px] text-black/50">IP: {sess.ip} • Location: {sess.location}</div>
                        <div className="font-mono text-[9px] text-black/40 mt-1">Last active: {new Date(sess.lastActive).toLocaleDateString()}</div>
                      </div>
                      <button
                        onClick={() => handleRevokeSession(sess.id)}
                        className="text-signal-red hover:bg-signal-red/10 px-3 py-1.5 rounded-lg font-sans font-bold text-[10px]"
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                  {activeSessions.length === 0 && (
                    <div className="text-center font-mono text-xs text-black/40 py-4">No other active sessions detected.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: DEVELOPER SDK */}
          {activeSection === 'developer' && (
            <div>
              <h2 className="font-display font-extrabold text-4xl tracking-tight mb-1">Developer Features</h2>
              <p className="font-mono text-xs text-black/50 dark:text-[#E8E4DD]/50 uppercase tracking-widest mb-8">Access keys & Webhooks</p>

              {/* Dev mode toggle */}
              <div className="flex items-center justify-between bg-[#F5F3EE] dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] p-4 rounded-2xl mb-8">
                <div>
                  <h3 className="font-sans font-bold text-sm">Developer SDK Access</h3>
                  <p className="font-mono text-[10px] text-black/50">Activate developer configuration dashboard tools</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={devMode} 
                  onChange={e => handleToggleDevMode(e.target.checked)}
                  className="w-10 h-5 accent-[var(--color-accent)] cursor-pointer"
                />
              </div>

              {devMode && (
                <div className="space-y-8 animate-fadeIn">
                  {/* API Key Generation */}
                  <form onSubmit={handleGenerateApiKey} className="space-y-4">
                    <h3 className="font-sans font-bold text-sm">Generate Application API Key</h3>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newKeyName}
                        onChange={e => setNewKeyName(e.target.value)}
                        placeholder="Key Identifier Name (e.g. CI Deployment)..."
                        className="flex-1 bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-2.5 rounded-xl font-sans focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="bg-black dark:bg-white text-white dark:text-black px-4 py-2.5 rounded-xl text-xs font-bold"
                      >
                        Generate Key
                      </button>
                    </div>
                  </form>

                  {/* API key list */}
                  <div>
                    <h4 className="font-sans font-bold text-xs uppercase mb-2 text-black/50">Active API Keys</h4>
                    <div className="space-y-3">
                      {apiKeys.map(k => (
                        <div key={k.id} className="flex justify-between items-center bg-[#F5F3EE] dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] p-4 rounded-xl">
                          <div>
                            <div className="font-sans font-bold text-xs">{k.name}</div>
                            <div className="font-mono text-[10px] text-var-accent">{k.key}</div>
                          </div>
                          <button
                            onClick={() => handleRevokeApiKey(k.id)}
                            className="text-signal-red hover:bg-signal-red/10 p-2 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {apiKeys.length === 0 && (
                        <div className="text-center font-mono text-xs text-black/40 py-4">No active API keys found.</div>
                      )}
                    </div>
                  </div>

                  {/* Webhooks Setup */}
                  <form onSubmit={handleCreateWebhook} className="space-y-4 border-t border-[#E8E4DD] dark:border-[#2A2A2A] pt-6">
                    <h3 className="font-sans font-bold text-sm">Deploy Webhooks</h3>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={webhookUrl}
                        onChange={e => setWebhookUrl(e.target.value)}
                        placeholder="Webhook Target URL (https://...)"
                        className="flex-1 bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-2.5 rounded-xl font-sans focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="bg-black dark:bg-white text-white dark:text-black px-4 py-2.5 rounded-xl text-xs font-bold"
                      >
                        Register Webhook
                      </button>
                    </div>
                  </form>

                  {/* Webhooks list */}
                  <div>
                    <h4 className="font-sans font-bold text-xs uppercase mb-2 text-black/50">Active Webhook Listeners</h4>
                    <div className="space-y-3">
                      {webhooks.map(w => (
                        <div key={w.id} className="flex justify-between items-center bg-[#F5F3EE] dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] p-4 rounded-xl">
                          <div>
                            <div className="font-sans font-bold text-xs break-all">{w.url}</div>
                            <div className="font-mono text-[9px] text-black/40 mt-1">Events: {w.events.join(', ')}</div>
                          </div>
                          <button
                            onClick={() => handleRevokeWebhook(w.id)}
                            className="text-signal-red hover:bg-signal-red/10 p-2 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {webhooks.length === 0 && (
                        <div className="text-center font-mono text-xs text-black/40 py-4">No active webhooks configured.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 8: WORKSPACES */}
          {activeSection === 'workspaces' && (
            <div>
              <h2 className="font-display font-extrabold text-4xl tracking-tight mb-1">Workspaces & Organizations</h2>
              <p className="font-mono text-xs text-black/50 dark:text-[#E8E4DD]/50 uppercase tracking-widest mb-8">Manage Teams & Shared Projects</p>

              {/* Organization setup */}
              <div className="mb-8">
                <h3 className="font-sans font-bold text-sm mb-3">Organization Profile</h3>
                <div className="flex gap-4">
                  <input
                    type="text"
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    className="flex-1 bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-3 rounded-xl font-sans focus:outline-none"
                  />
                  <button
                    onClick={() => toast.success('Organization profile updated.')}
                    className="bg-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-xl text-xs font-bold"
                  >
                    Save
                  </button>
                </div>
              </div>

              {/* Project Membership Switcher */}
              <div>
                <h3 className="font-sans font-bold text-sm mb-4">Workspace memberships</h3>
                <div className="space-y-4">
                  {myProjects.map(proj => (
                    <div key={proj.id} className="flex justify-between items-center bg-[#F5F3EE] dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] p-4 rounded-xl">
                      <div>
                        <div className="font-sans font-bold text-xs">{proj.name}</div>
                        <div className="font-mono text-[10px] text-black/50">Members: {proj.members?.length || 1}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setInviteModalProj(proj)}
                          className="bg-white dark:bg-[#2A2A2A] border border-[#E8E4DD] dark:border-[#333] hover:border-black text-black dark:text-white px-3 py-1.5 rounded-lg text-xs font-bold"
                        >
                          Invite Member
                        </button>
                        <Link
                          to={`/app/projects/${proj.id}`}
                          className="bg-black dark:bg-white text-white dark:text-black px-3 py-1.5 rounded-lg text-xs font-bold"
                        >
                          Switch
                        </Link>
                      </div>
                    </div>
                  ))}
                  {myProjects.length === 0 && (
                    <div className="text-center font-mono text-xs text-black/40 py-4">No active workspace directories found.</div>
                  )}
                </div>
              </div>

              {/* Invite member modal */}
              {inviteModalProj && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                  <form onSubmit={handleInviteMember} className="bg-white dark:bg-[#1A1A1A] max-w-sm w-full border border-[#E8E4DD] dark:border-[#2A2A2A] rounded-3xl p-6 shadow-2xl">
                    <h3 className="font-display text-xl font-bold mb-4">Invite to {inviteModalProj.name}</h3>
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="Collaborator Email Address..."
                      className="w-full bg-off-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-3 rounded-xl font-sans focus:outline-none mb-4"
                    />
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        className="flex-1 bg-black text-white dark:bg-white dark:text-black py-2 rounded-lg text-xs font-bold"
                      >
                        Send Invite
                      </button>
                      <button
                        type="button"
                        onClick={() => setInviteModalProj(null)}
                        className="flex-1 bg-[#F5F3EE] dark:bg-[#2A2A2A] py-2 rounded-lg text-xs font-bold"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* TAB 9: ACTIVITY LOG */}
          {activeSection === 'activity' && (
            <div>
              <h2 className="font-display font-extrabold text-4xl tracking-tight mb-1">Operational History</h2>
              <p className="font-mono text-xs text-black/50 dark:text-[#E8E4DD]/50 uppercase tracking-widest mb-8">Activity Timeline & Logs</p>

              {isLoadingActivities ? (
                <div className="relative border-l-2 border-[#E8E4DD] dark:border-[#2A2A2A] pl-6 ml-3 space-y-6">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="relative opacity-60">
                      <div 
                        className="absolute -left-[33px] top-1 w-4 h-4 rounded-full border-2 border-white dark:border-[#1A1A1A] bg-[#E8E4DD] dark:bg-zinc-700 flex items-center justify-center shadow-sm skeleton-loading"
                      />
                      <div className="h-4 w-1/3 rounded skeleton-loading mb-2" />
                      <div className="h-3 w-1/2 rounded skeleton-loading" />
                    </div>
                  ))}
                </div>
              ) : activities.length === 0 ? (
                <div className="py-8 text-center font-mono text-xs text-black/50 dark:text-zinc-500 border border-dashed border-[#E8E4DD] dark:border-[#2A2A2A] rounded-2xl">
                  No activity recorded yet for this session.
                </div>
              ) : (
                /* Activity Timeline */
                <div className="relative border-l-2 border-[#E8E4DD] dark:border-[#2A2A2A] pl-6 ml-3 space-y-6">
                  {activities.map((act) => (
                    <div key={act.id} className="relative">
                      <div 
                        className="absolute -left-[33px] top-1 w-4 h-4 rounded-full border-2 border-white dark:border-[#1A1A1A] flex items-center justify-center shadow-sm"
                        style={{ backgroundColor: 'var(--color-accent)' }}
                      />
                      <div className="font-sans font-bold text-xs">{act.title}</div>
                      <div className="font-mono text-[10px] text-black/50 dark:text-[#E8E4DD]/40 mt-1">
                        {new Date(act.timestamp).toLocaleString()} • {act.details}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 10: AI CONFIGURATION */}
          {activeSection === 'ai' && (
            <div>
              <h2 className="font-display font-extrabold text-4xl tracking-tight mb-1">AI Engine Presets</h2>
              <p className="font-mono text-xs text-black/50 dark:text-[#E8E4DD]/50 uppercase tracking-widest mb-8">Model Settings & Prompts</p>

              <div className="bg-[#F5F3EE] dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] rounded-2xl p-4 flex justify-between items-center mb-8 shadow-sm">
                <div>
                  <div className="font-sans font-bold text-xs">AI Credits Remaining</div>
                  <div className="font-mono text-[10px] text-black/40">Daily quotas resets at midnight.</div>
                </div>
                <div className="font-sans font-bold text-3xl tracking-tight text-[var(--color-accent)]">{user?.aiCredits ?? 100} credits</div>
              </div>

              {/* AI Config presets */}
              <form onSubmit={handleSaveAISettings} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block font-mono text-xs uppercase mb-2">Model Temperature: {aiTemp}</label>
                    <input
                      type="range"
                      min={0}
                      max={1.5}
                      step={0.1}
                      value={aiTemp}
                      onChange={e => setAiTemp(parseFloat(e.target.value))}
                      className="w-full accent-[var(--color-accent)]"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-xs uppercase mb-2">Max Output Tokens: {aiMaxTokens}</label>
                    <input
                      type="range"
                      min={256}
                      max={4096}
                      step={256}
                      value={aiMaxTokens}
                      onChange={e => setAiMaxTokens(parseInt(e.target.value))}
                      className="w-full accent-[var(--color-accent)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-xs uppercase mb-2">AI System Prompt Instructions</label>
                  <textarea
                    rows={3}
                    value={aiSystemPrompt}
                    onChange={e => setAiSystemPrompt(e.target.value)}
                    className="w-full bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-3 rounded-xl font-sans focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="btn-brutal text-white px-6 py-2.5 rounded-xl text-xs font-bold"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                >
                  Save Model Settings
                </button>
              </form>

              {/* Saved prompts */}
              <div className="border-t border-[#E8E4DD] dark:border-[#2A2A2A] pt-6 mt-8">
                <h3 className="font-sans font-bold text-sm mb-4">Saved Prompt Presets</h3>
                
                <form onSubmit={handleSavePrompt} className="space-y-4 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      value={newPromptName}
                      onChange={e => setNewPromptName(e.target.value)}
                      placeholder="Preset Name (e.g. Code Reviewer)..."
                      className="bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-2 rounded-xl font-sans text-xs focus:outline-none"
                    />
                    <input
                      type="text"
                      value={newPromptText}
                      onChange={e => setNewPromptText(e.target.value)}
                      placeholder="Prompt Instructions..."
                      className="bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-2 rounded-xl font-sans text-xs focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-xs font-bold"
                  >
                    Save Prompt Preset
                  </button>
                </form>

                <div className="space-y-3">
                  {savedPrompts.map(p => (
                    <div key={p.id} className="flex justify-between items-center bg-[#F5F3EE] dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] p-4 rounded-xl">
                      <div>
                        <div className="font-sans font-bold text-xs">{p.name}</div>
                        <div className="font-mono text-[10px] text-black/50">{p.prompt}</div>
                      </div>
                      <button
                        onClick={() => handleDeletePrompt(p.id)}
                        className="text-signal-red hover:bg-signal-red/10 p-2 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 11: BILLING & PLAN */}
          {activeSection === 'billing' && (
            <div>
              <h2 className="font-display font-extrabold text-4xl tracking-tight mb-1">Billing & Subscription</h2>
              <p className="font-mono text-xs text-black/50 dark:text-[#E8E4DD]/50 uppercase tracking-widest mb-8">Limits, Invoices & Upgrades</p>

              {/* Current tier card */}
              <div className="border border-[#E8E4DD] dark:border-[#2A2A2A] rounded-2xl p-6 bg-white dark:bg-[#141414] mb-8 shadow-sm flex justify-between items-center">
                <div>
                  <span className="font-mono text-[9px] uppercase px-2.5 py-1 bg-black/10 dark:bg-white/10 rounded-full font-bold">Current Tier</span>
                  <h3 className="font-display font-extrabold text-4xl tracking-tight mt-3 mb-1">TaskForge {user?.plan || 'FREE'}</h3>
                  <p className="font-mono text-[10px] text-black/50">Renews on: June 26, 2026</p>
                </div>
                <button
                  onClick={() => toast.success('Upgrade checkout loaded.')}
                  className="btn-brutal text-white px-6 py-3 rounded-xl font-medium"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                >
                  Upgrade Plan
                </button>
              </div>

              {/* Usage limits */}
              <div className="space-y-4 mb-8">
                <h3 className="font-sans font-bold text-sm">Operational Quota Limits</h3>
                <div>
                  <div className="flex justify-between font-mono text-[10px] text-black/50 mb-1">
                    <span>AI Generations</span>
                    <span>{100 - (user?.aiCredits || 100)} / 100 Runs</span>
                  </div>
                  <div className="w-full bg-[#F5F3EE] dark:bg-[#2A2A2A] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-black dark:bg-white h-full" style={{ width: `${100 - (user?.aiCredits || 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between font-mono text-[10px] text-black/50 mb-1">
                    <span>Shared Directories</span>
                    <span>{myProjects.length || 3} / 5 Workspaces</span>
                  </div>
                  <div className="w-full bg-[#F5F3EE] dark:bg-[#2A2A2A] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-black dark:bg-white h-full" style={{ width: `${((myProjects.length || 3) / 5) * 100}%` }} />
                  </div>
                </div>
              </div>

              {/* Invoices list mockup */}
              <div className="border-t border-[#E8E4DD] dark:border-[#2A2A2A] pt-6">
                <h3 className="font-sans font-bold text-sm mb-4">Billing History Invoices</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-[#F5F3EE] dark:bg-[#141414] p-4 rounded-xl border border-[#E8E4DD] dark:border-[#2A2A2A]">
                    <div>
                      <div className="font-sans font-bold text-xs">Invoice #INV-92083</div>
                      <div className="font-mono text-[9px] text-black/40">May 19, 2026 • Free Plan Renewal</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-xs font-bold">$0.00</span>
                      <button className="text-black/40 hover:text-black">
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 12: DATA & DANGER ZONE */}
          {activeSection === 'data' && (
            <div>
              <h2 className="font-display font-extrabold text-4xl tracking-tight mb-1">Data & Danger Zone</h2>
              <p className="font-mono text-xs text-black/50 dark:text-[#E8E4DD]/50 uppercase tracking-widest mb-8">Export, Backup & Purge</p>

              <div className="space-y-6">
                <div>
                  <h3 className="font-sans font-bold text-sm mb-2">Export Workspace Archives</h3>
                  <p className="font-mono text-[10px] text-black/50 mb-3">Download a consolidated JSON bundle of all profile settings, comments, task indices, and audit timelines.</p>
                  <button
                    onClick={handleExportData}
                    className="bg-black dark:bg-white text-white dark:text-black font-sans font-bold text-xs px-5 py-2.5 rounded-lg flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download JSON Export</span>
                  </button>
                </div>

                <div className="border-t border-[#E8E4DD] dark:border-[#2A2A2A] pt-6">
                  <h3 className="font-sans font-bold text-sm mb-2">Data Retention Policy</h3>
                  <select
                    className="bg-white dark:bg-[#141414] border border-[#E8E4DD] dark:border-[#2A2A2A] px-4 py-2.5 rounded-xl font-sans focus:outline-none"
                    defaultValue="forever"
                    onChange={() => toast.success('Data retention rules updated.')}
                  >
                    <option value="30">Delete activity history logs after 30 days</option>
                    <option value="90">Delete activity history logs after 90 days</option>
                    <option value="forever">Keep activity history logs indefinitely</option>
                  </select>
                </div>

                {/* DANGER ZONE */}
                <div className="border-t-2 border-signal-red/20 pt-6 mt-8">
                  <h3 className="font-sans font-bold text-sm text-signal-red mb-2">Danger Zone</h3>
                  <p className="font-mono text-[10px] text-black/50 mb-4">Highly sensitive operations. These actions cannot be undone.</p>
                  
                  <div className="flex gap-4">
                    <button
                      onClick={handleDeleteAccount}
                      className="bg-signal-red text-white font-sans font-bold text-xs px-5 py-3 rounded-lg flex items-center gap-2 hover:bg-signal-red/90"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete TaskForge Account</span>
                    </button>
                    <button
                      onClick={() => toast.success('Preferences reset.')}
                      className="bg-black/5 dark:bg-white/10 text-black dark:text-white font-sans font-bold text-xs px-5 py-3 rounded-lg"
                    >
                      Reset Configurations
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
