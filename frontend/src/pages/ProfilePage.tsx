import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getProfile, updateProfile } from "@/services/profile";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { getErrorMessage } from "@/lib/utils";

const schema = z.object({
  full_name: z.string().min(1, "Name is required").max(120),
});

type FormValues = z.infer<typeof schema>;

function initials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.split("@")[0] || "S";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "" },
  });

  useEffect(() => {
    if (profileQuery.data?.full_name) {
      form.reset({ full_name: profileQuery.data.full_name });
    }
  }, [profileQuery.data, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => updateProfile(values),
    onSuccess: async () => {
      toast.success("Profile updated");
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (profileQuery.isLoading) return <Skeleton className="h-48" />;
  if (profileQuery.isError) {
    return (
      <ErrorState
        description={getErrorMessage(profileQuery.error)}
        onRetry={() => void profileQuery.refetch()}
      />
    );
  }

  const name = profileQuery.data?.full_name || user?.user_metadata?.full_name || "Student";
  const email = profileQuery.data?.email || user?.email || "";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Profile"
        description="Your account identity and study streak. Email is managed by authentication."
      />

      <Card>
        <CardContent className="flex items-center gap-4 py-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-lg font-semibold text-accent-foreground">
            {initials(name, email)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{name}</p>
            <p className="truncate text-sm text-muted-foreground">{email}</p>
            {profileQuery.data?.created_at ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Member since {new Date(profileQuery.data.created_at).toLocaleDateString()}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Study streak</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{profileQuery.data?.study_streak ?? 0}</p>
            <p className="mt-1 text-sm text-muted-foreground">Consecutive study days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last study date</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {profileQuery.data?.last_study_date
                ? new Date(profileQuery.data.last_study_date).toLocaleDateString()
                : "Not yet recorded"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Editable details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} disabled />
            <p className="text-xs text-muted-foreground">Email changes aren’t supported in-app.</p>
          </div>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" {...form.register("full_name")} />
              {form.formState.errors.full_name ? (
                <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>
              ) : null}
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
