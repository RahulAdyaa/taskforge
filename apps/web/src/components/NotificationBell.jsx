import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Bell, CheckCircle2 } from 'lucide-react';
import { useNotificationStore } from '../store/notificationStore';
import { Link } from 'react-router-dom';

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Deduplicate notifications by message & type to prevent spam rows
  const displayNotifications = useMemo(() => {
    const seen = new Set();
    return notifications.filter(n => {
      const key = `${n.message}_${n.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [notifications]);

  return (
    <div className="relative z-50 inline-block" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-black/60 hover:text-black hover:bg-black/5 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/5 transition-all focus:outline-none"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-signal-red rounded-full border-2 border-[#F5F3EE] dark:border-[#09090B] animate-pulse"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2.5 w-[calc(100vw-2rem)] max-w-sm sm:w-96 bg-white dark:bg-[#141417] border border-[#E8E4DD] dark:border-white/20 rounded-2xl shadow-2xl z-[100] overflow-hidden">
          <div className="p-3.5 px-4 border-b border-[#E8E4DD] dark:border-white/10 flex justify-between items-center bg-[#F5F3EE] dark:bg-[#1A1A1E]">
            <h3 className="font-sans font-bold text-xs sm:text-sm text-black dark:text-white flex items-center gap-2">
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="font-mono text-[10px] bg-signal-red/10 text-signal-red border border-signal-red/20 px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-[11px] font-mono text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white flex items-center gap-1 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div data-lenis-prevent className="max-h-[340px] overflow-y-auto">
            {displayNotifications.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-black/40 dark:text-white/30">
                You're all caught up.
              </div>
            ) : (
              <div className="divide-y divide-[#E8E4DD] dark:divide-white/5">
                {displayNotifications.map(notification => (
                  <div 
                    key={notification.id} 
                    className={`notification-item p-3.5 transition-colors ${!notification.read ? 'unread' : ''}`}
                  >
                    <div className="flex justify-between items-start gap-3 mb-1.5">
                      <p className="font-sans text-xs text-black/90 dark:text-white/90 leading-snug">
                        {notification.message}
                      </p>
                      {!notification.read && (
                        <button 
                          onClick={() => markAsRead(notification.id)}
                          className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 mt-1 flex-shrink-0"
                          title="Mark as read"
                        />
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-black/40 dark:text-white/40 font-mono">
                        {new Date(notification.createdAt).toLocaleDateString()} {new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {notification.link && (
                        <Link 
                          to={notification.link}
                          onClick={() => setIsOpen(false)}
                          className="text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          View ↗
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
