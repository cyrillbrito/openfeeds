import { Link } from '@tanstack/solid-router';
import ChevronsUpDownIcon from 'lucide-solid/icons/chevrons-up-down';
import LogOutIcon from 'lucide-solid/icons/log-out';
import MonitorIcon from 'lucide-solid/icons/monitor';
import MoonIcon from 'lucide-solid/icons/moon';
import SettingsIcon from 'lucide-solid/icons/settings';
import SunIcon from 'lucide-solid/icons/sun';
import { Suspense } from 'solid-js';
import { authClient } from '~/lib/auth-client';
import { useTheme } from '~/providers/theme';
import { Dropdown } from './Dropdown';

export function UserMenu() {
  const { theme, setTheme, actualTheme } = useTheme();
  const session = authClient.useSession();

  const user = () => session().data?.user;

  const getThemeIcon = () => {
    const current = theme();
    const actual = actualTheme();

    if (current === 'system') {
      return <MonitorIcon size={16} />;
    }

    if (actual === 'dracula') {
      return <MoonIcon size={16} />;
    }

    return <SunIcon size={16} />;
  };

  const getThemeLabel = () => {
    const current = theme();
    if (current === 'system') return `System (${actualTheme()})`;
    return current.charAt(0).toUpperCase() + current.slice(1);
  };

  const getUserInitials = () => {
    const u = user();
    if (!u?.name) return 'U';
    return u.name
      .split(' ')
      .map((word: string) => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  };

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      window.location.href = '/signin';
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <Suspense fallback={<div class="h-13" />}>
      <Dropdown
        top
        btnClasses="btn-ghost btn-sm flex h-auto items-center gap-3 px-3 py-2 w-full"
        btnContent={
          <>
            <div class="avatar avatar-placeholder">
              <div class="bg-neutral text-neutral-content w-8 rounded-full">
                <span class="text-xs font-medium">{getUserInitials()}</span>
              </div>
            </div>
            <div class="min-w-0 flex-1 text-left">
              <div class="text-base-content text-sm font-semibold">{user()?.name || 'User'}</div>
              <div class="text-base-content-gray truncate text-xs" data-testid="user-email">
                {user()?.email || ''}
              </div>
            </div>
            <ChevronsUpDownIcon size={16} class="text-base-content-gray shrink-0" />
          </>
        }
      >
        {/* Settings */}
        <li>
          <Link to="/settings" class="flex items-center gap-3 px-4 py-2">
            <SettingsIcon size={16} />
            <span>Settings</span>
          </Link>
        </li>

        {/* Theme Submenu */}
        <li>
          <details>
            <summary class="flex items-center justify-between px-4 py-2">
              <div class="flex items-center gap-3">
                {getThemeIcon()}
                <span>{getThemeLabel()}</span>
              </div>
            </summary>
            <ul class="p-2">
              <li>
                <button
                  onClick={() => setTheme('light')}
                  class={`flex items-center gap-3 ${theme() === 'light' ? 'active' : ''}`}
                >
                  <SunIcon size={16} />
                  Light
                </button>
              </li>
              <li>
                <button
                  onClick={() => setTheme('dark')}
                  class={`flex items-center gap-3 ${theme() === 'dark' ? 'active' : ''}`}
                >
                  <MoonIcon size={16} />
                  Dark
                </button>
              </li>
              <li>
                <button
                  onClick={() => setTheme('system')}
                  class={`flex items-center gap-3 ${theme() === 'system' ? 'active' : ''}`}
                >
                  <MonitorIcon size={16} />
                  System
                </button>
              </li>
            </ul>
          </details>
        </li>

        <div class="divider my-1"></div>

        {/* Sign Out */}
        <li>
          <button
            onClick={handleSignOut}
            class="text-error hover:text-error flex items-center gap-3 px-4 py-2"
          >
            <LogOutIcon size={16} />
            <span>Sign Out</span>
          </button>
        </li>

        {/* Version */}
        <li class="menu-title px-4 py-2">
          <span class="text-base-content/40 text-xs">Version v0.24.12</span>
        </li>
      </Dropdown>
    </Suspense>
  );
}
