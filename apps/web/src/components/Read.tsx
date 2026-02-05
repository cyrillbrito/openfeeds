import { Check, CircleCheck } from 'lucide-solid';
import { createSignal, Show } from 'solid-js';
import { twMerge } from 'tailwind-merge';

export function ReadButton(props: { read?: boolean; setRead?: (read: boolean) => void }) {
  const [animate, setAnimate] = createSignal(false);

  const handleClick = () => {
    if (!props.read) {
      setAnimate(true);
      setTimeout(() => setAnimate(false), 300);
    }
    props.setRead?.(!props.read);
  };

  return (
    <button
      class={twMerge(
        'btn btn-xs sm:btn-sm lg:btn-md btn-info transition-all duration-200',
        'h-8 min-h-0 px-2 sm:h-12 sm:px-4',
        props.read ? 'hover:btn-outline' : 'btn-outline',
        props.read && !animate() ? 'hover:btn-error' : '',
        animate() ? 'scale-125' : 'hover:scale-105',
      )}
      onClick={handleClick}
      title={props.read ? 'Mark as unread' : 'Mark as read'}
    >
      <Show when={props.read} fallback={<Check size={20} />}>
        <CircleCheck size={20} />
      </Show>
      <span class="ml-1 hidden sm:inline">{props.read ? 'Read' : 'Mark Read'}</span>
    </button>
  );
}

export function KeepUnreadButton(props: {
  keepUnread: boolean;
  setKeepUnread: (keep: boolean) => void;
}) {
  return (
    <Show
      when={props.keepUnread}
      fallback={
        <button class="btn hover:btn-soft hover:btn-info" onClick={() => props.setKeepUnread(true)}>
          Keep Unread
        </button>
      }
    >
      <button
        class="btn btn-soft btn-info hover:btn-soft hover:btn-error"
        onClick={() => props.setKeepUnread(false)}
      >
        <Check size={20} />
        Keep Unread
      </button>
    </Show>
  );
}
