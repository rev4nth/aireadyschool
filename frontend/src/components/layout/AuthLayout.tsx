import { Link, Outlet } from "react-router-dom";
import { BookOpenCheck } from "lucide-react";

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <BookOpenCheck className="h-5 w-5" />
        </div>
        <div>
          <Link to="/" className="text-lg font-semibold tracking-tight">
            GapFinder
          </Link>
          <p className="text-xs text-muted-foreground">Diagnose weak topics. Plan revision.</p>
        </div>
      </div>
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
}
