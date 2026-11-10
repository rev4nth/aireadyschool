import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FileUp, RefreshCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useSubject } from "@/contexts/SubjectContext";
import {
  createTextMaterial,
  deleteMaterial,
  getMaterial,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatBytes, getErrorMessage, cn } from "@/lib/utils";

const SAMPLE_PACK = {
  syllabus: `Biology Syllabus — Cells, Photosynthesis, Respiration

Unit 1: Cell Structure
- Cell membrane
- Nucleus
- Mitochondria

Unit 2: Photosynthesis
- Light reaction
- Dark reaction / Calvin cycle
- Chlorophyll and chloroplasts

Unit 3: Respiration
- Glycolysis
- Krebs cycle

Exam weightage: Photosynthesis HIGH; Cell organelles MEDIUM.`,
  notes: `Textbook notes — Biology

The cell membrane controls what enters and leaves the cell. Mitochondria produce ATP through cellular respiration. Chloroplasts contain chlorophyll.

Photosynthesis converts light energy into chemical energy. The light reaction occurs in thylakoid membranes and produces ATP and NADPH. The Calvin cycle fixes carbon dioxide into glucose in the stroma and uses ATP and NADPH. Chlorophyll absorbs light energy.

Glycolysis breaks down glucose in the cytoplasm.`,
  past_paper: `Past paper questions — Biology

Q1: Where does the light reaction take place? (thylakoid membranes)
Q2: Name two products of the light reaction used in the Calvin cycle. (ATP, NADPH)
Q3: Where does the Calvin cycle occur? (stroma)
Q4: Why are mitochondria called the powerhouse of the cell?
Q5: In which part of the cell does glycolysis occur? (cytoplasm)

Frequency note: Photosynthesis light reaction and Calvin cycle appear most often.`,
};

const DOC_TYPE_HELP: Record<string, string> = {
  syllabus: "Defines units and required topics.",
  notes: "Your class or textbook notes.",
  textbook: "Longer reference chapters.",
  past_paper: "Exam-style questions and frequency signals.",
  text: "Other study text.",
};

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

function statusMessage(status: string) {
  switch (status as DocStatus) {
    case "pending":
      return "Waiting to be processed.";
    case "processing":
      return "Extracting text and preparing searchable study content.";
    case "processed":
      return "Ready for topic generation and quizzes.";
    case "failed":
      return "Something went wrong while processing this document.";
    default:
      return status;
  }
}

