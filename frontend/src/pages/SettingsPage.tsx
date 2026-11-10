import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createSubject, deleteSubject, listSubjects, updateSubject } from "@/services/subjects";
import { useTheme } from "@/contexts/ThemeContext";
import { useSubject } from "@/contexts/SubjectContext";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { getErrorMessage } from "@/lib/utils";
import type { Subject } from "@/types";

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { currentSubjectId, setCurrentSubjectId } = useSubject();
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const subjectsQuery = useQuery({ queryKey: ["subjects"], queryFn: listSubjects });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [examDate, setExamDate] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [editTarget, setEditTarget] = useState<Subject | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editExamDate, setEditExamDate] = useState("");

  const createMutation = useMutation({
    mutationFn: () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Subject name is required");
      const duplicate = (subjectsQuery.data ?? []).some(
        (s) => s.name.trim().toLowerCase() === trimmed.toLowerCase(),
      );
      if (duplicate) throw new Error("A subject with this name already exists");
      return createSubject({
        name: trimmed,
        description: description.trim() || undefined,
        exam_date: examDate || null,
      });
    },
    onSuccess: async (subject) => {
      toast.success(`Subject “${subject.name}” created`);
      setName("");
      setDescription("");
      setExamDate("");
      setCurrentSubjectId(subject.id);
      await queryClient.invalidateQueries({ queryKey: ["subjects"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editTarget) throw new Error("No subject selected");
      const trimmed = editName.trim();
      if (!trimmed) throw new Error("Subject name is required");
      const duplicate = (subjectsQuery.data ?? []).some(
        (s) => s.id !== editTarget.id && s.name.trim().toLowerCase() === trimmed.toLowerCase(),
      );
      if (duplicate) throw new Error("A subject with this name already exists");
      return updateSubject(editTarget.id, {
        name: trimmed,
        description: editDescription.trim(),
        exam_date: editExamDate || null,
      });
    },
    onSuccess: async () => {
      toast.success("Subject updated");
      setEditTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["subjects"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (subjectId: string) => deleteSubject(subjectId),
    onSuccess: async (_data, subjectId) => {
      toast.success("Subject deleted");
      setDeleteTarget(null);
      if (currentSubjectId === subjectId) {
        const remaining = (subjectsQuery.data ?? []).filter((s) => s.id !== subjectId);
        setCurrentSubjectId(remaining[0]?.id ?? null);
      }
      await queryClient.invalidateQueries({ queryKey: ["subjects"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["materials"] });
      await queryClient.invalidateQueries({ queryKey: ["topics"] });
      await queryClient.invalidateQueries({ queryKey: ["gap-reports"] });
      await queryClient.invalidateQueries({ queryKey: ["revision-plans"] });
    },
    onError: (error) => toast.error(getErrorMessage(error, "Could not delete subject")),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Appearance, subject management, and account controls."
      />

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
            <Label htmlFor="subject-name">Subject name</Label>
            <Input
              id="subject-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Biology"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject-description">Description</Label>
            <Textarea
              id="subject-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional — units, exam board, or focus area"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exam-date">Exam date</Label>
            <Input
              id="exam-date"
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
            />
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
          {subjectsQuery.isLoading ? (
            <Skeleton className="h-16" />
          ) : subjectsQuery.isError ? (
            <ErrorState
              description={getErrorMessage(subjectsQuery.error)}
              onRetry={() => void subjectsQuery.refetch()}
            />
          ) : (
            <>
              {subjectsQuery.data?.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col gap-3 rounded-md border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {s.name}
                      {currentSubjectId === s.id ? (
                        <span className="ml-2 text-xs font-normal text-primary">Active</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.description || "No description"} · {s.exam_date || "No exam date"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditTarget(s);
                        setEditName(s.name);
                        setEditDescription(s.description || "");
                        setEditExamDate(s.exam_date?.slice(0, 10) || "");
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/5 hover:text-destructive"
                      onClick={() => setDeleteTarget(s)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
              {!subjectsQuery.data?.length && (
                <p className="text-muted-foreground">
                  No subjects yet. Create one above to start uploading materials.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Uploaded study materials are used only to power your topic map, quizzes, gap reports,
            revision plan, and grounded assistant answers for your account.
          </p>
          <p>Delete documents from My Materials, or delete an entire subject to remove its learning data.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void logout()}>
            Log out
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(editTarget)}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        title="Edit subject"
        description="Update the subject name, description, or exam date."
      >
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Subject name</Label>
            <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              rows={3}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-exam">Exam date</Label>
            <Input
              id="edit-exam"
              type="date"
              value={editExamDate}
              onChange={(e) => setEditExamDate(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button disabled={!editName.trim() || updateMutation.isPending} onClick={() => updateMutation.mutate()}>
              {updateMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Delete “${deleteTarget?.name ?? "subject"}”?`}
        description="This removes its materials, topics, quizzes, gap reports, and plans."
        confirmLabel="Delete subject"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}
