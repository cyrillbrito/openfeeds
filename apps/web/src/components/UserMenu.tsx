import { Link } from '@tanstack/react-router';
import { ChevronsUpDown, LogOut, Monitor, Moon, Settings, Sun } from 'lucide-react';
import { posthog } from 'posthog-js';
import { authClient } from '~/lib/auth-client';
import { invalidateSession } from '~/lib/session';
import { useTheme } from '~/providers/theme';
import { Dropdown } from './Dropdown';

async function handleSignOut() {
  try {
    await authClient.signOut();
    invalidateSession();
    posthog.reset();
    window.location.href = '/login';
  } catch (error) {
    posthog.captureException(error);
  }
}

export function UserMenu() {
  const { theme, setTheme, actualTheme } = useTheme();
  const session = authClient.useSession();

  const user = session.data?.user;

  const getThemeIcon = () => {
    if (theme === 'system') return <Monitor size={16} />;
    if (actualTheme === 'dracula') return <Moon size={16} />;
    return <Sun size={16} />;
  };

  const getThemeLabel = () => {
    if (theme === 'system') {
      const friendly = actualTheme === 'dracula' ? 'Dark' : 'Light';
      return `System (${friendly})`;
    }
    return theme.charAt(0).toUpperCase() + theme.slice(1);
  };

  const getUserInitials = () => {
    if (!user?.name) return 'U';
    return user.name
      .split(' ')
      .map((word: string) => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  };

  return (
    <>
      <Dropdown
        top
        btnClasses="btn-ghost btn-sm flex h-auto items-center gap-3 px-3 py-2 w-full"
        btnContent={
          <>
            <div className="avatar avatar-placeholder">
              <div className="bg-neutral text-neutral-content w-8 rounded-full">
                <span className="text-xs font-medium">{getUserInitials()}</span>
              </div>
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="text-base-content text-sm font-semibold">{user?.name || 'User'}</div>
              <div className="text-base-content-gray truncate text-xs" data-testid="user-email">
                {user?.email || ''}
              </div>
            </div>
            <ChevronsUpDown size={16} className="text-base-content-gray shrink-0" />
          </>
        }
      >
        {/* Settings */}
        <li>
          <Link to="/settings/general" className="flex items-center gap-3 px-4 py-2">
            <Settings size={16} />
            <span>Settings</span>
          </Link>
        </li>

        {/* Theme Submenu */}
        <li>
          <details>
            <summary className="flex items-center justify-between px-4 py-2">
              <div className="flex items-center gap-3">
                {getThemeIcon()}
                <span>{getThemeLabel()}</span>
              </div>
            </summary>
            <ul className="p-2">
              <li>
                <button
                  onClick={() => setTheme('light')}
                  className={`flex items-center gap-3 ${theme === 'light' ? 'active' : ''}`}
                >
                  <Sun size={16} />
                  Light
                </button>
              </li>
              <li>
                <button
                  onClick={() => setTheme('dark')}
                  className={`flex items-center gap-3 ${theme === 'dark' ? 'active' : ''}`}
                >
                  <Moon size={16} />
                  Dark
                </button>
              </li>
              <li>
                <button
                  onClick={() => setTheme('system')}
                  className={`flex items-center gap-3 ${theme === 'system' ? 'active' : ''}`}
                >
                  <Monitor size={16} />
                  System
                </button>
              </li>
            </ul>
          </details>
        </li>

        <div className="divider my-1"></div>

        {/* Sign Out */}
        <li>
          <button
            onClick={handleSignOut}
            className="text-error hover:text-error flex items-center gap-3 px-4 py-2"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </li>
      </Dropdown>
      <div className="mt-1 text-center">
        <span className="text-base-content/40 text-xs">Version {__APP_VERSION__}</span>
      </div>
    </>
  );
}
