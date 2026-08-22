'use client';

import { useEffect, useState } from 'react';

/**
 * Tracks browser connectivity so the UI can say "you're offline" instead of
 * letting a send fail into a generic network error. Starts optimistic
 * (assume online) because `navigator` does not exist during server render;
 * the effect corrects it immediately after mount, before the student can
 * interact with anything.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
