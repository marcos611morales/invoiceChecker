"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { collectItems } from "@/domain/llm/candidates";
import { ruleMapKey } from "@/domain/settings/normalize";
import type { Product } from "@/domain/settings/types";
import { useLedger } from "@/features/dashboard/useLedger";
import { es } from "@/lib/copy/es";

/**
 * Members sub-table of one product (D-14): Descripción, Proveedor and the count of loaded
 * lines. The count comes from every loaded invoice (the unfiltered ledger, D-03), by the
 * same supplier plus normalized description key the product stores; 0 means none of the
 * supplier's invoices is loaded and shows «Sin líneas cargadas». Descriptions and supplier
 * names are XML text: React text only (T-04-19).
 */
export function ProductMembers({ product }: { product: Product }) {
  const ledger = useLedger();
  const linesByKey = useMemo(
    () => new Map(collectItems(ledger).map((item) => [ruleMapKey(item.rfc, item.key), item.lines])),
    [ledger],
  );
  const columns = es.products.list.memberColumns;
  return (
    <Table className="min-w-[640px]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="font-semibold">{columns.description}</TableHead>
          <TableHead className="font-semibold">{columns.supplier}</TableHead>
          <TableHead className="text-right font-semibold">{columns.lines}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {product.members.map((member) => {
          const key = ruleMapKey(member.rfc, member.key);
          const lines = linesByKey.get(key) ?? 0;
          return (
            <TableRow key={key} className="min-h-11 hover:bg-transparent">
              <TableCell className="max-w-[320px] whitespace-normal break-words">
                {member.description}
              </TableCell>
              <TableCell className="max-w-[240px] whitespace-normal break-words">
                {member.supplierName}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {lines === 0 ? <Badge variant="outline">{es.products.noLines}</Badge> : lines}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
