// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import OverflowTable from "@/components/ui/overflow-table";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

describe("DataTable (OverflowTable + shadcn Table) — Accessibilità", () => {
  it("non ha violazioni a11y con dati di esempio", async () => {
    const { container } = render(
      <OverflowTable>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Codice</TableHead>
              <TableHead scope="col">Cliente</TableHead>
              <TableHead scope="col">Stato</TableHead>
              <TableHead scope="col">Assegnatario</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <th scope="row" className="p-2 align-middle font-medium">TK-001</th>
              <TableCell>Mario Rossi</TableCell>
              <TableCell>Aperto</TableCell>
              <TableCell>Tech One</TableCell>
            </TableRow>
            <TableRow>
              <th scope="row" className="p-2 align-middle font-medium">TK-002</th>
              <TableCell>Luigi Bianchi</TableCell>
              <TableCell>In lavorazione</TableCell>
              <TableCell>Tech Two</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </OverflowTable>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("non ha violazioni a11y nello stato vuoto", async () => {
    const { container } = render(
      <OverflowTable>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Codice</TableHead>
              <TableHead scope="col">Cliente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={2}>Nessun ticket trovato</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </OverflowTable>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
