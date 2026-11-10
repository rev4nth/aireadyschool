import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { listSubjects } from "@/services/subjects";
import type { Subject } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

interface SubjectContextValue {
  subjects: Subject[];
  currentSubject: Subject | null;
  currentSubjectId: string | null;
  setCurrentSubjectId: (id: string | null) => void;
  isLoading: boolean;
  refetch: () => void;
}

const SubjectContext = createContext<SubjectContextValue | undefined>(undefined);
const STORAGE_KEY = "gapfinder-current-subject";

export function SubjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentSubjectId, setCurrentSubjectIdState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY),
  );

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ["subjects", user?.id],
    queryFn: listSubjects,
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (!data.length) return;
    if (currentSubjectId && data.some((s) => s.id === currentSubjectId)) return;
    setCurrentSubjectIdState(data[0].id);
  }, [data, currentSubjectId]);

  const setCurrentSubjectId = useCallback((id: string | null) => {
    setCurrentSubjectIdState(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const currentSubject = useMemo(
    () => data.find((s) => s.id === currentSubjectId) ?? null,
    [data, currentSubjectId],
  );

  const value = useMemo(
    () => ({
      subjects: data,
      currentSubject,
      currentSubjectId,
      setCurrentSubjectId,
      isLoading,
      refetch: () => {
        void refetch();
      },
    }),
    [data, currentSubject, currentSubjectId, setCurrentSubjectId, isLoading, refetch],
  );

  return <SubjectContext.Provider value={value}>{children}</SubjectContext.Provider>;
}

export function useSubject() {
  const ctx = useContext(SubjectContext);
  if (!ctx) throw new Error("useSubject must be used within SubjectProvider");
  return ctx;
}
