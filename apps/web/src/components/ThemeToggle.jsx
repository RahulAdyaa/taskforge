import React from 'react';
import { useTheme } from '../store/themeStore';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className="relative w-14 h-7 rounded-full border border-neutral-300 dark:border-[#333] bg-[#F5F3EE] dark:bg-[#1A1A1A] transition-colors duration-300 flex items-center px-1 group"
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {/* Sliding dot */}
      <div
        className={`w-5 h-5 rounded-full transition-all duration-300 flex items-center justify-center text-[10px] shadow-sm ${
          isDark
            ? 'translate-x-7 bg-[#E63B2E] text-white'
            : 'translate-x-0 bg-white text-black border border-[#E8E4DD]'
        }`}
      >
        {isDark ? '🌙' : '☀️'}
      </div>
    </button>
  );
}
