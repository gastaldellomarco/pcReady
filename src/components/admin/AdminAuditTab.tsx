import { FileText, Search, Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import { useAdminAudit } from "@/hooks/useAdminAudit";

export function AdminAuditTab() {
  const { session, isAdmin } = useAuth();
  const accessToken = session?.access_token;
  const {
    auditEntries,
    auditTotal,
    auditPage,
    auditFilters,
    setAuditFilters,
    loadingAudit,
    loadAudit,
    handleExportAudit,
    auditPageSize,
  } = useAdminAudit({ accessToken, isAdmin });

  return (
<TabsContent value="audit" className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Log di Audit
            </CardTitle>
            <CardDescription>Visualizza le azioni amministrative e di sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Filtra per utente..."
                  value={auditFilters.user || ""}
                  onChange={(e) => setAuditFilters({ ...auditFilters, user: e.target.value })}
                  className="max-w-[200px]"
                />
                <select
                  className="pc-input max-w-[150px]"
                  value={auditFilters.actionType || ""}
                  onChange={(e) => setAuditFilters({ ...auditFilters, actionType: e.target.value })}
                >
                  <option value="">Tutti i tipi</option>
                  <option value="sys">Sistema</option>
                  <option value="auto">Automatico</option>
                  <option value="user">Utente</option>
                </select>
                <Input
                  type="date"
                  value={auditFilters.dateFrom || ""}
                  onChange={(e) => setAuditFilters({ ...auditFilters, dateFrom: e.target.value })}
                  className="max-w-[150px]"
                />
                <Input
                  type="date"
                  value={auditFilters.dateTo || ""}
                  onChange={(e) => setAuditFilters({ ...auditFilters, dateTo: e.target.value })}
                  className="max-w-[150px]"
                />
                <Button onClick={() => loadAudit(1, auditFilters)} variant="outline">
                  <Search className="w-4 h-4 mr-2" />
                  Filtra
                </Button>
                <Button onClick={handleExportAudit} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Esporta CSV
                </Button>
              </div>

              {loadingAudit ? (
                <p className="text-center py-4 text-muted-foreground">Caricamento log...</p>
              ) : (auditEntries ?? []).length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">Nessuna attività trovata</p>
              ) : (
                <div className="space-y-2">
                  {auditEntries.map((entry) => (
                    <div key={entry.id} className="border rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm">{entry.message}</p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span>{entry.actor_name}</span>
                            <span>{new Date(entry.created_at).toLocaleString("it-IT")}</span>
                            <Badge variant="outline">
                              {entry.type === "sys"
                                ? "Sistema"
                                : entry.type === "auto"
                                  ? "Automatico"
                                  : "Utente"}
                            </Badge>
                            {entry.ticket_id && <span>Ticket: {entry.ticket_id}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center justify-between pt-4">
                    <span className="text-sm text-muted-foreground">
                      Pagina {auditPage} di {Math.ceil(auditTotal / auditPageSize)} ({auditTotal}{" "}
                      totale)
                    </span>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => loadAudit(auditPage - 1, auditFilters)}
                        disabled={auditPage <= 1}
                        variant="outline"
                        size="sm"
                      >
                        Precedente
                      </Button>
                      <Button
                        onClick={() => loadAudit(auditPage + 1, auditFilters)}
                        disabled={auditPage >= Math.ceil(auditTotal / auditPageSize)}
                        variant="outline"
                        size="sm"
                      >
                        Successivo
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>


  );
}

