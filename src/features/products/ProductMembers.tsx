"use client";

import { useMemo } from "react";
import { ArrowRightLeft, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { MemberUndo } from "@/domain/settings/products";
import type { Product, ProductMember } from "@/domain/settings/types";
import { useLedger } from "@/features/dashboard/useLedger";
import { es } from "@/lib/copy/es";
import {
  memberMovedToast,
  memberRemovedToast,
  membersCount,
  moveMemberAria,
  productEmptiedToast,
  removeMemberAria,
} from "@/lib/copy/messages";
import { useSettingsStore } from "@/stores/settingsStore";
import { IconAction } from "./IconAction";
import { ProductPicker, type PickerGroup } from "./ProductPicker";

/** The undo toast stays six seconds (UI-SPEC defaults). */
const TOAST_DURATION_MS = 6000;

/**
 * Members sub-table of one product (D-14, D-15): Descripción, Proveedor, the count of loaded
 * lines and the actions. The count comes from every loaded invoice (the unfiltered ledger,
 * D-03), by the same supplier plus normalized description key the product stores; 0 means none
 * of the supplier's invoices is loaded and shows «Sin líneas cargadas». «Quitar» and «Mover a…»
 * apply at once with a «Deshacer» toast; the freed description counts as free again (D-15), and
 * a product left without members is deleted too (OQ5). `onChanged(deleted)` tells the list
 * whether the product is gone, so it can place focus. Descriptions and supplier names are XML
 * text: React text only (T-04-19).
 */
export function ProductMembers({
  product,
  onChanged,
}: {
  product: Product;
  onChanged?: (deleted: boolean) => void;
}) {
  const ledger = useLedger();
  const products = useSettingsStore((s) => s.products);
  const removeProductMember = useSettingsStore((s) => s.removeProductMember);
  const moveProductMember = useSettingsStore((s) => s.moveProductMember);
  const undoMemberChange = useSettingsStore((s) => s.undoMemberChange);
  const linesByKey = useMemo(
    () => new Map(collectItems(ledger).map((item) => [ruleMapKey(item.rfc, item.key), item.lines])),
    [ledger],
  );
  // The other products, alphabetical (es), with how many members each has.
  const groups = useMemo<PickerGroup[]>(() => {
    const collator = new Intl.Collator("es", { sensitivity: "base" });
    return [
      {
        heading: es.products.picker.groupHeading,
        options: products
          .filter((other) => other.id !== product.id)
          .sort((a, b) => collator.compare(a.name, b.name))
          .map((other) => ({
            id: other.id,
            label: other.name,
            caption: membersCount(other.members.length),
          })),
      },
    ];
  }, [products, product.id]);
  const columns = es.products.list.memberColumns;

  const showUndo = (message: string, undo: MemberUndo) => {
    toast(message, {
      duration: TOAST_DURATION_MS,
      action: {
        label: es.products.list.undo,
        onClick: () => {
          undoMemberChange(undo);
        },
      },
    });
  };

  const remove = (member: ProductMember) => {
    const undo = removeProductMember(product.id, ruleMapKey(member.rfc, member.key));
    if (undo === null) return;
    const deleted = undo.kind === "product";
    showUndo(
      deleted
        ? productEmptiedToast(product.name)
        : memberRemovedToast(member.description, product.name),
      undo,
    );
    onChanged?.(deleted);
  };

  const move = (member: ProductMember, toId: string) => {
    const target = products.find((other) => other.id === toId);
    const undo = moveProductMember(product.id, ruleMapKey(member.rfc, member.key), toId);
    if (undo === null || target === undefined) return;
    const deleted = undo.kind === "product";
    showUndo(
      deleted
        ? productEmptiedToast(product.name)
        : memberMovedToast(member.description, target.name),
      undo,
    );
    onChanged?.(deleted);
  };

  return (
    <Table className="min-w-[640px]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="font-semibold">{columns.description}</TableHead>
          <TableHead className="font-semibold">{columns.supplier}</TableHead>
          <TableHead className="text-right font-semibold">{columns.lines}</TableHead>
          <TableHead className="w-24">
            <span className="sr-only">{columns.actions}</span>
          </TableHead>
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
              <TableCell className="w-24">
                <div className="flex items-center justify-end">
                  <ProductPicker
                    tooltip={moveMemberAria(member.description)}
                    groups={groups}
                    onPick={(toId) => {
                      move(member, toId);
                    }}
                    trigger={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={moveMemberAria(member.description)}
                        className="size-9 max-sm:size-11"
                      >
                        <ArrowRightLeft aria-hidden="true" />
                      </Button>
                    }
                  />
                  <IconAction
                    label={removeMemberAria(member.description)}
                    onClick={() => {
                      remove(member);
                    }}
                  >
                    <Unlink aria-hidden="true" />
                  </IconAction>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
