import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getProfile, updateProfile } from "@/services/profile";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/utils";

const schema = z.object({
  full_name: z.string().min(1).max(120),
});

type FormValues = z.infer<typeof schema>;

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

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader title="Profile" description="Manage your student profile." />
      <Card>
        <CardContent className="space-y-4 py-6">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={profileQuery.data?.email || user?.email || ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>Study streak</Label>
            <Input value={`${profileQuery.data?.study_streak ?? 0} days`} disabled />
          </div>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" {...form.register("full_name")} />
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
