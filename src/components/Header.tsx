import { type User } from "firebase/auth";
import { LogOut, LogIn } from "lucide-react";

interface HeaderProps {
  user: User | null;
  needsAuth: boolean;
  isLoggingIn: boolean;
  onLogin: () => void;
  onLogout: () => void;
}

export default function Header({ user, needsAuth, isLoggingIn, onLogin, onLogout }: HeaderProps) {
  return (
    <header className="w-full bg-white border-b border-gray-200 py-3 px-4 flex justify-between items-center sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
          SheetFlow
        </span>
        <span className="text-[10px] text-gray-400 font-medium font-mono">/ Basic Editor</span>
      </div>

      <div className="flex items-center gap-3">
        {user ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500 font-mono text-[11px] hidden sm:inline">{user.email}</span>
            <button
              onClick={onLogout}
              className="text-xs text-gray-700 hover:text-black font-semibold border border-gray-300 px-2 py-1 flex items-center gap-1 cursor-pointer bg-white"
              id="btn-signout"
            >
              <LogOut className="w-3 h-3" />
              <span>Log out</span>
            </button>
          </div>
        ) : (
          <button
            onClick={onLogin}
            disabled={isLoggingIn}
            className="flex items-center gap-1 bg-black hover:bg-gray-800 text-white text-xs font-bold py-1 px-2.5 border border-black cursor-pointer disabled:opacity-50"
            id="btn-signin"
          >
            {isLoggingIn ? (
              <span className="animate-pulse">Loading...</span>
            ) : (
              <>
                <LogIn className="w-3 h-3" />
                <span>Authorize</span>
              </>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
