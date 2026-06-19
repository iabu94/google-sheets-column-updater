import { useState, useEffect } from "react";
import { Search, Info, Edit, ArrowRightLeft, CheckCircle2, Save, X, Copy, FileText } from "lucide-react";
import { colIndexToLabel, updateSheetCell } from "../utils/sheets";
import { type SheetRow } from "../types";

interface ViewerUpdaterProps {
  accessToken: string;
  spreadsheetId: string;
  sheetName: string;
  idColumn: string;
  headers: string[];
  rawRows: string[][];
  onRefreshNeeded: () => Promise<void>;
}

export default function ViewerUpdater({
  accessToken,
  spreadsheetId,
  sheetName,
  idColumn,
  headers,
  rawRows,
  onRefreshNeeded,
}: ViewerUpdaterProps) {
  const [searchId, setSearchId] = useState("");
  const [activeRow, setActiveRow] = useState<SheetRow | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Selector for column to show inside the popup dialog
  const [selectedReaderColumn, setSelectedReaderColumn] = useState("");

  // Dialog popup state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<{
    idValue: string;
    columnName: string;
    cellAddress: string;
    value: string;
    rowNumber: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Update state
  const [targetUpdateCol, setTargetUpdateCol] = useState("");
  const [updateValue, setUpdateValue] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Set default query/target column selections only if they're not already set or no longer valid in headers
  useEffect(() => {
    if (headers && headers.length > 0) {
      setTargetUpdateCol((prev) => {
        if (prev && headers.includes(prev)) return prev;
        const nonIdCol = headers.find((h) => h !== idColumn);
        return nonIdCol || headers[0];
      });

      setSelectedReaderColumn((prev) => {
        if (prev && headers.includes(prev)) return prev;
        return headers[0] || "";
      });
    }
  }, [headers, idColumn]);

  // Maintain activeRow state and synchronize it with rawRows from parent when refreshed
  const activeIdValue = activeRow?.idValue;
  useEffect(() => {
    if (!activeIdValue || !headers || !rawRows) return;

    const idColIdx = headers.indexOf(idColumn);
    if (idColIdx === -1) return;

    const matchedRowIdx = rawRows.findIndex((row) => {
      const cellVal = row[idColIdx];
      return cellVal !== undefined && String(cellVal).trim() === activeIdValue;
    });

    if (matchedRowIdx !== -1) {
      const matchedRow = rawRows[matchedRowIdx];
      const valuesDict: Record<string, string> = {};
      headers.forEach((header, index) => {
        valuesDict[header] = matchedRow[index] !== undefined ? String(matchedRow[index]).trim() : "";
      });

      setActiveRow((prev) => {
        if (!prev) return null;
        let hasChanged = false;
        const newValues: Record<string, string> = {};
        
        headers.forEach((h) => {
          newValues[h] = valuesDict[h];
          if (prev.values[h] !== valuesDict[h]) {
            hasChanged = true;
          }
        });

        if (prev.index !== matchedRowIdx) {
          hasChanged = true;
        }

        if (!hasChanged) return prev;

        return {
          ...prev,
          index: matchedRowIdx,
          values: newValues,
        };
      });
    }
  }, [rawRows, headers, idColumn, activeIdValue]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Handle clipboard copy
  const handleCopy = async () => {
    if (!dialogData) return;
    try {
      await navigator.clipboard.writeText(dialogData.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  // Search logic to locate the row that matches the specified ID
  const handleLookup = () => {
    setLookupError(null);
    const trimmedId = searchId.trim();

    if (!trimmedId) {
      setLookupError(`Please insert a valid ID search value for column [${idColumn}].`);
      return;
    }

    const idColIdx = headers.indexOf(idColumn);
    if (idColIdx === -1) {
      setLookupError(`Lookup Column [${idColumn}] does not exist in the worksheets headers.`);
      return;
    }

    const matchedRowIdx = rawRows.findIndex((row) => {
      const cellVal = row[idColIdx];
      return cellVal !== undefined && String(cellVal).trim() === trimmedId;
    });

    if (matchedRowIdx === -1) {
      setLookupError(`No matching record ID of "${trimmedId}" was found in lookup column [${idColumn}].`);
      return;
    }

    const matchedRow = rawRows[matchedRowIdx];
    const rowIndex = matchedRowIdx;

    const valuesDict: Record<string, string> = {};
    headers.forEach((header, index) => {
      valuesDict[header] = matchedRow[index] !== undefined ? String(matchedRow[index]).trim() : "";
    });

    const activeObj = {
      index: rowIndex,
      idValue: matchedRow[idColIdx] ? String(matchedRow[idColIdx]).trim() : "",
      values: valuesDict,
    };

    setActiveRow(activeObj);

    // Get value for popup cell based on active selection
    const readerCol = selectedReaderColumn || headers[0] || "";
    const colIdx = headers.indexOf(readerCol);
    const value = valuesDict[readerCol] || "";
    const colLetter = colIdx !== -1 ? colIndexToLabel(colIdx) : "?";
    const rowNumber = rowIndex + 2;

    setDialogData({
      idValue: activeObj.idValue,
      columnName: readerCol,
      cellAddress: `${colLetter}${rowNumber}`,
      value: value,
      rowNumber,
    });
    setDialogOpen(true);
  };

  // Pre-fill lookup fields if user triggers update
  const handleSelectColumnToUpdate = (columnName: string, currentValue: string) => {
    setTargetUpdateCol(columnName);
    setUpdateValue(currentValue);

    const updateSel = document.getElementById("update-section");
    if (updateSel) {
      updateSel.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Triggers Google API cell manipulation
  const handleUpdate = async () => {
    if (!activeRow) return;
    setIsUpdating(true);
    setSuccessMessage(null);

    const targetIdx = headers.indexOf(targetUpdateCol);
    if (targetIdx === -1) {
      alert("Invalid target column");
      setIsUpdating(false);
      return;
    }

    const colLetter = colIndexToLabel(targetIdx);
    const sheetRowNumber = activeRow.index + 2;
    const a1Range = `${colLetter}${sheetRowNumber}`;

    try {
      await updateSheetCell(spreadsheetId, sheetName, a1Range, updateValue, accessToken);

      // Mutate local state representation instantly
      setActiveRow((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          values: {
            ...prev.values,
            [targetUpdateCol]: updateValue,
          },
        };
      });

      setSuccessMessage(`Successfully updated row element [${targetUpdateCol}] to "${updateValue}" at cell coordinate ${a1Range}.`);
      await onRefreshNeeded();
    } catch (err: any) {
      console.error(err);
      alert(`Failed to update sheet value: ${err?.message || "Verify range and try again."}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full" id="card-viewer-updater">
      {/* Search / Lookup Panel */}
      <div className="bg-white border border-gray-300 p-4 md:p-6 flex flex-col gap-3 text-left">
        <div>
          <h2 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Query Row</h2>
          <p className="text-xs text-gray-500 mt-1">
            Search spreadsheet row matching column: <span className="font-bold text-black">{idColumn}</span>
          </p>
        </div>

        <div className="flex flex-col gap-3 mt-1">
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 text-xs px-2.5 py-1.5 border border-gray-300 rounded-none bg-white text-gray-850 placeholder-gray-400 font-sans"
              placeholder={`Enter lookup ID of ${idColumn}...`}
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            />
            <button
              onClick={handleLookup}
              className="px-4 py-1.5 bg-black hover:bg-gray-800 text-white text-xs font-bold border border-black cursor-pointer uppercase tracking-wider"
            >
              Retrieve Cell
            </button>
          </div>

          {/* Reader column selection dropdown */}
          <div className="flex flex-col gap-1 border-t border-gray-100 pt-2 text-left">
            <label htmlFor="reader-column-dropdown" className="text-[11px] font-bold text-gray-700">
              Query Column to Output:
            </label>
            <select
              id="reader-column-dropdown"
              className="w-full text-xs p-1.5 bg-white border border-gray-300 rounded-none text-gray-800 focus:outline-hidden"
              value={selectedReaderColumn}
              onChange={(e) => setSelectedReaderColumn(e.target.value)}
            >
              {headers.map((h) => (
                <option key={`read-${h}`} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        </div>

        {lookupError && (
          <p className="text-xs text-red-700 border border-red-200 bg-red-50 p-2 font-mono">
            Error: {lookupError}
          </p>
        )}
      </div>

      {/* Row viewer / details block (Visible when an activeRow has been fetched) */}
      {activeRow && (
        <div className="flex flex-col gap-4">
          {/* Card: Writer / Modifer Panel */}
          <div
            id="update-section"
            className="bg-white border border-gray-300 p-4 md:p-6 flex flex-col gap-3 text-left"
          >
            <div>
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Update Row Values</h3>
              <p className="text-xs text-gray-400 mt-1">Change any cell value for this row.</p>
            </div>

            {successMessage && (
              <div className="bg-green-50 border border-green-200 text-green-900 p-2.5 text-xs font-mono">
                Success: {successMessage}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="flex flex-col gap-1 text-left">
                <label htmlFor="update-column-picker" className="text-[11px] font-bold text-gray-700">
                  Target Column
                </label>
                <select
                  id="update-column-picker"
                  className="w-full text-xs p-2 bg-white border border-gray-300 rounded-none text-gray-800 focus:outline-hidden"
                  value={targetUpdateCol}
                  onChange={(e) => {
                    setTargetUpdateCol(e.target.value);
                    setUpdateValue(activeRow.values[e.target.value] || "");
                  }}
                  disabled={isUpdating}
                >
                  {headers
                    .filter((h) => h !== idColumn)
                    .map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex flex-col gap-1 text-left md:col-span-2">
                <label htmlFor="update-value-input" className="text-[11px] font-bold text-gray-700">
                  New Value
                </label>
                <div className="flex gap-2">
                  <input
                    id="update-value-input"
                    type="text"
                    className="flex-1 text-xs px-2.5 py-1.5 bg-white border border-gray-300 rounded-none text-gray-850 font-sans"
                    placeholder="Enter new cell data..."
                    value={updateValue}
                    onChange={(e) => setUpdateValue(e.target.value)}
                    disabled={isUpdating}
                  />
                  <button
                    onClick={handleUpdate}
                    disabled={isUpdating || !targetUpdateCol}
                    className="px-4 py-1.5 bg-black hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-bold border border-black cursor-pointer uppercase tracking-wider transition-colors"
                    id="btn-update-cell"
                  >
                    {isUpdating ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Styled Dialog Popup Modal for Retrieved Cell Content */}
      {dialogOpen && dialogData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-150" id="dialog-retrieved-cell">
          <div className="bg-white border border-gray-400 w-full max-w-sm overflow-hidden relative p-4 flex flex-col gap-4 text-left">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-gray-250 pb-2">
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase font-mono">Cell Query Result</span>
                <h3 className="text-xs font-bold text-gray-900 mt-0.5">Cell Coordinate {dialogData.cellAddress}</h3>
              </div>
              <button
                onClick={() => {
                  setDialogOpen(false);
                  setCopied(false);
                }}
                className="text-gray-500 hover:text-black hover:bg-gray-100 p-1 border border-gray-250 cursor-pointer"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Micro Metadata Table */}
            <div className="text-[11px] border border-gray-200 bg-gray-50 p-2 font-mono flex flex-col gap-1 text-gray-700">
              <p>ID Col ({idColumn}): <strong className="text-black font-sans">{dialogData.idValue}</strong></p>
              <p>Ref Column: <strong className="text-black font-sans">{dialogData.columnName}</strong></p>
            </div>

            {/* Displaying value box */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Cell Content</span>
              <div className="bg-gray-100 border border-gray-300 text-gray-900 p-2.5 font-mono text-xs max-h-[140px] overflow-y-auto break-words relative">
                {dialogData.value ? (
                  <p className="whitespace-pre-wrap select-all pr-8 font-medium">{dialogData.value}</p>
                ) : (
                  <p className="italic text-gray-400 font-medium select-none">Empty cell</p>
                )}

                {dialogData.value && (
                  <button
                    onClick={handleCopy}
                    className="absolute right-2 top-2 text-gray-500 hover:text-black bg-white border border-gray-300 p-1 cursor-pointer"
                    title="Copy to Clipboard"
                  >
                    {copied ? (
                      <span className="text-[9px] font-sans font-bold px-0.5">Copied!</span>
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex gap-2 border-t border-gray-250 pt-3">
              <button
                onClick={() => {
                  setDialogOpen(false);
                  setCopied(false);
                }}
                className="flex-1 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-bold cursor-pointer transition-colors text-center uppercase tracking-wider"
              >
                Close
              </button>
              
              <button
                onClick={() => {
                  setDialogOpen(false);
                  handleSelectColumnToUpdate(dialogData.columnName, dialogData.value);
                }}
                className="flex-1 py-1.5 bg-black hover:bg-gray-800 text-white text-xs font-bold border border-black cursor-pointer transition-all text-center uppercase tracking-wider"
              >
                Modify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
