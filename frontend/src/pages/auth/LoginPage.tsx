import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { PasswordField } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/utils";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/dashboard";

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await login(values.email, values.password);
      toast.success("Welcome back");
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to sign in"));
    } finally {
      setSubmitting(false);
    }
  });

  const passwordReg = register("password");

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to continue diagnosing what you don’t know.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...register("email")} />
            {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
          </div>
          <PasswordField
            id="password"
            label="Password"
            autoComplete="current-password"
            error={errors.password?.message}
            value={watch("password") ?? ""}
            onChange={passwordReg.onChange}
            onBlur={passwordReg.onBlur}
            name={passwordReg.name}
            ref={passwordReg.ref}
            hint={
              <Link to="/auth/forgot-password" className="text-xs text-primary hover:underline">
                Forgot password?
              </Link>
            }
          />
          <Button className="w-full" type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link to="/auth/register" className="text-primary hover:underline">
            Create one
          </Link>
        </p>
        <div className="mt-4 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Demo login</p>
          <p>
            Email: <span className="font-mono text-foreground">demo@gapfinder.ai</span>
          </p>
          <p>
            Password: <span className="font-mono text-foreground">GapFinderDemo2026!</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
