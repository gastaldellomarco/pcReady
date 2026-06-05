import { useServerFn } from "@tanstack/react-start";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { getAdminErrorMessage } from "@/lib/admin/admin-error-message";
import { getOAuthClientLifecycle, type OAuthClientLifecyclePayload } from "@/lib/oauth-consent";

/**
 *
 */
export function useAdminOAuthLifecycle(args: { accessToken: string | undefined }) {
  const { accessToken } = args;
  const lifecycleFn = useServerFn(getOAuthClientLifecycle);

  const [lifecycleOpenFor, setLifecycleOpenFor] = useState<string | null>(null);
  const [lifecycleData, setLifecycleData] = useState<OAuthClientLifecyclePayload | null>(null);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);

  const openLifecycle = useCallback(
    async (clientId: string) => {
      if (!accessToken) return;
      setLifecycleOpenFor(clientId);
      setLifecycleLoading(true);
      setLifecycleData(null);
      try {
        const payload = await lifecycleFn({ data: { accessToken, clientId } });
        setLifecycleData(payload);
      } catch (error) {
        toast.error(getAdminErrorMessage(error, "Impossibile caricare lo storico"));
        setLifecycleOpenFor(null);
      } finally {
        setLifecycleLoading(false);
      }
    },
    [accessToken, lifecycleFn],
  );

  const closeLifecycle = useCallback(() => {
    setLifecycleOpenFor(null);
    setLifecycleData(null);
  }, []);

  return {
    lifecycleOpenFor,
    lifecycleData,
    lifecycleLoading,
    openLifecycle,
    closeLifecycle,
  };
}
