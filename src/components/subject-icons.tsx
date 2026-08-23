'use client';

import { CodeIcon, MessageCircle } from './icons';

/** Maps a subject's `icon` string (from the platform API) to its component. */
const SUBJECT_ICONS: Record<string, typeof MessageCircle> = {
  'message-circle': MessageCircle,
  code: CodeIcon,
};

export function SubjectIcon({ icon, size, className }: { icon?: string; size?: number; className?: string }) {
  const Icon = (icon && SUBJECT_ICONS[icon]) || MessageCircle;
  return <Icon size={size} className={className} />;
}
