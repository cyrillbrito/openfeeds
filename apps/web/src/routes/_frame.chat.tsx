import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_frame/chat')({
  beforeLoad: () => {
    throw redirect({ to: '/ai' });
  },
});
