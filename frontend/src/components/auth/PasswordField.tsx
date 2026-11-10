import { forwardRef, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function strengthScore(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
}

const STRENGTH_LABELS = ["Too weak", "Weak", "Fair", "Good", "Strong"] as const;

interface PasswordFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  showStrength?: boolean;
  hint?: React.ReactNode;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(
    { id, label, error, showStrength = false, hint, className, value, onChange, ...props },
    ref,
  ) {
    const [visible, setVisible] = useState(false);
    const password = typeof value === "string" ? value : "";
    const score = useMemo(() => strengthScore(password), [password]);

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={id}>{label}</Label>
          {hint}
        </div>
        <div className="relative">
          <Input
            id={id}
            ref={ref}
            type={visible ? "text" : "password"}
            value={value}
            onChange={onChange}
            className={cn("pr-10", className)}
            {...props}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {showStrength && password ? (
          <div className="space-y-1">
            <div className="flex gap-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full",
                    i < score
                      ? score <= 1
                        ? "bg-destructive"
                        : score === 2
                          ? "bg-warning"
                          : "bg-success"
                      : "bg-muted",
                  )}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{STRENGTH_LABELS[score]}</p>
          </div>
        ) : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    );
  },
);
