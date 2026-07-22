import React, { useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface AvatarProps {
  url?: string | null;
  name: string;
  contactId: string;
  className?: string;
  onAvatarRefresh?: (newUrl: string) => void;
}

const gradients = [
  'bg-zinc-800 text-zinc-300',
  'bg-slate-800 text-slate-300',
  'bg-stone-800 text-stone-300',
  'bg-neutral-800 text-neutral-300',
  'bg-emerald-900/40 text-emerald-400',
  'bg-blue-900/40 text-blue-400',
  'bg-indigo-900/40 text-indigo-400',
  'bg-rose-900/40 text-rose-400',
];

export default function Avatar({ url, name, contactId, className = "w-10 h-10", onAvatarRefresh }: AvatarProps) {
  const { token } = useAuthStore();
  const [imgFailed, setImgFailed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const getProfilePic = (u: string | null) => {
    if (!u) return null;
    return u.startsWith('/') ? `${API_URL}${u}` : u;
  };

  const handleError = async () => {
    setImgFailed(true);
    if (!contactId || isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      const { data } = await axios.post(
        `${API_URL}/api/contacts/${contactId}/refresh-avatar`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.profilePicUrl && data.profilePicUrl !== url) {
        if (onAvatarRefresh) onAvatarRefresh(data.profilePicUrl);
        setImgFailed(false);
      }
    } catch (err) {
      console.log('Failed to refresh broken avatar for', contactId);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Deterministic gradient selection based on name length and characters
  const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const gradientClass = gradients[charCodeSum % gradients.length];
  
  // Get 1 or 2 initials
  const initials = name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || '?';

  if (url && !imgFailed) {
    return (
      <img 
        src={getProfilePic(url) as string} 
        alt={name} 
        onError={handleError}
        className={`rounded-full object-cover shadow-sm ${className}`} 
      />
    );
  }

  return (
    <div className={`rounded-full flex items-center justify-center font-medium shadow-sm border border-border-subtle ${gradientClass} ${className}`}>
      {initials}
    </div>
  );
}
