import { EllipsisVertical } from 'lucide-solid';
import { Show, type JSXElement } from 'solid-js';
import { Dropdown } from '~/components/Dropdown';
import type { ReadStatus } from './ReadStatusToggle';

interface ArticleListToolbarProps {
  leftContent: JSXElement;
  menuContent?: JSXElement;
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

        <Show when={props.menuContent}>
          <Dropdown end btnClasses="btn-sm" btnContent={<EllipsisVertical size={20} />}>
            {props.menuContent}
          </Dropdown>
        </Show>
      </div>
      <div class="border-base-300/50 mt-2.5 border-t" />
    </div>
  );
}
