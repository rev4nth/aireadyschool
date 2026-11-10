import { Link } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function VerifyEmailPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <MailCheck className="h-6 w-6" />
        </div>
        <CardTitle>Verify your email</CardTitle>
        <CardDescription>
          We sent a verification link to your inbox. Open it to activate your account, then sign in.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        <Link
          to="/auth/login"
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Return to sign in
        </Link>
        <p className="text-xs text-muted-foreground">
          Didn’t get it? Check spam, or request another link from your project’s Supabase auth settings.
        </p>
      </CardContent>
    </Card>
  );
}
