import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { OAuthClientSchema, type OAuthClientInput } from "@/lib/schemas";
import { getAdminErrorMessage } from "@/lib/admin/admin-error-message";
import {
  listOAuthClients,
  createOAuthClient,
  setOAuthClientStatus,
  rotateOAuthClientSecret,
  type OAuthClientCreated,
  type OAuthClientInfo,
  type OAuthClientStatus,
} from "@/lib/oauth-consent";
import type { OAuthScope } from "@/lib/oauth-scopes";
import { useAdminOAuthLifecycle } from "@/hooks/useAdminOAuthLifecycle";

export function useAdminOAuthClients(args: { accessToken: string | undefined; isAdmin: boolean }) {
  const { accessToken, isAdmin } = args;
  const listClients = useServerFn(listOAuthClients);
  const createClient = useServerFn(createOAuthClient);
  const setStatusFn = useServerFn(setOAuthClientStatus);
  const rotateFn = useServerFn(rotateOAuthClientSecret);

  const [clients, setClients] = useState<OAuthClientInfo[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [createClientBusy, setCreateClientBusy] = useState(false);
  const [oauthCreated, setOauthCreated] = useState<
    (OAuthClientCreated & { exampleRedirectUri: string }) | null
  >(null);
  const [rotatedSecret, setRotatedSecret] = useState<
    (OAuthClientCreated & { exampleRedirectUri: string }) | null
  >(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const lifecycle = useAdminOAuthLifecycle({ accessToken });

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

  async function updateClientStatus(clientId: string, nextStatus: OAuthClientStatus) {
    if (!accessToken) return;
    setActionBusyId(clientId);
    try {
      await setStatusFn({ data: { accessToken, clientId, nextStatus } });
      toast.success(
        nextStatus === "active"
          ? "Client riattivato"
          : nextStatus === "revoked"
            ? "Client revocato"
            : "Client disattivato",
      );
      await loadClients();
    } catch (error) {
      toast.error(getAdminErrorMessage(error, "Aggiornamento stato non riuscito"));
    } finally {
      setActionBusyId(null);
    }
  }

  async function rotateClientSecret(clientId: string, exampleRedirectUri: string) {
    if (!accessToken) return;
    setActionBusyId(clientId);
    try {
      const res = await rotateFn({ data: { accessToken, clientId } });
      const meta = clients.find((c) => c.clientId === clientId);
      toast.success("Secret ruotato: copia il nuovo valore ora.");
      setRotatedSecret({
        clientId: res.clientId,
        clientSecret: res.clientSecret,
        name: meta?.name ?? res.clientId,
        description: meta?.description,
        scopesAllowed: meta?.scopesAllowed ?? [],
        redirectUris: meta?.redirectUris ?? [],
        status: meta?.status ?? "active",
        lastUsedAt: meta?.lastUsedAt ?? null,
        createdAt: meta?.createdAt ?? new Date().toISOString(),
        exampleRedirectUri: exampleRedirectUri || (meta?.redirectUris[0] ?? ""),
      });
      await loadClients();
    } catch (error) {
      toast.error(getAdminErrorMessage(error, "Rotazione secret non riuscita"));
    } finally {
      setActionBusyId(null);
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
    rotatedSecret,
    setRotatedSecret,
    copyOAuthField,
    loadClients,
    updateClientStatus,
    rotateClientSecret,
    actionBusyId,
    lifecycle,
  };
}
