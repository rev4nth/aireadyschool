import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, RefreshCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useSubject } from "@/contexts/SubjectContext";
import {
  deleteMaterial,
  listMaterials,
  reprocessMaterial,
  uploadMaterial,
} from "@/services/materials";
import type { DocStatus, Material } from "@/types";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { formatBytes, getErrorMessage, cn } from "@/lib/utils";

function statusVariant(status: string): "muted" | "warning" | "success" | "danger" {
  switch (status as DocStatus) {
    case "processed":
      return "success";
    case "processing":
    case "pending":
      return "warning";
    case "failed":
      return "danger";
    default:
      return "muted";
  }
}

export function MaterialsPage() {
  const { currentSubjectId } = useSubject();
  const queryClient = useQueryClient();
  const [dragOver, setDragOver] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [docType, setDocType] = useState("notes");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["materials", currentSubjectId],
    queryFn: () => listMaterials(currentSubjectId),
    enabled: Boolean(currentSubjectId),
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      return items.some((m) => m.status === "pending" || m.status === "processing") ? 4000 : false;
    },
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["materials", currentSubjectId] });
  }, [queryClient, currentSubjectId]);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      if (!currentSubjectId) throw new Error("Select a subject first");
      return uploadMaterial({
        subjectId: currentSubjectId,
        file,
        docType,
        onProgress: setUploadPct,
      });
    },
    onSuccess: () => {
      toast.success("Upload started");
      setUploadPct(null);
      invalidate();
    },
    onError: (err) => {
      setUploadPct(null);
      toast.error(getErrorMessage(err, "Upload failed"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMaterial,
    onSuccess: () => {
      toast.success("Material deleted");
      invalidate();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const reprocessMutation = useMutation({
    mutationFn: reprocessMaterial,
    onSuccess: () => {
      toast.success("Reprocessing started");
      invalidate();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const onFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      const file = files[0];
      if (!file.type.includes("pdf") && !file.type.includes("text") && !file.name.endsWith(".txt")) {
        toast.error("Only PDF or plain text files are supported");
        return;
      }
      uploadMutation.mutate(file);
    },
    [uploadMutation],
  );

  const items = useMemo(() => data?.items ?? [], [data]);

  if (!currentSubjectId) {
    return (
      <EmptyState
        icon={Upload}
        title="Select a subject"
        description="Choose a subject in the header to manage materials."
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="My Materials"
        description="Upload syllabi, notes, and past papers for grounded AI study tools."
      />

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Upload</CardTitle>
          <Select className="w-40" value={docType} onChange={(e) => setDocType(e.target.value)}>
            <option value="syllabus">Syllabus</option>
            <option value="textbook">Textbook</option>
            <option value="notes">Notes</option>
            <option value="past_paper">Past paper</option>
            <option value="text">Text</option>
          </Select>
        </CardHeader>
        <CardContent>
          <label
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 transition-colors",
              dragOver ? "border-primary bg-accent/60" : "border-border bg-muted/40 hover:bg-muted/70",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              onFiles(e.dataTransfer.files);
            }}
          >
            <FileUp className="mb-2 h-6 w-6 text-primary" />
            <p className="text-sm font-medium">Drag & drop a PDF or text file</p>
            <p className="mt-1 text-xs text-muted-foreground">or click to browse</p>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.txt,application/pdf,text/plain"
              onChange={(e) => onFiles(e.target.files)}
            />
          </label>
          {uploadPct != null ? (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Uploading…</span>
                <span>{uploadPct}%</span>
              </div>
              <Progress value={uploadPct} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Upload}
          title="No materials yet"
          description="Upload a syllabus or notes to unlock topic maps and quizzes."
        />
      ) : (
        <div className="space-y-3">
          {items.map((material: Material) => (
            <Card key={material.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{material.title}</p>
                    <Badge variant={statusVariant(material.status)}>{material.status}</Badge>
                    <Badge variant="outline">{material.doc_type}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {material.file_name || "Untitled"} · {formatBytes(material.file_size_bytes)}
                    {material.page_count ? ` · ${material.page_count} pages` : ""}
                  </p>
                  {material.error_message ? (
                    <p className="mt-1 text-xs text-destructive">{material.error_message}</p>
                  ) : null}
                  {(material.status === "pending" || material.status === "processing") && (
                    <Progress className="mt-2" value={material.status === "processing" ? 65 : 25} />
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={reprocessMutation.isPending}
                    onClick={() => reprocessMutation.mutate(material.id)}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reprocess
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (window.confirm("Delete this material?")) {
                        deleteMutation.mutate(material.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
