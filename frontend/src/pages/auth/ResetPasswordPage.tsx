import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { PasswordField } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getErrorMessage } from "@/lib/utils";

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string().min(8),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

type FormValues = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await updatePassword(values.password);
      toast.success("Password updated");
      navigate("/dashboard");
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to update password"));
    } finally {
      setSubmitting(false);
    }
  });

  const passwordReg = register("password");
  const confirmReg = register("confirm");

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Choose a new password</CardTitle>
        <CardDescription>Use a strong password you don’t reuse elsewhere.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <PasswordField
            id="password"
            label="New password"
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
            {submitting ? "Updating…" : "Update password"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link to="/auth/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
