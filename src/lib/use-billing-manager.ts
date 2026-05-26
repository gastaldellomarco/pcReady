import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { UseMutationResult } from "@tanstack/react-query";
import { errorMessage } from "./errors";
import {
  listBundlePayments,
  type BundlePayment,
  type ClientBundleAssignment,
} from "./bundles";

export type PaymentDraft = {
  client_bundle_assignment_id: string;
  amount: string;
  currency: string;
  period_start: string;
  period_end: string;
  paid_at: string;
  status: "pending" | "paid" | "overdue" | "cancelled";
  notes: string;
};

export const emptyPaymentDraft: PaymentDraft = {
  client_bundle_assignment_id: "",
  amount: "0",
  currency: "EUR",
  period_start: "",
  period_end: "",
  paid_at: "",
  status: "pending",
  notes: "",
};

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

interface BillingMutations {
  create: UseMutationResult<unknown, Error, Partial<BundlePayment>>;
  remove: UseMutationResult<unknown, Error, string>;
}

interface UseBillingManagerOptions {
  canManage: boolean;
  userId: string | null;
  assignmentById: Map<string, ClientBundleAssignment>;
  mutations: BillingMutations;
}

export function useBillingManager(options: UseBillingManagerOptions) {
  const { t } = useTranslation("bundles");
  const { canManage, userId, assignmentById, mutations } = options;

  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>(emptyPaymentDraft);
  const [payments, setPayments] = useState<BundlePayment[]>([]);

  async function refreshPayments() {
    try {
      const feePayments = await listBundlePayments();
      setPayments(feePayments);
    } catch {
      setPayments([]);
    }
  }

  async function savePayment() {
    if (!canManage) {
      toast.error(
        t("errors.insufficientPermissions", "Permessi insufficienti"),
      );
      return;
    }
    const assignment = assignmentById.get(
      paymentDraft.client_bundle_assignment_id,
    );
    if (!assignment) {
      toast.error(
        t("errors.invalidAssignment", "Seleziona un'assegnazione valida"),
      );
      return;
    }
    try {
      await mutations.create.mutateAsync({
        client_bundle_assignment_id: assignment.id,
        client_id: assignment.client_id,
        amount: numberValue(paymentDraft.amount),
        currency: paymentDraft.currency || "EUR",
        period_start: paymentDraft.period_start || null,
        period_end: paymentDraft.period_end || null,
        paid_at: paymentDraft.paid_at || null,
        status: paymentDraft.status,
        notes: paymentDraft.notes.trim() || null,
        created_by: userId,
      });
      setPaymentDraft(emptyPaymentDraft);
      await refreshPayments();
      toast.success(
        t("success.paymentRegistered", "Pagamento registrato"),
      );
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          t("errors.savePayment", "Errore salvataggio pagamento"),
        ),
      );
    }
  }

  async function deletePayment(id: string) {
    if (!canManage) {
      toast.error(
        t("errors.insufficientPermissions", "Permessi insufficienti"),
      );
      return;
    }
    if (
      !window.confirm(
        t("billing.confirmDelete", "Eliminare questo pagamento?"),
      )
    )
      return;
    try {
      await mutations.remove.mutateAsync(id);
      await refreshPayments();
      toast.success(t("billing.deleted", "Pagamento eliminato"));
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          t("billing.deleteError", "Errore eliminazione pagamento"),
        ),
      );
    }
  }

  const busy = mutations.create.isPending || mutations.remove.isPending;

  return {
    paymentDraft,
    setPaymentDraft,
    payments,
    busy,
    refreshPayments,
    savePayment,
    deletePayment,
  };
}
