import React from "react";
import { Button } from "@/components/ui/button";

export function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="pc-card p-4 animate-pulse">
          <div className="h-4 bg-surface2 rounded w-1/3 mb-2" />
          <div className="h-3 bg-surface2 rounded w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function RouteError({ error }: { error: Error | unknown }) {
  const message = error && typeof error === "object" && "message" in (error as any) ? (error as any).message : String(error);
  return (
    <div className="pc-card p-6 text-center">
      <h2 className="font-semibold text-red-600 mb-2">Errore imprevisto</h2>
      <p className="text-text3 text-sm">{message}</p>
      <div className="mt-4">
        <Button onClick={() => window.location.reload()}>Ricarica pagina</Button>
      </div>
    </div>
  );
}

export default {};
