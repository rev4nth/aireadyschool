import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createSubject, listSubjects } from "@/services/subjects";
import { useTheme } from "@/contexts/ThemeContext";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/utils";

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const subjectsQuery = useQuery({ queryKey: ["subjects"], queryFn: listSubjects });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [examDate, setExamDate] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      createSubject({
        name,
        description: description || undefined,
        exam_date: examDate || null,
      }),
    onSuccess: async () => {
      toast.success("Subject created");
      setName("");
      setDescription("");
      setExamDate("");
      await queryClient.invalidateQueries({ queryKey: ["subjects"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Appearance and subject configuration." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button variant={theme === "light" ? "default" : "outline"} onClick={() => setTheme("light")}>
            Light
          </Button>
          <Button variant={theme === "dark" ? "default" : "outline"} onClick={() => setTheme("dark")}>
            Dark
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create subject</CardTitle>
        </CardHeader>
        <CardContent className="grid max-w-xl gap-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Data Structures" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Exam date</Label>
            <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
          </div>
          <Button
            disabled={!name.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "Creating…" : "Add subject"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your subjects</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {subjectsQuery.data?.map((s) => (
            <div key={s.id} className="flex justify-between rounded-md border border-border px-3 py-2">
              <span>{s.name}</span>
              <span className="text-muted-foreground">{s.exam_date || "No exam date"}</span>
            </div>
          ))}
          {!subjectsQuery.data?.length && (
            <p className="text-muted-foreground">No subjects yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
