import { useMutation, useQuery } from '@tanstack/solid-query';
import { queryClient } from '~/query-client';
import { createAuthClient } from 'better-auth/solid';

export const authClient = createAuthClient();

// Shareable query options for user session
export const userQueryOptions = {
  queryKey: ['auth', 'user'],
  queryFn: () => authClient.getSession().then((d) => d.data?.user || null),
  staleTime: 30_000, // 30 seconds
};

export function useUser() {
  return useQuery(() => userQueryOptions);
}

export function fetchUser() {
  return queryClient.ensureQueryData(userQueryOptions);
}

// Auth mutations that invalidate the auth key to make sure it's all updated
export function useLogin() {
  return useMutation(() => ({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authClient.signIn.email(
        {
          email,
          password,
        },
        { throw: true },
      ),
    onSuccess: async () => {
      // Refetch user data immediately after login to ensure session is available
      await queryClient.refetchQueries({ queryKey: ['auth'] });
    },
  }));
}

export function useRegister() {
  return useMutation(() => ({
    mutationFn: ({ email, password, name }: { email: string; password: string; name: string }) =>
      authClient.signUp.email(
        {
          email,
          password,
          name,
        },
        { throw: true },
      ),
    onSuccess: async () => {
      // Refetch user data immediately after registration (auto-login)
      await queryClient.refetchQueries({ queryKey: ['auth', 'user'] });
    },
  }));
}

export function useLogout() {
  return useMutation(() => ({
    mutationFn: async () => {
      const result = await authClient.signOut();

      if (result.error) {
        throw new Error(result.error.message);
      }

      return result;
    },
    onSuccess: () => {
      // Force full page reload to completely clear all state
      window.location.href = '/signin';
    },
  }));
}
