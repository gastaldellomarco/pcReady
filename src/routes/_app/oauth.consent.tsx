import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Check, X, Shield, User } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { validateOAuthRequest, grantConsent, denyConsent, type OAuthValidationResult } from "@/lib/oauth-consent";
import { getScopeLabel, getScopeDescription, type OAuthScope } from "@/lib/oauth-scopes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const searchSchema = z.object({
  client_id: z.string(),
  redirect_uri: z.string().url(),
  scope: z.string(),
  state: z.string().optional(),
  response_type: z.string().optional(),
});

export const Route = createFileRoute("/_app/oauth/consent")({
  validateSearch: searchSchema,
  component: OAuthConsentPage,
});

function OAuthConsentPage() {
  const { session, profile, loading } = useAuth();
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
          accessToken: session.access_token,
          clientId: search.client_id,
          redirectUri: search.redirect_uri,
          scope: search.scope,
          state: search.state,
        });
        setValidation(result);
      } catch (error) {
        console.error("Validation error:", error);
        toast.error("Richiesta OAuth non valida");
        navigate({ to: "/dashboard", replace: true });
      } finally {
        setValidating(false);
      }
    }

    validate();
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
      });
      window.location.href = result.redirectUrl;
    } catch (error) {
      console.error("Grant error:", error);
      toast.error("Errore durante l'autorizzazione");
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
      });
      window.location.href = result.redirectUrl;
    } catch (error) {
      console.error("Deny error:", error);
      toast.error("Errore durante il rifiuto");
    } finally {
      setDenying(false);
    }
  };

  if (loading || validating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Validazione richiesta...</p>
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
              <h3 className="mt-2 text-lg font-semibold">Richiesta non valida</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                La richiesta di autorizzazione OAuth non è valida.
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
          <CardTitle className="text-2xl">PCReady</CardTitle>
          <CardDescription>
            Autorizzazione richiesta da un'applicazione esterna
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* App Info */}
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <h3 className="font-semibold text-lg">{validation.client.name}</h3>
            {validation.client.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {validation.client.description}
              </p>
            )}
          </div>

          {/* User Info */}
          <div className="flex items-center gap-3 p-4 border rounded-lg">
            <Avatar>
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{profile.full_name}</p>
              <p className="text-sm text-muted-foreground">{session.user.email}</p>
            </div>
          </div>

          {/* Scopes */}
          <div>
            <h4 className="font-semibold mb-3">Permessi richiesti</h4>
            <div className="space-y-2">
              {validation.requestedScopes.map((scope) => (
                <div key={scope} className="flex items-start gap-3 p-3 border rounded-lg">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">{getScopeLabel(scope)}</p>
                    <p className="text-sm text-muted-foreground">
                      {getScopeDescription(scope)}
                    </p>
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
              {denying ? "Annullamento..." : "Nega"}
            </Button>
            <Button
              onClick={handleGrant}
              disabled={denying || granting}
              className="flex-1"
            >
              {granting ? "Autorizzazione..." : "Autorizza"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Autorizzando, consenti all'applicazione di accedere ai tuoi dati come indicato sopra.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}