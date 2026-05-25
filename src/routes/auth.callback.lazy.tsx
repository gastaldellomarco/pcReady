import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { initTheme } from "@/lib/theme";

export const Route = createLazyFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    initTheme();
  }, []);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const type = params.get("type");

    const finish = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error) {
        toast.error(error.message);
        navigate({ to: "/auth", replace: true });
        return;
      }

      if (type === "invite" || type === "recovery") {
        navigate({ to: "/auth/set-password", replace: true });
        return;
      }

      navigate({ to: data.session ? "/dashboard" : "/auth", replace: true });
    };

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") {
        navigate({ to: "/auth/set-password", replace: true });
      }
    });

    void finish();

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div
      className="flex min-h-screen items-center justify-center gap-2 text-sm text-text3"
      style={{ background: "var(--bg2)" }}
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      Accesso in corso...
    </div>
  );
}
