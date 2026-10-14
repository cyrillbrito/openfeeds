import { EllipsisVertical } from 'lucide-react';
import type { ReactNode } from 'react';
import { Dropdown } from '~/components/Dropdown';
import type { ReadStatus } from './ReadStatusToggle';

interface ArticleListToolbarProps {
  leftContent: ReactNode;
  menuContent?: ReactNode;
  unreadCount?: number;
  totalCount?: number;
  readStatus?: ReadStatus;
}

export function ArticleListToolbar({
  leftContent,
  menuContent,
  unreadCount,
  totalCount,
  readStatus,
}: ArticleListToolbarProps) {
  const getCountLabel = () => {
    if (!readStatus) return null;

    if (readStatus === 'unread' && unreadCount !== undefined && unreadCount > 0) {
      return `• ${unreadCount} unread`;
    }

    if (readStatus === 'all' && totalCount !== undefined && totalCount > 0) {
      return `• ${totalCount} articles`;
    }

    return null;
  };

  const countLabel = getCountLabel();

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {leftContent}
          {countLabel && (
            <span className="text-base-content/60 ml-1 text-sm">{countLabel}</span>
          )}
        </div>

        {menuContent && (
          <Dropdown end btnClasses="btn-sm" btnContent={<EllipsisVertical size={20} />}>
            {menuContent}
          </Dropdown>
        )}
      </div>
      <div className="border-base-300/50 mt-2.5 border-t" />
    </div>
  );
}