function previewText(material: Material | null | undefined) {
  if (!material?.metadata) return null;
  const meta = material.metadata;
  const candidates = [meta.text_content, meta.inline_text, meta.content, meta.extracted_text];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

export function MaterialsPage() {
  const { currentSubjectId, currentSubject, subjects, setCurrentSubjectId, refetch: refetchSubjects } =
    useSubject();
  const queryClient = useQueryClient();
  const [dragOver, setDragOver] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [docType, setDocType] = useState("notes");
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteContent, setPasteContent] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "title">("newest");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [sampleConfirm, setSampleConfirm] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["materials", currentSubjectId],
    queryFn: () => listMaterials(currentSubjectId),
    enabled: Boolean(currentSubjectId),
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      return items.some((m) => m.status === "pending" || m.status === "processing") ? 4000 : false;
    },
  });

  const previewQuery = useQuery({
    queryKey: ["material", previewId],
    queryFn: () => getMaterial(previewId!),
    enabled: Boolean(previewId),
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
      toast.success("Upload confirmed — processing started");
      setUploadPct(null);
      invalidate();
    },
    onError: (err) => {
      setUploadPct(null);
      toast.error(getErrorMessage(err, "Upload failed"));
    },
  });

  const pasteMutation = useMutation({
    mutationFn: () => {
      if (!currentSubjectId) throw new Error("Select a subject first");
      if (!pasteContent.trim()) throw new Error("Paste some study text first");
      return createTextMaterial({
        subject_id: currentSubjectId,
        title: pasteTitle.trim() || `${docType} paste`,
        content: pasteContent,
        doc_type: docType,
      });
    },
    onSuccess: () => {
      toast.success("Text material saved and processing");
      setPasteContent("");
      setPasteTitle("");
      invalidate();
    },
    onError: (err) => toast.error(getErrorMessage(err, "Could not save text")),
  });

  const sampleMutation = useMutation({
    mutationFn: async () => {
      const { createSubject } = await import("@/services/subjects");
      const biologyName = "Biology – Cells & Photosynthesis";
      let target =
        subjects.find((s) => s.name.toLowerCase().includes("biology")) ??
        subjects.find((s) => s.name === biologyName) ??
        null;
      if (!target) {
        target = await createSubject({
          name: biologyName,
          description: "Sample subject for GapFinder demo materials",
        });
        refetchSubjects();
      }
      setCurrentSubjectId(target.id);
      await createTextMaterial({
        subject_id: target.id,
        title: "Sample syllabus",
        content: SAMPLE_PACK.syllabus,
        doc_type: "syllabus",
      });
      await createTextMaterial({
        subject_id: target.id,
        title: "Sample notes",
        content: SAMPLE_PACK.notes,
        doc_type: "notes",
      });
      await createTextMaterial({
        subject_id: target.id,
        title: "Sample past papers",
        content: SAMPLE_PACK.past_paper,
        doc_type: "past_paper",
      });
      return target.name;
    },
    onSuccess: async (subjectName) => {
      toast.success(`Sample pack uploaded under “${subjectName}”`);
      await queryClient.invalidateQueries({ queryKey: ["materials"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["subjects"] });
    },
    onError: (err) => toast.error(getErrorMessage(err, "Sample upload failed")),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMaterial,
    onSuccess: () => {
      toast.success("Material deleted");
      setDeleteId(null);
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
      if (file.size > 25 * 1024 * 1024) {
        toast.error("File exceeds the 25 MB upload limit");
        return;
      }
      uploadMutation.mutate(file);
    },
    [uploadMutation],
  );

  const items = useMemo(() => data?.items ?? [], [data]);

  const counts = useMemo(() => {
    return {
      total: items.length,
      processed: items.filter((m) => m.status === "processed").length,
      processing: items.filter((m) => m.status === "pending" || m.status === "processing").length,
      failed: items.filter((m) => m.status === "failed").length,
    };
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let next = items.filter((m) => {
      const matchesSearch =
        !q ||
        m.title.toLowerCase().includes(q) ||
        (m.file_name ?? "").toLowerCase().includes(q) ||
        m.doc_type.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || m.status === statusFilter;
      const matchesType = typeFilter === "all" || m.doc_type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
    next = [...next].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      const aTime = new Date(a.created_at ?? 0).getTime();
      const bTime = new Date(b.created_at ?? 0).getTime();
      return sort === "newest" ? bTime - aTime : aTime - bTime;
    });
    return next;
  }, [items, search, statusFilter, typeFilter, sort]);

  if (!currentSubjectId) {
    return (
      <EmptyState
        icon={Upload}
        title="Select a subject"
        description="Choose a subject in the header to manage materials."
      />
    );
  }

  const preview = previewQuery.data;
  const textPreview = previewText(preview);

  return (
    <div>
      <PageHeader
        title="My Study Materials"
        description="Your uploaded materials are the foundation of your personal learning system."
        actions={
          <Button
            variant="outline"
            disabled={sampleMutation.isPending}
            onClick={() => {
              if (currentSubject && !currentSubject.name.toLowerCase().includes("biology")) {
                setSampleConfirm(true);
                return;
              }
              sampleMutation.mutate();
            }}
          >
            {sampleMutation.isPending ? "Loading sample…" : "Load sample Biology pack"}
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: counts.total },
          { label: "Processed", value: counts.processed },
          { label: "Processing", value: counts.processing },
          { label: "Failed", value: counts.failed },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-semibold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Upload file</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">PDF or TXT · max 25 MB</p>
          </div>
          <Select className="w-40" value={docType} onChange={(e) => setDocType(e.target.value)}>
            <option value="syllabus">Syllabus</option>
            <option value="textbook">Textbook</option>
            <option value="notes">Notes</option>
            <option value="past_paper">Past paper</option>
            <option value="text">Other</option>
          </Select>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">{DOC_TYPE_HELP[docType]}</p>
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

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Paste text</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="paste-title">Document title</Label>
            <Input
              id="paste-title"
              placeholder="e.g. Chapter 3 notes"
              value={pasteTitle}
              onChange={(e) => setPasteTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paste-content">Text content</Label>
            <Textarea
              id="paste-content"
              rows={8}
              placeholder="Paste syllabus, notes, or past-paper text…"
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{pasteContent.length.toLocaleString()} characters</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => pasteMutation.mutate()}
              disabled={pasteMutation.isPending || !pasteContent.trim()}
            >
              {pasteMutation.isPending ? "Saving…" : "Save pasted material"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setPasteTitle("");
                setPasteContent("");
              }}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Input
          placeholder="Search documents…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="lg:max-w-xs"
        />
        <Select className="lg:w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="processed">Processed</option>
          <option value="processing">Processing</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </Select>
        <Select className="lg:w-40" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          <option value="syllabus">Syllabus</option>
          <option value="notes">Notes</option>
          <option value="textbook">Textbook</option>
          <option value="past_paper">Past paper</option>
          <option value="text">Other</option>
        </Select>
        <Select className="lg:w-40" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="title">Title A–Z</option>
        </Select>
      </div>

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
          description="Start by uploading your syllabus or notes."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Upload}
          title="No matching documents"
          description="Adjust search or filters to find a document."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((material: Material) => (
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
                    {material.created_at
                      ? ` · ${new Date(material.created_at).toLocaleDateString()}`
                      : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{statusMessage(material.status)}</p>
                  {material.error_message ? (
                    <p className="mt-1 text-xs text-destructive">{material.error_message}</p>
                  ) : null}
                  {(material.status === "pending" || material.status === "processing") && (
                    <Progress className="mt-2" value={material.status === "processing" ? 65 : 25} />
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPreviewId(material.id)}>
                    <Eye className="h-4 w-4" />
                    Preview
                  </Button>
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
                    onClick={() => setDeleteId(material.id)}
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

      <Dialog
        open={Boolean(previewId)}
        onOpenChange={(open) => {
          if (!open) setPreviewId(null);
        }}
        title={preview?.title || "Document preview"}
        description={`${preview?.doc_type ?? ""} · ${preview?.status ?? ""}`}
        className="max-w-2xl"
      >
        {previewQuery.isLoading ? (
          <Skeleton className="h-40" />
        ) : textPreview ? (
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-xs leading-relaxed">
            {textPreview}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">
            Extracted text preview isn’t available for this file yet. Processed documents still power
            topics, quizzes, and citations even when inline preview isn’t stored.
          </p>
        )}
        {preview?.error_message ? (
          <p className="mt-3 text-sm text-destructive">{preview.error_message}</p>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Delete this material?"
        description="This removes the document and its searchable chunks from the current subject."
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteId) deleteMutation.mutate(deleteId);
        }}
      />

      <ConfirmDialog
        open={sampleConfirm}
        onOpenChange={setSampleConfirm}
        title="Load Biology sample pack?"
        description={`Current subject is “${currentSubject?.name}”. The sample pack will switch to / create a Biology subject.`}
        confirmLabel="Continue"
        onConfirm={() => {
          setSampleConfirm(false);
          sampleMutation.mutate();
        }}
      />
    </div>
  );
}
