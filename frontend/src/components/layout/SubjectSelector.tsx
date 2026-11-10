import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useSubject } from "@/contexts/SubjectContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SubjectSelector({ className }: { className?: string }) {
  const { subjects, currentSubjectId, currentSubject, setCurrentSubjectId } = useSubject();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description || "").toLowerCase().includes(q),
    );
  }, [subjects, query]);

  return (
    <div className={cn("relative min-w-0", className)}>
      <Button
        type="button"
        variant="outline"
        className="h-9 w-full max-w-[280px] justify-between gap-2 px-3"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate text-left">
          {currentSubject?.name || "Select subject"}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
      </Button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close subject menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,320px)] rounded-lg border border-border bg-popover p-2 shadow-md">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search subjects…"
              className="mb-2 h-9"
              autoFocus
            />
            <div className="max-h-64 space-y-1 overflow-y-auto" role="listbox">
              {filtered.map((s) => {
                const active = s.id === currentSubjectId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-muted",
                      active && "bg-accent",
                    )}
                    onClick={() => {
                      setCurrentSubjectId(s.id);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Check className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "opacity-100" : "opacity-0")} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{s.name}</span>
                      {s.description ? (
                        <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {s.description}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
              {!filtered.length ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">No subjects match.</p>
              ) : null}
            </div>
            <Link
              to="/settings"
              className="mt-2 flex items-center gap-2 rounded-md border border-dashed border-border px-2 py-2 text-sm hover:bg-muted"
              onClick={() => setOpen(false)}
            >
              <Plus className="h-4 w-4" />
              Create subject
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
