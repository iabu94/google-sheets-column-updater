export interface SpreadsheetInfo {
  spreadsheetId: string;
  title: string;
  sheets: string[]; // List of sheet tab names
}

export interface SheetRow {
  index: number; // 0-based array index of the row (corresponds to row number = index + 1 in Excel/Sheets)
  idValue: string; // The value of the ID column for this row
  values: { [columnName: string]: string }; // Map of header -> value
  allCells: string[]; // Raw cells in order
}

export interface SheetConfig {
  url: string;
  spreadsheetId: string;
  selectedSheet: string;
  idColumn: string; // The header name chosen as the ID column
}
