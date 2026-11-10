import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { getTopicMaterials } from "@/services/topics";
import type { Topic } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { masteryBadgeVariant, masteryLabel, normalizeMastery } from "@/lib/mastery";

interface TopicDetailDrawerProps {
  topic: Topic | null;
  onClose: () => void;
}

export function TopicDetailDrawer({ topic, onClose }: TopicDetailDrawerProps) {
  const materialsQuery = useQuery({
    queryKey: ["topic-materials", topic?.id],
    queryFn: () => getTopicMaterials(topic!.id),
    enabled: Boolean(topic?.id),
  });

  if (!topic) return null;

  const classification = normalizeMastery(
    topic.mastery_score > 0
      ? topic.mastery_score < 40
        ? "weak"
        : topic.mastery_score < 70
          ? "medium"
          : "strong"
      : "not_assessed",
    topic.mastery_score > 0 ? 1 : 0,
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-foreground/30 backdrop-blur-[1px]"
        aria-label="Close topic details"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="topic-detail-title"
        className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Topic detail</p>
            <h2 id="topic-detail-title" className="mt-1 text-lg font-semibold">
              {topic.name}
            </h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {topic.description ? (
            <p className="text-sm text-muted-foreground">{topic.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No description stored for this topic.</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Badge variant={masteryBadgeVariant(classification)}>{masteryLabel(classification)}</Badge>
            <Badge variant="outline">
              {classification === "not_assessed" ? "Not assessed" : `${Math.round(topic.mastery_score)}% mastery`}
            </Badge>
            <Badge variant="secondary">Exam importance {Math.round(topic.exam_importance ?? 0)}</Badge>
            <Badge variant="outline">Past papers ×{topic.past_paper_frequency ?? 0}</Badge>
          </div>

          {classification === "not_assessed" ? (
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Not assessed — take a quiz to establish your mastery for this topic.
            </div>
          ) : null}

          <div>
            <h3 className="mb-2 text-sm font-medium">Related materials</h3>
            {materialsQuery.isLoading ? (
              <Skeleton className="h-16" />
            ) : (materialsQuery.data?.documents?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                No linked source documents yet. Generate topics from processed materials.
              </p>
            ) : (
              <ul className="space-y-2">
                {materialsQuery.data!.documents.map((doc) => (
                  <li key={doc.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                    <p className="font-medium">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">{doc.doc_type}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {(topic.children?.length ?? 0) > 0 ? (
            <div>
              <h3 className="mb-2 text-sm font-medium">Subtopics</h3>
              <ul className="space-y-1 text-sm">
                {topic.children!.map((child) => (
                  <li key={child.id} className="rounded-md bg-muted/50 px-2 py-1.5">
                    {child.name}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="grid gap-2 border-t border-border p-4 sm:grid-cols-2">
          <Link
            to="/quiz"
            state={{ preselectedTopicId: topic.id }}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={onClose}
          >
            Quiz this topic
          </Link>
          <Link
            to="/assistant"
            state={{ suggestedPrompt: `Explain ${topic.name} using my uploaded materials.` }}
            className="inline-flex h-10 items-center justify-center rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
            onClick={onClose}
          >
            Explain with AI
          </Link>
          <Link
            to="/materials"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border px-3 text-sm font-medium hover:bg-muted sm:col-span-2"
            onClick={onClose}
          >
            View related materials
          </Link>
        </div>
      </aside>
    </div>
  );
}
