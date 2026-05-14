import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { OAuthClientSchema, type OAuthClientInput } from "@/lib/schemas";
import { getAdminErrorMessage } from "@/lib/admin/admin-error-message";
import { listOAuthClients, createOAuthClient, type OAuthClientCreated, type OAuthClientInfo } from "@/lib/oauth-consent";
import type { OAuthScope } from "@/lib/oauth-scopes";

export function useAdminOAuthClients(args: { accessToken: string | undefined; isAdmin: boolean }) {
  const { accessToken, isAdmin } = args;
  const listClients = useServerFn(listOAuthClients);
  const createClient = useServerFn(createOAuthClient);

  const [clients, setClients] = useState<OAuthClientInfo[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [createClientBusy, setCreateClientBusy] = useState(false);
  const [oauthCreated, setOauthCreated] = useState<
    (OAuthClientCreated & { exampleRedirectUri: string }) | null
  >(null);

  const oauthForm = useForm<OAuthClientInput>({
    resolver: zodResolver(OAuthClientSchema),
    mode: "onChange",
    defaultValues: { name: "", description: null, redirectUrisRaw: "", scopesAllowed: [] },
  });

  const loadClients = useCallback(async () => {
    if (!accessToken || !isAdmin) return;
    setLoadingClients(true);
    try {
      const data = await listClients({ data: { accessToken } });
      setClients(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(getAdminErrorMessage(error, "Impossibile caricare i client OAuth"));
    } finally {
      setLoadingClients(false);
    }
  }, [accessToken, isAdmin, listClients]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const createNewClient = oauthForm.handleSubmit(async (vals) => {
    if (!accessToken) return;
    setCreateClientBusy(true);
    try {
      const redirectUris = (vals.redirectUrisRaw as string)
        .split("\n")
        .map((r) => r.trim())
        .filter(Boolean);
      const created = await createClient({
        data: {
          accessToken,
          name: vals.name,
          description: (vals.description as string) ?? undefined,
          redirectUris,
          scopesAllowed: (vals.scopesAllowed || []) as OAuthScope[],
        },
      });
      toast.success("Client OAuth creato");
      setOauthCreated({
        ...created,
        exampleRedirectUri: redirectUris[0] ?? "",
      });
      oauthForm.reset();
      await loadClients();
    } catch (error) {
      toast.error(getAdminErrorMessage(error, "Creazione client non riuscita"));
    } finally {
      setCreateClientBusy(false);
    }
  });

  async function copyOAuthField(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiato negli appunti`);
    } catch {
      toast.error("Impossibile copiare. Seleziona il testo manualmente.");
    }
  }

  return {
    clients,
    loadingClients,
    oauthForm,
    createNewClient,
    createClientBusy,
    oauthCreated,
    setOauthCreated,
    copyOAuthField,
    loadClients,
  };
}
