import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Map, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useSubject } from "@/contexts/SubjectContext";
import { generateTopicMap, listTopics, updateTopic } from "@/services/topics";
import type { MasteryClass, Topic } from "@/types";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { cn, getErrorMessage } from "@/lib/utils";

function masteryVariant(score: number): { label: MasteryClass; variant: "danger" | "warning" | "success" } {
  if (score < 40) return { label: "weak", variant: "danger" };
  if (score < 70) return { label: "medium", variant: "warning" };
  return { label: "strong", variant: "success" };
}

function TopicNodeRow({
  topic,
  depth,
  expanded,
  onToggle,
  onRename,
}: {
  topic: Topic;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const hasChildren = Boolean(topic.children?.length);
  const isOpen = expanded.has(topic.id);
  const mastery = masteryVariant(topic.mastery_score);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(topic.name);

  return (
    <div>
      <div
        className="group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted/70"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <button
          type="button"
          className={cn("rounded p-0.5 text-muted-foreground", !hasChildren && "invisible")}
          onClick={() => onToggle(topic.id)}
          aria-label={isOpen ? "Collapse" : "Expand"}
        >
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          {editing ? (
            <Input
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                setEditing(false);
                if (name.trim() && name !== topic.name) onRename(topic.id, name.trim());
                else setName(topic.name);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") {
                  setName(topic.name);
                  setEditing(false);
                }
              }}
              className="h-8"
            />
          ) : (
            <button
              type="button"
              className="truncate text-left text-sm font-medium hover:underline"
              onClick={() => setEditing(true)}
              title="Click to rename"
            >
              {topic.name}
            </button>
          )}
        </div>
        <Badge variant="outline" title="Exam importance">
          Exam {Math.round(topic.exam_importance ?? 0)}
        </Badge>
        <Badge variant="secondary" title="Past-paper frequency">
          Papers ×{topic.past_paper_frequency ?? 0}
        </Badge>
        <Badge variant={mastery.variant}>{mastery.label}</Badge>
        <span className="w-10 text-right text-xs text-muted-foreground">
          {Math.round(topic.mastery_score)}%
        </span>
      </div>
      {hasChildren && isOpen
        ? topic.children!.map((child) => (
            <TopicNodeRow
              key={child.id}
              topic={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onRename={onRename}
            />
          ))
        : null}
    </div>
  );
}

export function TopicMapPage() {
  const { currentSubjectId } = useSubject();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["topics", currentSubjectId],
    queryFn: () => listTopics(currentSubjectId!),
    enabled: Boolean(currentSubjectId),
  });

  const generateMutation = useMutation({
    mutationFn: () => generateTopicMap(currentSubjectId!),
    onSuccess: () => {
      toast.success("Topic map generated");
      void queryClient.invalidateQueries({ queryKey: ["topics", currentSubjectId] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateTopic(id, { name }),
    onSuccess: () => {
      toast.success("Topic renamed");
      void queryClient.invalidateQueries({ queryKey: ["topics", currentSubjectId] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const topics = useMemo(() => data?.topics ?? [], [data]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!currentSubjectId) {
    return <EmptyState icon={Map} title="Select a subject" description="Choose a subject to view its topic map." />;
  }

  return (
    <div>
      <PageHeader
        title="Topic Map"
        description="Syllabus hierarchy with mastery, exam importance, and past-paper frequency. Click a name to edit."
        actions={
          <Button
            disabled={generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
          >
            <Sparkles className="h-4 w-4" />
            {generateMutation.isPending ? "Generating…" : "Generate from materials"}
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : topics.length === 0 ? (
        <EmptyState
          icon={Map}
          title="No topics yet"
          description="Generate a topic map from your uploaded syllabus or notes."
          action={
            <Button disabled={generateMutation.isPending} onClick={() => generateMutation.mutate()}>
              Generate topic map
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-3">
            {topics.map((topic) => (
              <TopicNodeRow
                key={topic.id}
                topic={topic}
                depth={0}
                expanded={expanded}
                onToggle={toggle}
                onRename={(id, name) => renameMutation.mutate({ id, name })}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
