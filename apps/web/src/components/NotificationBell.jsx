import React, { useState, useRef, useEffect } from 'react';
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

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-black/60 hover:text-black hover:bg-black/5 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/5 transition-all"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-signal-red rounded-full border-2 border-[#F5F3EE] dark:border-[#09090B]"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-[#121215] border border-[#E8E4DD] dark:border-white/10 rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="p-4 border-b border-[#E8E4DD] dark:border-white/10 flex justify-between items-center bg-[#F5F3EE] dark:bg-[#1A1A1A]">
            <h3 className="font-sans font-bold text-sm text-black dark:text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-[10px] font-mono text-black/50 hover:text-black dark:text-white/40 dark:hover:text-white flex items-center gap-1"
              >
                <CheckCircle2 className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[300px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-black/40 dark:text-white/30">
                You're all caught up.
              </div>
            ) : (
              <div className="divide-y divide-[#E8E4DD] dark:divide-white/5">
                {notifications.map(notification => (
                  <div 
                    key={notification.id} 
                    className={`notification-item p-4 transition-colors ${!notification.read ? 'unread' : ''}`}
                  >
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <p className="font-mono text-xs text-black/80 dark:text-white/80 leading-relaxed">
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
                    
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-black/40 dark:text-white/40 font-mono">
                        {new Date(notification.createdAt).toLocaleDateString()} {new Date(notification.createdAt).toLocaleTimeString()}
                      </span>
                      {notification.link && (
                        <Link 
                          to={notification.link}
                          onClick={() => setIsOpen(false)}
                          className="text-[10px] font-mono text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          View
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
