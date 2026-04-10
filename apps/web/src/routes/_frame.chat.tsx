import { createFileRoute } from '@tanstack/solid-router';
import { ChatPage } from '~/components/chat/ChatPage';

export const Route = createFileRoute('/_frame/chat')({
  component: ChatPage,
});
