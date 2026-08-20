import { useLocation, useNavigate, useParams } from '@tanstack/react-router';
import { Menu, Plus } from 'lucide-react';
import { useEffect } from 'react';
import { useChatContext } from './chat-context.shared';
import { ChatInput } from './ChatInput';
import { ChatMessages } from './ChatMessages';
import { ChatTitleSwitcher } from './ChatTitleSwitcher';

/** Full-page AI chat — centered column with max-width */
export function ChatPage() {
  const chat = useChatContext();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams({ strict: false }) as { sessionId?: string };

  const sessionIdParam = params.sessionId;

  // Load session from URL param on mount / when param changes
  useEffect(() => {
    if (sessionIdParam && sessionIdParam !== chat.sessionId) {
      chat.loadSession(sessionIdParam);
    } else if (!sessionIdParam && chat.messages.length > 0) {
      chat.startNewChat();
    }
  }, [sessionIdParam]);

  // Update URL when session has messages but URL has no session ID
  useEffect(() => {
    const sessionId = chat.sessionId;
    const msgCount = chat.messages.length;
    if (msgCount > 0 && sessionId !== sessionIdParam && location.pathname.startsWith('/ai')) {
      void navigate({ to: '/ai/$sessionId', params: { sessionId }, replace: true });
    }
  }, [chat.sessionId, chat.messages.length, sessionIdParam, location.pathname]);

  const handleNewChat = () => {
    chat.startNewChat();
    void navigate({ to: '/ai', replace: true });
  };

  return (
    <div className="flex h-dvh flex-col" data-testid="chat-page">
      {/* Header */}
      <header className="bg-base-100 border-base-300 sticky top-0 z-10 border-b shadow">
        <div className="content-container flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <label htmlFor="my-drawer" className="btn btn-square btn-ghost lg:hidden">
              <Menu size={24} />
            </label>

            <ChatTitleSwitcher
              onSessionSelected={(id) => {
                void navigate({
                  to: '/ai/$sessionId',
                  params: { sessionId: id },
                  replace: true,
                });
              }}
            />
          </div>

          {chat.messages.length > 0 && (
            <button
              className="btn btn-ghost btn-sm btn-circle"
              onClick={handleNewChat}
              title="New chat"
            >
              <Plus size={18} />
            </button>
          )}
        </div>
      </header>

      {/* Chat area */}
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        <ChatMessages />
        <ChatInput autoFocus />
      </div>
    </div>
  );
}
