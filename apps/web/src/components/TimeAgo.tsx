import { useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';

function formatTimeAgo(date: string | Date | number): string {
  const d = new Date(date as string | number | Date);
  const diff = Date.now() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

interface TimeAgoProps {
  date: string | Date | number;
  tooltipBottom?: boolean;
  className?: string;
}

export function TimeAgo({ date, tooltipBottom, className }: TimeAgoProps) {
  const [timeAgo, setTimeAgo] = useState(() => formatTimeAgo(date));

  useEffect(() => {
    setTimeAgo(formatTimeAgo(date));
    const interval = setInterval(() => setTimeAgo(formatTimeAgo(date)), 60_000);
    return () => clearInterval(interval);
  }, [date]);

  const formatted = new Date(date as string | number | Date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <span
      className={twMerge(
        'md:tooltip cursor-default',
        tooltipBottom && 'md:tooltip-bottom',
        className,
      )}
      data-tip={formatted}
      title={formatted}
    >
      {timeAgo}
    </span>
  );
}
