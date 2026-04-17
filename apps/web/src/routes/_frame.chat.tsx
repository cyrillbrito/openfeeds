import { createFileRoute, redirect } from '@tanstack/solid-router';

export const Route = createFileRoute('/_frame/chat')({
  beforeLoad: () => {
    throw redirect({ to: '/ai' });
  },
});
