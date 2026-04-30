import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/docs")({
  head: () => ({
    meta: [
      { title: "API Docs - PCReady" },
      { name: "description", content: "Documentazione OpenAPI e console Swagger UI." },
    ],
  }),
  component: ApiDocsPage,
});

function ApiDocsPage() {
  const { loading, profile, session } = useAuth();
  const navigate = useNavigate();
  const canViewDocs = profile?.role === "admin" || profile?.role === "tech";
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

  useEffect(() => {
    if (!loading && profile && !canViewDocs) navigate({ to: "/dashboard", replace: true });
  }, [canViewDocs, loading, navigate, profile]);

  if (!canViewDocs) {
    return (
      <div className="pc-card p-6 text-sm text-text3">
        Documentazione API disponibile solo per admin e tecnici.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="pc-card px-5 py-4 flex flex-wrap items-center gap-3">
        <div
          className="w-9 h-9 rounded-[8px] flex items-center justify-center"
          style={{ background: "var(--accent2)", color: "var(--accent)" }}
        >
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div>
          <div className="font-bold text-[15px]" style={{ fontFamily: "var(--font-head)" }}>
            API Docs
          </div>
          <div className="text-[12px] text-text3">
            Spec OpenAPI manuale con Bearer/JWT e header apikey Supabase.
          </div>
        </div>
        <span className="ml-auto text-[11px] text-text3 font-mono">/openapi/openapi.yaml</span>
      </div>

      <div className="pc-card overflow-hidden api-docs-shell">
        <SwaggerUI
          url="/openapi/openapi.yaml"
          docExpansion="list"
          defaultModelsExpandDepth={1}
          persistAuthorization
          requestInterceptor={(request) => {
            request.headers = request.headers || {};
            if (anonKey && !request.headers.apikey) request.headers.apikey = anonKey;
            if (session?.access_token && !request.headers.Authorization) {
              request.headers.Authorization = `Bearer ${session.access_token}`;
            }
            return request;
          }}
        />
      </div>
      <style>{swaggerOverrides}</style>
    </div>
  );
}

const swaggerOverrides = `
  .api-docs-shell .swagger-ui {
    color: var(--text);
    font-family: var(--font-body);
  }
  .api-docs-shell .swagger-ui .info {
    margin: 22px 0;
  }
  .api-docs-shell .swagger-ui .info .title {
    color: var(--text);
    font-family: var(--font-head);
    font-size: 24px;
  }
  .api-docs-shell .swagger-ui .scheme-container,
  .api-docs-shell .swagger-ui .opblock,
  .api-docs-shell .swagger-ui .models {
    box-shadow: none;
    border-color: var(--border);
  }
  .api-docs-shell .swagger-ui .scheme-container {
    background: var(--surface2);
    padding: 14px 18px;
  }
  .api-docs-shell .swagger-ui .opblock-tag {
    border-bottom-color: var(--border);
    color: var(--text);
    font-family: var(--font-head);
  }
  .api-docs-shell .swagger-ui .opblock .opblock-summary {
    border-color: var(--border);
  }
  .api-docs-shell .swagger-ui .btn.authorize {
    border-color: var(--accent);
    color: var(--accent);
  }
`;
