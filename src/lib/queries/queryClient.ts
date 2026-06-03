import { QueryClient, QueryClientProvider, type DefaultOptions } from "@tanstack/react-query";
import React from "react";
import { LIST_QUERY_GC_MS, LIST_QUERY_STALE_MS } from "./list-config";

const defaultOptions: DefaultOptions = {
  queries: {
    retry: 1,
    staleTime: LIST_QUERY_STALE_MS,
    gcTime: LIST_QUERY_GC_MS,
    refetchOnWindowFocus: false,
  },
  mutations: {
    retry: 0,
  },
};

export const queryClient = new QueryClient({ defaultOptions });

/**
 *
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

export default QueryProvider;
