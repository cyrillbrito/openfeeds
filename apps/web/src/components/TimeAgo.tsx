import { createTimeAgo, type DateInit } from '@solid-primitives/date';
import { twMerge } from 'tailwind-merge';

interface TimeAgoProps {
  date: DateInit;
  tooltipBottom?: boolean;
  class?: string;
}

export function TimeAgo(props: TimeAgoProps) {
  const [timeAgo, extras] = createTimeAgo(props.date);
  // TODO: Consider adding support for relative time formats in different languages
  // This could be useful for internationalization efforts
  const formatted = () =>
    extras.target().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  return (
    <span
      class={twMerge(
        'tooltip cursor-default',
        props.tooltipBottom && 'tooltip-bottom',
        props.class,
      )}
      data-tip={formatted()}
    >
      {timeAgo()}
    </span>
  );
}
