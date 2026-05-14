import { QueryClient, QueryClientProvider, type DefaultOptions } from '@tanstack/react-query';
import React from 'react';

const defaultOptions: DefaultOptions = {
  queries: {
    retry: 1,
    staleTime: 1000 * 60, // 1 minute
    refetchOnWindowFocus: false,
  },
  mutations: {
    retry: 0,
  },
};

export const queryClient = new QueryClient({ defaultOptions });

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

export default QueryProvider;
