import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Map, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useSubject } from "@/contexts/SubjectContext";
import { generateTopicMap, listTopics } from "@/services/topics";
import type { Topic } from "@/types";
import { TopicDetailDrawer } from "@/components/topics/TopicDetailDrawer";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { cn, getErrorMessage } from "@/lib/utils";
import { masteryBadgeVariant, masteryLabel, normalizeMastery } from "@/lib/mastery";

function topicMastery(topic: Topic): {
  label: string;
  variant: "danger" | "warning" | "success" | "muted";
  scoreLabel: string;
  classification: ReturnType<typeof normalizeMastery>;
} {
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
  return {
    label: masteryLabel(classification),
    variant: masteryBadgeVariant(classification),
    scoreLabel: classification === "not_assessed" ? "—" : `${Math.round(topic.mastery_score)}%`,
    classification,
  };
}

function collectIds(topics: Topic[], acc: string[] = []): string[] {
  for (const t of topics) {
    acc.push(t.id);
    if (t.children?.length) collectIds(t.children, acc);
  }
  return acc;
}

function TopicNodeRow({
  topic,
  depth,
  expanded,
  onToggle,
  onSelect,
  selectedId,
}: {
  topic: Topic;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (topic: Topic) => void;
  selectedId?: string | null;
}) {
  const hasChildren = Boolean(topic.children?.length);
  const isOpen = expanded.has(topic.id);
  const mastery = topicMastery(topic);

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted/70",
          selectedId === topic.id && "bg-accent/70",
        )}
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
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline"
          onClick={() => onSelect(topic)}
        >
          {topic.name}
        </button>
        <Badge variant="outline" title="Exam importance">
          Exam {Math.round(topic.exam_importance ?? 0)}
        </Badge>
        <Badge variant="secondary" title="Past-paper frequency">
          Papers ×{topic.past_paper_frequency ?? 0}
        </Badge>
        <Badge variant={mastery.variant}>{mastery.label}</Badge>
        <span className="w-10 text-right text-xs text-muted-foreground">{mastery.scoreLabel}</span>
      </div>
      {hasChildren && isOpen
        ? topic.children!.map((child) => (
            <TopicNodeRow
              key={child.id}
              topic={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))
        : null}
    </div>
  );
}

function filterTree(
  topics: Topic[],
  query: string,
  masteryFilter: string,
): Topic[] {
  const q = query.trim().toLowerCase();
  return topics
    .map((topic) => {
      const children = filterTree(topic.children ?? [], query, masteryFilter);
      const mastery = topicMastery(topic).classification;
      const matchesQuery = !q || topic.name.toLowerCase().includes(q);
      const matchesMastery = masteryFilter === "all" || mastery === masteryFilter;
      if ((matchesQuery && matchesMastery) || children.length) {
        return { ...topic, children };
      }
      return null;
    })
    .filter(Boolean) as Topic[];
}

export function TopicMapPage() {
  const { currentSubjectId } = useSubject();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Topic | null>(null);
  const [search, setSearch] = useState("");
  const [masteryFilter, setMasteryFilter] = useState("all");

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

  const topics = useMemo(() => data?.topics ?? [], [data]);
  const filtered = useMemo(
    () => filterTree(topics, search, masteryFilter),
    [topics, search, masteryFilter],
  );

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
        title="My Topic Map"
        description="Explore your syllabus, understand topic importance, and track mastery. Click a topic for details."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setExpanded(new Set(collectIds(topics)))}
              disabled={!topics.length}
            >
              Expand all
            </Button>
            <Button variant="outline" onClick={() => setExpanded(new Set())} disabled={!topics.length}>
              Collapse all
            </Button>
            <Button disabled={generateMutation.isPending} onClick={() => generateMutation.mutate()}>
              <Sparkles className="h-4 w-4" />
              {generateMutation.isPending ? "Generating…" : "Generate from materials"}
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search topics…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select
          className="sm:w-48"
          value={masteryFilter}
          onChange={(e) => setMasteryFilter(e.target.value)}
        >
          <option value="all">All mastery</option>
          <option value="weak">Weak</option>
          <option value="medium">Medium</option>
          <option value="strong">Strong</option>
          <option value="not_assessed">Not assessed</option>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          className="sm:ml-auto"
          onClick={() => void refetch()}
        >
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
      ) : topics.length === 0 ? (
        <EmptyState
          icon={Map}
          title="No topics yet"
          description="Generate your topic map from processed materials."
          action={
            <Button disabled={generateMutation.isPending} onClick={() => generateMutation.mutate()}>
              Generate topic map
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Map}
          title="No matching topics"
          description="Try a different search or mastery filter."
        />
      ) : (
        <Card>
          <CardContent className="p-3">
            {filtered.map((topic) => (
              <TopicNodeRow
                key={topic.id}
                topic={topic}
                depth={0}
                expanded={expanded}
                onToggle={toggle}
                onSelect={setSelected}
                selectedId={selected?.id}
              />
            ))}
          </CardContent>
        </Card>
      )}

      <TopicDetailDrawer topic={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
