import { createLazyFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, X, Shield, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import {
  validateOAuthRequest,
  grantConsent,
  denyConsent,
  type OAuthValidationResult,
} from "@/lib/oauth-consent";
import { getScopeLabel, getScopeDescription } from "@/lib/oauth-scopes";

export const Route = createLazyFileRoute("/_app/oauth/consent")({
  component: OAuthConsentPage,
});

function OAuthConsentPage() {
  const { session, profile, loading } = useAuth();
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const search = useSearch({ from: "/_app/oauth/consent" });
  const validateRequest = useServerFn(validateOAuthRequest);
  const grant = useServerFn(grantConsent);
  const deny = useServerFn(denyConsent);

  const [validation, setValidation] = useState<OAuthValidationResult | null>(null);
  const [validating, setValidating] = useState(true);
  const [granting, setGranting] = useState(false);
  const [denying, setDenying] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/auth", replace: true });
      return;
    }

    if (!session?.access_token) return;

    async function validate() {
      try {
        const result = await validateRequest({
          accessToken: session?.access_token,
          clientId: search.client_id,
          redirectUri: search.redirect_uri,
          scope: search.scope,
          state: search.state,
        } as any);
        setValidation(result);
      } catch (error) {
        console.error("Validation error:", error);
        toast.error(t("oauth.invalidRequest", "Richiesta OAuth non valida"));
        navigate({ to: "/dashboard", replace: true });
      } finally {
        setValidating(false);
      }
    }

    validate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount/change of auth state
  }, [loading, session, search, navigate, validateRequest]);

  const handleGrant = async () => {
    if (!validation || !session?.access_token) return;

    setGranting(true);
    try {
      const result = await grant({
        accessToken: session.access_token,
        clientId: validation.client.clientId,
        redirectUri: search.redirect_uri,
        scopes: validation.requestedScopes,
        state: validation.state,
      } as any);
      window.location.href = result.redirectUrl;
    } catch (error) {
      console.error("Grant error:", error);
      toast.error(t("oauth.grantError", "Errore durante l'autorizzazione"));
    } finally {
      setGranting(false);
    }
  };

  const handleDeny = async () => {
    setDenying(true);
    try {
      const result = await deny({
        clientId: search.client_id,
        redirectUri: search.redirect_uri,
        state: search.state,
      } as any);
      window.location.href = result.redirectUrl;
    } catch (error) {
      console.error("Deny error:", error);
      toast.error(t("oauth.denyError", "Errore durante il rifiuto"));
    } finally {
      setDenying(false);
    }
  };

  if (loading || validating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">
            {t("oauth.validating", "Validazione richiesta...")}
          </p>
        </div>
      </div>
    );
  }

  if (!validation || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <X className="mx-auto h-12 w-12 text-destructive" />
              <h3 className="mt-2 text-lg font-semibold">
                {t("oauth.invalidTitle", "Richiesta non valida")}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(
                  "oauth.invalidDescription",
                  "La richiesta di autorizzazione OAuth non è valida.",
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">{t("oauth.appName", "PCReady")}</CardTitle>
          <CardDescription>
            {t("oauth.externalApp", "Autorizzazione richiesta da un'applicazione esterna")}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* App Info */}
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <h3 className="font-semibold text-lg">{validation.client.name}</h3>
            {validation.client.description && (
              <p className="text-sm text-muted-foreground mt-1">{validation.client.description}</p>
            )}
          </div>

          {/* User Info */}
          <div className="flex items-center gap-3 p-4 border rounded-lg">
            <Avatar>
              <AvatarFallback>
                <User className="size-4" />
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{profile.full_name}</p>
              <p className="text-sm text-muted-foreground">{session?.user?.email}</p>
            </div>
          </div>

          {/* Scopes */}
          <div>
            <h4 className="font-semibold mb-3">
              {t("oauth.requestedPermissions", "Permessi richiesti")}
            </h4>
            <div className="space-y-2">
              {validation.requestedScopes.map((scope) => (
                <div key={scope} className="flex items-start gap-3 p-3 border rounded-lg">
                  <Check className="size-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">{getScopeLabel(scope)}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {getScopeDescription(scope)}
                    </p>
                    <p className="text-[11px] font-mono text-muted-foreground/90 mt-1">{scope}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleDeny}
              disabled={denying || granting}
              className="flex-1"
            >
              {denying ? t("oauth.cancelling", "Annullamento...") : t("oauth.deny", "Nega")}
            </Button>
            <Button onClick={handleGrant} disabled={denying || granting} className="flex-1">
              {granting
                ? t("oauth.authorizing", "Autorizzazione...")
                : t("oauth.authorize", "Autorizza")}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            {t(
              "oauth.consentDescription",
              "Autorizzando, consenti all'applicazione di accedere ai tuoi dati come indicato sopra.",
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
