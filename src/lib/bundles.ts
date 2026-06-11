import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  BUNDLE_QUERY_KEYS,
  listBundles,
  createBundle,
  updateBundle,
  deactivateBundle,
  listClientBundleAssignments,
  createClientBundleAssignment,
  updateClientBundleAssignment,
  cancelClientBundleAssignment,
  deleteClientBundleAssignment,
  listBundleUsageSummaries,
  listBundleMonthlyUsage,
  listBundlePayments,
  createBundlePayment,
  deleteBundlePayment,
  fetchTicketBundleInfo,
  type BundleBillingType,
  type BundleTicketPriority,
  type BundleStatus,
  type AssistanceBundle,
  type BundleClient,
  type ClientBundleAssignment,
  type BundleUsageSummary,
  type BundlePayment,
  type BundleUsageEntry,
  type TicketBundleInfo,
  BILLING_TYPE_LABEL,
  BUNDLE_PRIORITY_LABEL,
  BUNDLE_STATUS_LABEL,
  formatBundleMoney,
  formatBundleHours,
  formatBundleVisits,
  bundleUsageTone,
  computeEndDate,
} from "@/lib/data/bundles";

// ── Re-export types ──────────────────────────────────────────────────

export type {
  BundleBillingType,
  BundleTicketPriority,
  BundleStatus,
  AssistanceBundle,
  BundleClient,
  ClientBundleAssignment,
  BundleUsageSummary,
  BundlePayment,
  BundleUsageEntry,
  TicketBundleInfo,
};

// ── Re-export constants & formatters ─────────────────────────────────

export {
  BILLING_TYPE_LABEL,
  BUNDLE_PRIORITY_LABEL,
  BUNDLE_STATUS_LABEL,
  BUNDLE_QUERY_KEYS,
  formatBundleMoney,
  formatBundleHours,
  formatBundleVisits,
  bundleUsageTone,
  computeEndDate,
};

// ── Re-export raw fetch/mutation functions ───────────────────────────

export {
  listBundles,
  createBundle,
  updateBundle,
  deactivateBundle,
  listClientBundleAssignments,
  createClientBundleAssignment,
  updateClientBundleAssignment,
  cancelClientBundleAssignment,
  deleteClientBundleAssignment,
  listBundleUsageSummaries,
  listBundleMonthlyUsage,
  listBundlePayments,
  createBundlePayment,
  deleteBundlePayment,
  fetchTicketBundleInfo,
};

// ── Internal invalidator ─────────────────────────────────────────────

function useInvalidateBundles() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: BUNDLE_QUERY_KEYS.all });
}

// ── Hooks ────────────────────────────────────────────────────────────

export function useBundles(includeInactive = true) {
  return useQuery({
    queryKey: BUNDLE_QUERY_KEYS.list(includeInactive),
    queryFn: () => listBundles(includeInactive),
  });
}

export function useBundleAssignments(clientId?: string | null) {
  return useQuery({
    queryKey: BUNDLE_QUERY_KEYS.assignments(clientId),
    queryFn: () => listClientBundleAssignments(clientId),
  });
}

export function useBundleUsageSummaries(clientId?: string | null) {
  return useQuery({
    queryKey: BUNDLE_QUERY_KEYS.usageSummaries(clientId),
    queryFn: () => listBundleUsageSummaries(clientId),
  });
}

export function useCreateBundleMutation() {
  const invalidate = useInvalidateBundles();
  return useMutation({ mutationFn: createBundle, onSuccess: invalidate });
}

export function useUpdateBundleMutation() {
  const invalidate = useInvalidateBundles();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AssistanceBundle> }) =>
      updateBundle(id, data),
    onSuccess: invalidate,
  });
}

export function useDeactivateBundleMutation() {
  const invalidate = useInvalidateBundles();
  return useMutation({ mutationFn: deactivateBundle, onSuccess: invalidate });
}

export function useCreateBundleAssignmentMutation() {
  const invalidate = useInvalidateBundles();
  return useMutation({ mutationFn: createClientBundleAssignment, onSuccess: invalidate });
}

export function useUpdateBundleAssignmentMutation() {
  const invalidate = useInvalidateBundles();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ClientBundleAssignment> }) =>
      updateClientBundleAssignment(id, data),
    onSuccess: invalidate,
  });
}

export function useCancelBundleAssignmentMutation() {
  const invalidate = useInvalidateBundles();
  return useMutation({ mutationFn: cancelClientBundleAssignment, onSuccess: invalidate });
}

export function useDeleteBundleAssignmentMutation() {
  const invalidate = useInvalidateBundles();
  return useMutation({ mutationFn: deleteClientBundleAssignment, onSuccess: invalidate });
}

export function useCreateBundlePaymentMutation() {
  const invalidate = useInvalidateBundles();
  return useMutation({ mutationFn: createBundlePayment, onSuccess: invalidate });
}

export function useDeleteBundlePaymentMutation() {
  const invalidate = useInvalidateBundles();
  return useMutation({ mutationFn: deleteBundlePayment, onSuccess: invalidate });
}
