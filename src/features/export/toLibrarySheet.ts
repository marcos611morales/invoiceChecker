/**
 * Maps the library-independent sheet model of Plan 03-12 to the cells and sheets of the
 * spreadsheet writer (XLS-03). Only types are imported from the writer here; the library
 * itself is loaded lazily by `writeWorkbook`.
 *
 * Guards (Pitfall 3): a number that is not finite and a date that is not valid would be
 * written as literal `NaN` or `Infinity` and corrupt the file, so they become empty cells.
 * Text is always a String cell with the text format, so a value such as "=1+1" is shown
 * as typed and never evaluated.
 */
import type { CellObject, Row, Sheet, SheetData } from "write-excel-file/universal";
import type { SheetColumn, SheetModel, XCell } from "./cellModel";

const HEADER_FILL = "#E5E5E5";
const DATE_FORMAT = "dd/mm/yyyy";
const TEXT_FORMAT = "@";

/** One model cell as a writer cell; null is an empty cell. */
export function toCell(cell: XCell): CellObject | null {
  switch (cell.kind) {
    case "text":
      return cell.value === ""
        ? null
        : { value: cell.value, type: String, format: TEXT_FORMAT };
    case "number": {
      // Number("") is 0, which would turn a blank into an amount; blanks stay empty.
      if (cell.value.trim() === "") return null;
      const value = Number(cell.value);
      return Number.isFinite(value) ? { value, type: Number, format: cell.format } : null;
    }
    case "date":
      return cell.value === null || Number.isNaN(cell.value.getTime())
        ? null
        : { value: cell.value, type: Date, format: DATE_FORMAT };
    case "empty":
      return null;
  }
}

/** The cell with the Total row style (bold on the header fill); an empty cell keeps the fill. */
function totalStyled(cell: CellObject | null): CellObject {
  return { ...cell, fontWeight: "bold", backgroundColor: HEADER_FILL };
}

function headerCell(column: SheetColumn): CellObject {
  return {
    value: column.header,
    type: String,
    fontWeight: "bold",
    backgroundColor: HEADER_FILL,
    wrap: true,
  };
}

function bodyRow(cells: readonly XCell[], columns: readonly SheetColumn[]): Row {
  return cells.map((cell, index) => {
    const mapped = toCell(cell);
    if (mapped === null) return null;
    return columns[index]?.wrap === true ? { ...mapped, wrap: true } : mapped;
  });
}

export function toLibrarySheet(model: SheetModel): Sheet<Blob> {
  const data: SheetData = [
    model.columns.map(headerCell),
    ...model.rows.map((row) => bodyRow(row, model.columns)),
  ];
  if (model.totalRow !== null) {
    data.push(model.totalRow.map((cell) => totalStyled(toCell(cell))));
  }
  return {
    sheet: model.name,
    data,
    stickyRowsCount: 1,
    columns: model.columns.map((column) => ({ width: column.width })),
  };
}
