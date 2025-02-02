import { useMutation, useQuery } from "@tanstack/react-query";
import { useApi } from "../use-api";

interface FileChangeRecord {
  id: number;
  filePath: string;
  originalContent: string;
  suggestedDiff: string;
  status: "pending" | "confirmed";
  timestamp: number;
}

interface GenerateChangeVariables {
  filePath: string;
  prompt: string;
}

interface GenerateChangeResult {
  changeId: number;
  diff: string;
}

export function useGenerateFileChange() {
  const { api } = useApi();

  return useMutation<GenerateChangeResult, Error, GenerateChangeVariables>({
    mutationFn: async ({ filePath, prompt }) => {
      const res = await api.request("/api/file/ai-change", {
        method: "POST",
        body: { filePath, prompt },
      });

      if (!res.ok) {
        throw new Error(`Failed to generate change: ${res.statusText}`);
      }

      const data = await res.json();
      return {
        changeId: data.changeId,
        diff: data.diff,
      };
    },
  });
}

export function useGetFileChange(changeId: number | null) {
  const { api } = useApi();

  return useQuery<FileChangeRecord | null>({
    queryKey: ["fileChange", changeId],
    queryFn: async () => {
      if (!changeId) return null;

      const res = await api.request(`/api/file/ai-change/${changeId}`);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`Failed to fetch change: ${res.statusText}`);
      }

      const data = await res.json();
      return data.change;
    },
    enabled: changeId !== null,
  });
}

export function useConfirmFileChange() {
  const { api } = useApi();

  return useMutation<boolean, Error, number>({
    mutationFn: async (changeId: number) => {
      const res = await api.request(`/api/file/ai-change/${changeId}/confirm`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error(`Failed to confirm change: ${res.statusText}`);
      }

      const data = await res.json();
      return data.success;
    },
  });
} 