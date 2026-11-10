import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
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

const schema = z
  .object({
    full_name: z.string().min(1, "Name is required").max(200),
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string().min(8),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const { register: signUp, user, loading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

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
      await signUp(values.email, values.password, values.full_name);
      toast.success("Check your email to verify your account");
      navigate("/auth/verify");
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to register"));
    } finally {
      setSubmitting(false);
    }
  });

  const passwordReg = register("password");
  const confirmReg = register("confirm");

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Create your account</CardTitle>
        <CardDescription>Start with your materials. Diagnose gaps. Revise with a plan.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" autoComplete="name" {...register("full_name")} />
            {errors.full_name ? (
              <p className="text-xs text-destructive">{errors.full_name.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...register("email")} />
            {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
          </div>
          <PasswordField
            id="password"
            label="Password"
            autoComplete="new-password"
            showStrength
            error={errors.password?.message}
            value={watch("password") ?? ""}
            onChange={passwordReg.onChange}
            onBlur={passwordReg.onBlur}
            name={passwordReg.name}
            ref={passwordReg.ref}
          />
          <PasswordField
            id="confirm"
            label="Confirm password"
            autoComplete="new-password"
            error={errors.confirm?.message}
            value={watch("confirm") ?? ""}
            onChange={confirmReg.onChange}
            onBlur={confirmReg.onBlur}
            name={confirmReg.name}
            ref={confirmReg.ref}
          />
          <Button className="w-full" type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/auth/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
