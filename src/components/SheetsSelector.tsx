import { useState, useEffect } from "react";
import { Link2, CheckCircle2, ChevronRight, RefreshCw, AlertCircle } from "lucide-react";
import { extractSpreadsheetId, fetchSpreadsheetInfo, fetchSheetData } from "../utils/sheets";
import { type SpreadsheetInfo } from "../types";

interface SheetsSelectorProps {
  accessToken: string;
  onConfigured: (config: {
    spreadsheetId: string;
    sheetName: string;
    idColumn: string;
    headers: string[];
    rawRows: string[][];
  }) => void;
  initialSpreadsheetId?: string;
}

export default function SheetsSelector({ accessToken, onConfigured, initialSpreadsheetId = "" }: SheetsSelectorProps) {
  const [sheetUrl, setSheetUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [spreadsheetInfo, setSpreadsheetInfo] = useState<SpreadsheetInfo | null>(null);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [idColumn, setIdColumn] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);

  const handleConnect = async (targetId?: string) => {
    setError(null);
    const resolvedId = targetId || extractSpreadsheetId(sheetUrl);

    if (!resolvedId) {
      setError("Unable to parse Google Spreadsheet ID. Please verify the URL formatting.");
      return;
    }

    setIsLoading(true);
    try {
      const info = await fetchSpreadsheetInfo(resolvedId, accessToken);
      setSpreadsheetInfo(info);
      
      if (info.sheets.length > 0) {
        setSelectedSheet(info.sheets[0]);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to load spreadsheet. Make sure you have authorized access.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!spreadsheetInfo || !selectedSheet) return;

    const loadSheetData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { headers: fetchedHeaders, rawRows: fetchedRows } = await fetchSheetData(
          spreadsheetInfo.spreadsheetId,
          selectedSheet,
          accessToken
        );
        setHeaders(fetchedHeaders);
        setRawRows(fetchedRows);

        if (fetchedHeaders.length > 0) {
          const matchIdCol = fetchedHeaders.find((h) => h.toLowerCase() === "id" || h.toLowerCase() === "key");
          setIdColumn(matchIdCol || fetchedHeaders[0]);
        } else {
          setIdColumn("");
        }
      } catch (err: any) {
        console.error(err);
        setError(`Failed to read sheet data: ${err?.message || "Verification failed."}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadSheetData();
  }, [spreadsheetInfo, selectedSheet, accessToken]);

  const handleConfirm = () => {
    if (!spreadsheetInfo || !selectedSheet || !idColumn) return;
    onConfigured({
      spreadsheetId: spreadsheetInfo.spreadsheetId,
      sheetName: selectedSheet,
      idColumn,
      headers,
      rawRows,
    });
  };

  return (
    <div className="bg-white border border-gray-300 p-4 md:p-6 flex flex-col gap-4 text-left" id="card-sheets-selector">
      <div>
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-tight">Configure Google Sheet</h2>
        <p className="text-xs text-gray-500 mt-1">Provide any spreadsheet link to load columns and work on rows.</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="sheet-url-input" className="text-[11px] font-bold text-gray-700">
            Paste Spreadsheet URL
          </label>
          <div className="flex gap-2">
            <input
              id="sheet-url-input"
              type="url"
              className="flex-1 text-xs px-2.5 py-1.5 border border-gray-300 rounded-none bg-white text-gray-800 placeholder-gray-400 focus:outline-hidden focus:border-black font-sans"
              placeholder="https://docs.google.com/spreadsheets/d/.../edit"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              disabled={isLoading}
            />
            <button
              onClick={() => handleConnect()}
              disabled={isLoading || !sheetUrl.trim()}
              className="px-3 bg-black hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-bold border border-black cursor-pointer uppercase tracking-wider"
              id="btn-sheet-connect"
            >
              {isLoading && !spreadsheetInfo ? "..." : "Connect"}
            </button>
          </div>
        </div>

        {error && (
          <div className="border border-red-300 bg-red-50 p-3 text-xs text-red-900 flex flex-col gap-2">
            <div>
              <p className="font-bold">Error Connecting</p>
              <p className="mt-0.5 leading-relaxed text-[11px]">{error}</p>
            </div>
            
            {(error.toLowerCase().includes("scope") || 
              error.toLowerCase().includes("insufficient") || 
              error.toLowerCase().includes("permission") || 
              error.toLowerCase().includes("unauthorized") ||
              error.toLowerCase().includes("auth")) && (
              <div className="border-t border-red-200 pt-2 text-[11px] font-medium leading-relaxed">
                <p className="font-bold uppercase text-[10px] text-red-950">How to fix:</p>
                <ol className="list-decimal list-inside space-y-1 mt-1 text-gray-700">
                  <li>Click <span className="font-bold">Log out</span> at the top.</li>
                  <li>Click <span className="font-bold">Authorize</span> to log back in.</li>
                  <li>
                    <span className="font-bold">Check the box</span> next to:
                    <div className="my-1 p-1.5 bg-yellow-50 text-yellow-950 font-bold border border-yellow-250 font-mono text-[9px] text-center">
                      "See, edit, create, and delete all your Google Sheets spreadsheets"
                    </div>
                    Otherwise, Google will block editing.
                  </li>
                </ol>
              </div>
            )}
          </div>
        )}

        {spreadsheetInfo && (
          <div className="border border-gray-300 p-3 flex flex-col gap-3">
            <div className="text-xs">
              <span className="text-[10px] text-gray-400 uppercase font-mono tracking-wider block">Spreadsheet Connected</span>
              <span className="font-bold text-gray-800 block">{spreadsheetInfo.title}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="sheet-tab-picker" className="text-[11px] font-bold text-gray-700">
                  Select Tab (Sheet)
                </label>
                <select
                  id="sheet-tab-picker"
                  className="w-full text-xs p-1.5 bg-white border border-gray-300 rounded-none text-gray-800 focus:outline-hidden focus:border-black"
                  value={selectedSheet}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  disabled={isLoading}
                >
                  {spreadsheetInfo.sheets.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="id-col-picker" className="text-[11px] font-bold text-gray-700">
                  Lookup Column (ID)
                </label>
                <select
                  id="id-col-picker"
                  className="w-full text-xs p-1.5 bg-white border border-gray-300 rounded-none text-gray-800 focus:outline-hidden focus:border-black"
                  value={idColumn}
                  onChange={(e) => setIdColumn(e.target.value)}
                  disabled={isLoading || headers.length === 0}
                >
                  {headers.map((h, index) => (
                    <option key={`${h}-${index}`} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {headers.length > 0 && (
              <p className="text-[11px] text-gray-500 font-mono">
                Found {headers.length} columns & {rawRows.length} data rows.
              </p>
            )}

            <button
              onClick={handleConfirm}
              disabled={isLoading || !idColumn}
              className="w-full py-2 bg-black hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-bold border border-black cursor-pointer uppercase tracking-wider transition-colors mt-1"
              id="btn-sheet-submit"
            >
              {isLoading ? "Loading..." : "Proceed to Lookup"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
