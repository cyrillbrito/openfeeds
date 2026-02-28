import { EllipsisVertical } from 'lucide-solid';
import { Show, type JSXElement } from 'solid-js';
import { Dropdown } from './Dropdown';
import type { ReadStatus } from './ReadStatusToggle';

interface ArticleListToolbarProps {
  leftContent: JSXElement;
  rightContent?: JSXElement;
  mobileMenuContent?: JSXElement;
  unreadCount?: number;
  totalCount?: number;
  readStatus?: ReadStatus;
}

export function ArticleListToolbar(props: ArticleListToolbarProps) {
  const getCountLabel = () => {
    if (!props.readStatus) return null;

    if (props.readStatus === 'unread' && props.unreadCount !== undefined && props.unreadCount > 0) {
      return `• ${props.unreadCount} unread`;
    }

    if (props.readStatus === 'all' && props.totalCount !== undefined && props.totalCount > 0) {
      return `• ${props.totalCount} articles`;
    }

    return null;
  };

  return (
    <div class="mb-4">
      <div class="flex items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2">
          {props.leftContent}
          <Show when={getCountLabel()}>
            <span class="text-base-content/60 ml-1 text-sm">{getCountLabel()}</span>
          </Show>
        </div>

        {/* Desktop: Show buttons directly */}
        <Show when={props.rightContent}>
          <div class="hidden flex-wrap items-center gap-2 md:flex">{props.rightContent}</div>
        </Show>

        {/* Mobile: Show dropdown menu */}
        <Show when={props.mobileMenuContent}>
          <div class="md:hidden">
            <Dropdown end btnClasses="btn-sm" btnContent={<EllipsisVertical size={20} />}>
              {props.mobileMenuContent}
            </Dropdown>
          </div>
        </Show>
      </div>
      <div class="border-base-300/50 mt-2.5 border-t" />
    </div>
  );
}
