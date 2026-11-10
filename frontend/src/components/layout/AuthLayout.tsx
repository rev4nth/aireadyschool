import { Link, Outlet } from "react-router-dom";
import { BookOpenCheck } from "lucide-react";

export function AuthLayout() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <BookOpenCheck className="h-5 w-5" />
        </div>
        <div>
          <Link to="/" className="font-display text-xl font-semibold tracking-tight">
            GapFinder AI
          </Link>
          <p className="text-xs text-muted-foreground">Find gaps. Study smarter.</p>
        </div>
      </div>
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
}
