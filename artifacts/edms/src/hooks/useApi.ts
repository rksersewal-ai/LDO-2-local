import { useMutation, useQuery } from "@tanstack/react-query";
import type { AxiosError, AxiosResponse } from "axios";
import type { ListQueryParams, SearchScope } from "../lib/types";
import apiClient from "../services/ApiClient";

interface UseApiOptions<T = unknown> {
  onSuccess?: (data: T) => void;
  onError?: (error: AxiosError) => void;
  autoFetch?: boolean;
}

export function useApiGet<T = unknown>(url: string, options: UseApiOptions<T> = {}) {
  const { data, isLoading, error, refetch } = useQuery<T, AxiosError>({
    queryKey: [url],
    queryFn: async () => {
      const response = await apiClient.client.get(url);
      return response.data;
    },
    enabled: options.autoFetch !== false,
  });

  return {
    data: data || null,
    loading: isLoading,
    error: error ? apiClient.getErrorMessage(error) : null,
    refetch,
  };
}

export function useApiMutation<T = unknown, D = unknown>(
  method: "post" | "patch" | "put" | "delete" = "post",
  options: UseApiOptions<T> = {},
) {
  const mutation = useMutation<T, AxiosError, { url: string; data?: D }>({
    mutationFn: async ({ url, data }) => {
      let response: AxiosResponse;
      if (method === "delete") {
        response = await apiClient.client.delete(url);
      } else {
        response = await apiClient.client[method](url, data);
      }
      return response.data;
    },
    onSuccess: (data) => options.onSuccess?.(data),
    onError: (err) => options.onError?.(err),
  });

  return {
    data: mutation.data || null,
    loading: mutation.isPending,
    error: mutation.error ? apiClient.getErrorMessage(mutation.error) : null,
    mutate: (url: string, data?: D) => mutation.mutateAsync({ url, data }),
  };
}

export function useDocumentList(query?: ListQueryParams) {
  const result = useQuery({
    queryKey: ["documents", query],
    queryFn: () => apiClient.getDocuments(query),
  });

  const createMutation = useApiMutation("post");
  const updateMutation = useApiMutation("patch");
  const deleteMutation = useApiMutation("delete");

  return {
    data: result.data || null,
    loading: result.isLoading,
    error: result.error ? apiClient.getErrorMessage(result.error as AxiosError) : null,
    refetch: result.refetch,
    createDocument: (data: FormData) => createMutation.mutate("/documents/", data),
    updateDocument: (id: string, data: any) => updateMutation.mutate(`/documents/${id}/`, data),
    deleteDocument: (id: string) => deleteMutation.mutate(`/documents/${id}/`),
  };
}

export function useWorkRecordList(query?: ListQueryParams) {
  const result = useQuery({
    queryKey: ["work-records", query],
    queryFn: () => apiClient.getWorkRecords(query),
  });

  const createMutation = useApiMutation("post");
  const updateMutation = useApiMutation("patch");
  const deleteMutation = useApiMutation("delete");

  return {
    data: result.data || null,
    loading: result.isLoading,
    error: result.error ? apiClient.getErrorMessage(result.error as AxiosError) : null,
    refetch: result.refetch,
    createRecord: (data: any) => createMutation.mutate("/work-records/", data),
    updateRecord: (id: string, data: any) => updateMutation.mutate(`/work-records/${id}/`, data),
    deleteRecord: (id: string) => deleteMutation.mutate(`/work-records/${id}/`),
  };
}

export function useDocuments() {
  const list = useDocumentList();
  return {
    documents: list.data?.items || [],
    loading: list.loading,
    error: list.error,
    refetch: list.refetch,
    createDocument: list.createDocument,
    updateDocument: list.updateDocument,
    deleteDocument: list.deleteDocument,
  };
}

export function useWorkRecords() {
  const list = useWorkRecordList();
  return {
    records: list.data?.items || [],
    loading: list.loading,
    error: list.error,
    refetch: list.refetch,
    createRecord: list.createRecord,
    updateRecord: list.updateRecord,
    deleteRecord: list.deleteRecord,
  };
}

export function useSearch(query: string, scope?: SearchScope) {
  const result = useQuery({
    queryKey: ["search", query, scope],
    queryFn: () => apiClient.search(query, scope),
    enabled: false, // Legacy search implementation expects manual triggering
  });

  return {
    data: result.data || null,
    loading: result.isFetching,
    error: result.error ? apiClient.getErrorMessage(result.error as AxiosError) : null,
    search: () => {
      if (query.trim()) {
        result.refetch();
      }
    },
  };
}
