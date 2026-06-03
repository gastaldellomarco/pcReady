import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getSupportContact } from "@/lib/app-settings";

/**
 *
 */
export function SupportContact({ prefix = "Problemi? Contatta" }: { prefix?: string }) {
  const loadSupportContact = useServerFn(getSupportContact);
  const [supportEmail, setSupportEmail] = useState("");

  useEffect(() => {
    let active = true;

    loadSupportContact()
      .then((result) => {
        if (active) setSupportEmail(result.support_email);
      })
      .catch(() => {
        if (active) setSupportEmail("");
      });

    return () => {
      active = false;
    };
  }, [loadSupportContact]);

  if (!supportEmail) return null;

  return (
    <p className="text-xs text-muted-foreground">
      {prefix}{" "}
      <a
        href={`mailto:${supportEmail}`}
        className="underline underline-offset-4 hover:text-foreground"
      >
        {supportEmail}
      </a>
    </p>
  );
}
