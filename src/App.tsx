import { useEffect, useState } from "react";
import { type User } from "firebase/auth";
import { initAuth, googleSignIn, logout } from "./firebase";
import Header from "./components/Header";
import SheetsSelector from "./components/SheetsSelector";
import ViewerUpdater from "./components/ViewerUpdater";
import { fetchSheetData } from "./utils/sheets";
import { RefreshCw } from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);

  // Sheet configuration state
  const [sheetConfig, setSheetConfig] = useState<{
    spreadsheetId: string;
    sheetName: string;
    idColumn: string;
    headers: string[];
    rawRows: string[][];
  } | null>(null);

  // Initialize Auth listeners on startup
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setNeedsAuth(false);
        setAuthInitialized(true);
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
        setAuthInitialized(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setUser(result.user);
        setNeedsAuth(false);
      }
    } catch (err) {
      console.error("Login failed:", err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setToken(null);
      setNeedsAuth(true);
      setSheetConfig(null);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Helper to re-query latest rows
  const handleRefreshSheet = async () => {
    if (!token || !sheetConfig) return;
    try {
      const { headers: freshHeaders, rawRows: freshRows } = await fetchSheetData(
        sheetConfig.spreadsheetId,
        sheetConfig.sheetName,
        token
      );
      setSheetConfig((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          headers: freshHeaders,
          rawRows: freshRows,
        };
      });
    } catch (err) {
      console.error("Failed to automatically refresh sheet records:", err);
    }
  };

  // Plain Loading screen
  if (!authInitialized) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <p className="text-xs font-mono font-bold text-gray-500 uppercase tracking-widest animate-pulse">
          Loading auth...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-mono text-xs text-gray-950">
      <Header
        user={user}
        needsAuth={needsAuth}
        isLoggingIn={isLoggingIn}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />

      <main className="flex-1 w-full max-w-2xl mx-auto py-6 px-4 flex flex-col gap-4">
        {needsAuth ? (
          /* Locked State - Basic non-decorative sign in */
          <div className="bg-white border border-gray-300 p-6 flex flex-col gap-4 text-left">
            <div>
              <h1 className="text-sm font-bold uppercase tracking-wider text-black">
                Spreadsheet Authorization Required
              </h1>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                To load and modify your Google spreadsheets in your browser, connect via Google Sign-In below.
              </p>
            </div>

            <div className="flex justify-start">
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="bg-black hover:bg-gray-800 disabled:bg-gray-200 text-white font-bold text-xs py-2 px-4 uppercase tracking-wider cursor-pointer border border-black disabled:border-gray-200"
              >
                {isLoggingIn ? "Authorizing..." : "Sign in with Google"}
              </button>
            </div>

            <div className="border border-yellow-300 bg-yellow-50 p-3 flex flex-col gap-1.5 text-yellow-950 font-sans">
              <span className="font-bold text-xs uppercase tracking-wider block">⚠️ Action Required on Sign-In popup:</span>
              <p className="text-xs leading-relaxed font-semibold">
                You MUST manually select and check the box next to:
              </p>
              <div className="bg-white border border-yellow-250 p-2 font-mono text-[10px] font-bold text-center">
                "See, edit, create, and delete all your Google Sheets spreadsheets"
              </div>
              <p className="text-[11px] text-gray-600 mt-0.5 leading-normal">
                If left unchecked (which Google does by default), permissions will fail and you will have to log out and try again.
              </p>
            </div>
            
            <p className="text-[10px] text-gray-400">
              Accessed directly in-browser via offical secure Google APIs.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 w-full">
            {/* Connected State - Configure Sheets */}
            {sheetConfig ? (
              /* Collapsed minimalist bar */
              <div className="bg-white border border-gray-300 p-3 flex justify-between items-center text-xs">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Linked Sheet</span>
                  <p className="font-bold text-black mt-0.5 font-sans">
                    {sheetConfig.sheetName} <span className="font-normal text-gray-500 font-mono text-[10px]">({sheetConfig.headers.length} Cols)</span>
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleRefreshSheet}
                    className="p-1 px-2 border border-gray-300 text-gray-700 bg-white hover:text-black hover:bg-gray-50 cursor-pointer font-bold flex items-center gap-1 uppercase tracking-wider text-[10px]"
                    title="Reload sheet state"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setSheetConfig(null)}
                    className="px-2 py-1 bg-white border border-gray-300 hover:bg-gray-50 font-bold uppercase tracking-wider text-[10px] cursor-pointer"
                  >
                    Change Sheet
                  </button>
                </div>
              </div>
            ) : (
              <SheetsSelector accessToken={token!} onConfigured={setSheetConfig} />
            )}

            {/* Viewer and Cell Mutator */}
            {sheetConfig && (
              <ViewerUpdater
                accessToken={token!}
                spreadsheetId={sheetConfig.spreadsheetId}
                sheetName={sheetConfig.sheetName}
                idColumn={sheetConfig.idColumn}
                headers={sheetConfig.headers}
                rawRows={sheetConfig.rawRows}
                onRefreshNeeded={handleRefreshSheet}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
