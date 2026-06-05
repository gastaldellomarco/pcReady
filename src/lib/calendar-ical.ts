import type { CalendarEvent } from "@/lib/queries/calendar";

// ---------------------------------------------------------------------------
// RFC 5545 helpers
// ---------------------------------------------------------------------------

/**
 * Escape special characters inside iCal text values (SUMMARY, DESCRIPTION …).
 * RFC 5545 §3.3.11: backslash, semicolon, comma and newlines must be escaped.
 */
function escapeICalText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Fold a single iCal property line to a maximum of 75 octets per RFC 5545 §3.1.
 * Continuation lines begin with a single SPACE character.
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line;

  const chunks: string[] = [];
  // First chunk: up to 75 chars
  chunks.push(line.substring(0, 75));
  let i = 75;
  // Subsequent chunks: 1 char taken by leading space, so 74 content chars each
  while (i < line.length) {
    chunks.push(" " + line.substring(i, i + 74));
    i += 74;
  }
  return chunks.join("\r\n");
}

/**
 * Build a single iCal property line, escape the value, fold and return it.
 */
function prop(name: string, value: string): string {
  return foldLine(`${name}:${value}`);
}

/**
 * Convert an ISO 8601 datetime string to the iCal UTC format: YYYYMMDDTHHMMSSZ
 */
function toICalDateTime(isoString: string): string {
  // toISOString() always produces YYYY-MM-DDTHH:mm:ss.mmmZ
  return new Date(isoString)
    .toISOString()
    .replace(/[-:]/g, "") // remove dashes and colons
    .replace(/\.\d{3}Z$/, "Z"); // drop milliseconds, keep Z
}

/**
 * Convert an ISO 8601 datetime string to the iCal date-only format: YYYYMMDD
 */
function toICalDate(isoString: string): string {
  return new Date(isoString).toISOString().slice(0, 10).replace(/-/g, "");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a valid iCalendar (.ics) string from a list of CalendarEvents.
 *
 * @param events       - Array of CalendarEvent objects to serialise.
 * @param calendarName - Optional display name for the calendar (X-WR-CALNAME).
 * @returns A string containing the full iCal document.
 */
export function exportToIcal(events: CalendarEvent[], calendarName = "PCReady Calendar"): string {
  const dtstamp = toICalDateTime(new Date().toISOString());

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    prop("PRODID", "-//PCReady//PCReady Calendar//IT"),
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    prop("X-WR-CALNAME", escapeICalText(calendarName)),
  ];

  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(prop("UID", `${event.id}@pcready`));
    lines.push(prop("DTSTAMP", dtstamp));

    // DTSTART / DTEND — all-day events use VALUE=DATE format
    if (event.all_day) {
      lines.push(foldLine(`DTSTART;VALUE=DATE:${toICalDate(event.start_at)}`));
      lines.push(foldLine(`DTEND;VALUE=DATE:${toICalDate(event.end_at)}`));
    } else {
      lines.push(prop("DTSTART", toICalDateTime(event.start_at)));
      lines.push(prop("DTEND", toICalDateTime(event.end_at)));
    }

    // SUMMARY
    lines.push(prop("SUMMARY", escapeICalText(event.title)));

    // DESCRIPTION — combine description + notes when both are present
    const descParts: string[] = [];
    if (event.description) descParts.push(event.description);
    if (event.notes) descParts.push(event.notes);
    if (descParts.length > 0) {
      lines.push(prop("DESCRIPTION", escapeICalText(descParts.join("\n\n"))));
    }

    // CATEGORIES
    lines.push(prop("CATEGORIES", event.event_type.toUpperCase()));

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  // RFC 5545 mandates CRLF line endings
  return lines.join("\r\n");
}

/**
 * Trigger a browser download of a .ics file containing the given events.
 *
 * @param events   - Array of CalendarEvent objects to export.
 * @param filename - Optional filename for the download (default: `pcready-calendar.ics`).
 */
export function downloadIcal(events: CalendarEvent[], filename = "pcready-calendar.ics"): void {
  const icsContent = exportToIcal(events);
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Release the object URL after a short delay to allow the download to start
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
