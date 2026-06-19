import { type SpreadsheetInfo } from "../types";

/**
 * Extracts the Google Spreadsheet ID from a standard URL.
 */
export function extractSpreadsheetId(url: string): string | null {
  if (!url) return null;
  // Match spreadsheed id between /spreadsheets/d/ and the next slash or end of string
  const regex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

/**
 * Utility to convert column index (0-based) to Excel-style letter column designation (A, B, C... Z, AA, AB...).
 */
export function colIndexToLabel(index: number): string {
  let label = "";
  let temp = index;
  while (temp >= 0) {
    label = String.fromCharCode((temp % 26) + 65) + label;
    temp = Math.floor(temp / 26) - 1;
  }
  return label;
}

/**
 * Fetches basic info and metadata of the Google Spreadsheet.
 */
export async function fetchSpreadsheetInfo(
  spreadsheetId: string,
  accessToken: string
): Promise<SpreadsheetInfo> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody?.error?.message || `Failed to fetch spreadsheet info (status ${response.status})`
    );
  }

  const data = await response.json();
  const sheets = data.sheets?.map((s: any) => s.properties?.title as string).filter(Boolean) || [];

  return {
    spreadsheetId,
    title: data.properties?.title || "Untitled Spreadsheet",
    sheets,
  };
}

/**
 * Fetches entire grid values of a specified sheet.
 */
export async function fetchSheetData(
  spreadsheetId: string,
  sheetName: string,
  accessToken: string
): Promise<{ headers: string[]; rawRows: string[][] }> {
  // Fetch values from the active sheet tab
  const encodedSheetName = encodeURIComponent(sheetName);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedSheetName}?majorDimension=ROWS`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody?.error?.message || `Failed to fetch sheet calculations (status ${response.status})`
    );
  }

  const data = await response.json();
  const values: string[][] = data.values || [];

  if (values.length === 0) {
    return { headers: [], rawRows: [] };
  }

  // First row represents the headers
  const headers = values[0].map((h, idx) => (h ? String(h).trim() : `Column ${colIndexToLabel(idx)}`));
  const rawRows = values.slice(1);

  return { headers, rawRows };
}

/**
 * Updates a specific range or cell with a designated value.
 */
export async function updateSheetCell(
  spreadsheetId: string,
  sheetName: string,
  range: string, // e.g. "Sheet1!B5"
  value: string,
  accessToken: string
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range
  )}?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      range,
      majorDimension: "ROWS",
      values: [[value]],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody?.error?.message || `Failed to update sheet value (status ${response.status})`
    );
  }
}
