export function StatusTimeline({ history }: { history: any[] }) {
  if (!history.length) {
    return <p className="text-sm text-muted-foreground">Storico stati non ancora disponibile.</p>;
  }

  return (
    <ol className="space-y-3">
      {history.map((item, index) => (
        <li key={`${item.created_at}-${index}`} className="rounded-md border bg-card p-3">
          <p className="text-sm font-medium">{item.change_type || "Aggiornamento"}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(item.created_at).toLocaleString("it-IT")}
          </p>
        </li>
      ))}
    </ol>
  );
}
