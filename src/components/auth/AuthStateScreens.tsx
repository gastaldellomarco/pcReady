import type { ReactNode } from "react";

interface AuthLoadingScreenProps {
  message?: string;
}

interface AuthErrorScreenProps {
  message: string;
  onRetry: () => void;
  onSignOut: () => void;
}

interface MissingProfileScreenProps {
  onRetry: () => void;
  onSignOut: () => void;
}

// nosemgrep: shell_injection — false positive; this is a React layout wrapper, not a system command
function AuthStateShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--bg2)" }}
    >
      {children}
    </div>
  );
}

/**
 *
 */
export function AuthLoadingScreen({ message = "Caricamento…" }: AuthLoadingScreenProps) {
  return (
    <AuthStateShell>
      <div className="text-text3 text-sm">{message}</div>
    </AuthStateShell>
  );
}

/**
 *
 */
export function AuthErrorScreen({ message, onRetry, onSignOut }: AuthErrorScreenProps) {
  return (
    <AuthStateShell>
      <div className="pc-card max-w-md w-full p-6 text-center">
        <div className="text-[17px] font-bold mb-2" style={{ fontFamily: "var(--font-head)" }}>
          Accesso non disponibile
        </div>
        <p className="text-[13px] text-text3 mb-5">{message}</p>
        <div className="flex justify-center gap-2">
          <button className="pc-btn pc-btn-primary" onClick={onRetry}>
            Riprova
          </button>
          <button className="pc-btn pc-btn-ghost" onClick={onSignOut}>
            Esci
          </button>
        </div>
      </div>
    </AuthStateShell>
  );
}

/**
 *
 */
export function MissingProfileScreen({ onRetry, onSignOut }: MissingProfileScreenProps) {
  return (
    <AuthStateShell>
      <div className="pc-card max-w-md w-full p-6 text-center">
        <div className="text-[17px] font-bold mb-2" style={{ fontFamily: "var(--font-head)" }}>
          Profilo non disponibile
        </div>
        <p className="text-[13px] text-text3 mb-5">
          Non è stato possibile trovare il profilo associato alla sessione corrente.
        </p>
        <div className="flex justify-center gap-2">
          <button className="pc-btn pc-btn-primary" onClick={onRetry}>
            Riprova
          </button>
          <button className="pc-btn pc-btn-ghost" onClick={onSignOut}>
            Esci
          </button>
        </div>
      </div>
    </AuthStateShell>
  );
}
