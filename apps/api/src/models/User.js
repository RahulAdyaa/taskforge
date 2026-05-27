const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      default: null,
    },
    googleId: {
      type: String,
      default: null,
      sparse: true,
      unique: true,
    },
    // --- Password Reset Flow Fields ---
    resetPasswordOtp: {
      type: String,
      default: null,
    },
    resetPasswordOtpExpires: {
      type: Date,
      default: null,
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordTokenExpires: {
      type: Date,
      default: null,
    },
    // --- Basic Profile & Personal Info ---
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
    },
    avatarUrl: { type: String, default: null },
    bannerUrl: { type: String, default: null },
    headline: { type: String, default: '' },
    bio: { type: String, default: '' },
    phone: { type: String, default: '' },
    location: { type: String, default: '' },
    timezone: { type: String, default: 'UTC' },

    // --- Social & Portfolio ---
    githubUrl: { type: String, default: '' },
    linkedinUrl: { type: String, default: '' },
    portfolioUrl: { type: String, default: '' },
    resumeUrl: { type: String, default: '' },
    twitterUrl: { type: String, default: '' },
    techStack: { type: [String], default: [] },
    skills: { type: [String], default: [] },
    experienceLevel: { type: String, default: 'Mid-Level' },
    interests: { type: [String], default: [] },
    certifications: { type: [String], default: [] },

    // --- Preferences ---
    emailPreferences: {
      newsletter: { type: Boolean, default: true },
      securityAlerts: { type: Boolean, default: true },
      productUpdates: { type: Boolean, default: false },
    },
    notificationSettings: {
      push: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      digest: { type: Boolean, default: false },
    },
    language: { type: String, default: 'English' },
    theme: { type: String, default: 'light' },
    accentColor: { type: String, default: 'red' },
    animationsEnabled: { type: Boolean, default: true },
    dashboardLayout: { type: String, default: 'kanban' },
    profileVisibility: { type: String, default: 'public' },

    // --- Security ---
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: null },
    activeSessions: [{
      id: { type: String, required: true },
      device: { type: String, default: 'Unknown Device' },
      ip: { type: String, default: '127.0.0.1' },
      location: { type: String, default: 'Unknown Location' },
      lastActive: { type: Date, default: Date.now }
    }],
    deviceHistory: { type: [String], default: [] },
    loginActivity: [{
      ip: { type: String },
      success: { type: Boolean },
      timestamp: { type: Date, default: Date.now },
      browser: { type: String }
    }],
    connectedAccounts: [{
      provider: { type: String },
      email: { type: String },
      connectedAt: { type: Date, default: Date.now }
    }],

    // --- Developer ---
    apiKeys: [{
      id: { type: String, required: true },
      name: { type: String, required: true },
      key: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
      lastUsed: { type: Date, default: null }
    }],
    webhooks: [{
      id: { type: String, required: true },
      url: { type: String, required: true },
      events: { type: [String], default: [] },
      active: { type: Boolean, default: true }
    }],
    developerMode: { type: Boolean, default: false },

    // --- AI Features ---
    aiCredits: { type: Number, default: 100 },
    savedPrompts: [{
      id: { type: String, required: true },
      name: { type: String, required: true },
      prompt: { type: String, required: true }
    }],
    promptHistory: [{
      prompt: { type: String },
      response: { type: String },
      model: { type: String },
      timestamp: { type: Date, default: Date.now }
    }],
    customModelSettings: {
      temperature: { type: Number, default: 0.7 },
      maxTokens: { type: Number, default: 2048 },
      systemPrompt: { type: String, default: 'You are a helpful assistant.' }
    },

    // --- Billing ---
    plan: { type: String, default: 'FREE' }, // FREE, PRO, ENTERPRISE
    billingHistory: [{
      invoiceId: { type: String },
      date: { type: Date, default: Date.now },
      amount: { type: Number },
      status: { type: String }
    }],
    paymentMethods: [{
      brand: { type: String },
      last4: { type: String },
      expMonth: { type: Number },
      expYear: { type: Number },
      isDefault: { type: Boolean, default: false }
    }]
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('User', userSchema);
