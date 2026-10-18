import type { CellObject, Sheet } from "write-excel-file/universal";
import type { SheetModel, XCell } from "./cellModel";

export function toCell(cell: XCell): CellObject | null {
  void cell;
  return null;
}

export function toLibrarySheet(model: SheetModel): Sheet<Blob> {
  return { sheet: model.name, data: [] };
}
