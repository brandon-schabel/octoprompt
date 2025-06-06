import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mastraApi } from '../api/mastra-api';
import { useMastraCodeChange, useMastraBatchSummarize, useMastraSummarizeFile } from './mastra-hooks';
import { CodeChangeRequest, BatchSummarizeRequest, SummarizeFileRequest, CodeChangeResponse, BatchSummarizeResponse, SummarizeFileResponse } from '../api/mastra-api-types';

// Mock the mastraApi
jest.mock('../api/mastra-api', () => ({
  mastraApi: {
    codeChange: jest.fn(),
    batchSummarize: jest.fn(),
    summarizeFile: jest.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries for testing
      },
      mutations: {
        retry: false, // Disable retries for testing
      }
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Mastra Hooks', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Tests for useMastraCodeChange
  describe('useMastraCodeChange', () => {
    const mockRequest: CodeChangeRequest = {
      agentJobId: 1,
      selectedFileIds: ['file1'],
      projectFiles: [{ id: 'file1', path: 'path/to/file1.ts', content: 'content1', projectId: 1, name: 'file1.ts', extension: 'ts', checksum: 'sum1', size: 10, created: 0, updated: 0, projectPath: 'path/to/file1.ts' }],
      userInput: 'test input',
      prompts: [],
      project: { id: 1, name: 'Test Project', description: 'A test project' },
      projectFileMap: new Map(),
      projectSummaryContext: 'summary',
    };
    const mockResponse: CodeChangeResponse = { agentJobId: 1, status: 'completed', files: [] };
    const mockError = new Error('API Error CodeChange');

    it('should call mastraApi.codeChange and return data on success', async () => {
      (mastraApi.codeChange as jest.Mock).mockResolvedValue(mockResponse);
      const wrapper = createWrapper();
      const { result } = renderHook(() => useMastraCodeChange(), { wrapper });

      result.current.mutate(mockRequest);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mastraApi.codeChange).toHaveBeenCalledWith(mockRequest);
      expect(result.current.data).toEqual(mockResponse);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(false);
    });

    it('should return an error state when mastraApi.codeChange fails', async () => {
      (mastraApi.codeChange as jest.Mock).mockRejectedValue(mockError);
      const wrapper = createWrapper();
      const { result } = renderHook(() => useMastraCodeChange(), { wrapper });

      result.current.mutate(mockRequest);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(mastraApi.codeChange).toHaveBeenCalledWith(mockRequest);
      expect(result.current.error).toEqual(mockError);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSuccess).toBe(false);
    });

    it('should show loading state during mutation', async () => {
      (mastraApi.codeChange as jest.Mock).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockResponse), 100)));
      const wrapper = createWrapper();
      const { result } = renderHook(() => useMastraCodeChange(), { wrapper });

      result.current.mutate(mockRequest);

      expect(result.current.isLoading).toBe(true);
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.isSuccess).toBe(true);
    });
  });

  // Tests for useMastraBatchSummarize
  describe('useMastraBatchSummarize', () => {
    const mockRequest: BatchSummarizeRequest = { projectId: 1, fileIds: ['file1', 'file2'] };
    const mockResponse: BatchSummarizeResponse = { summaries: [{ fileId: 'file1', summary: 'summary1' }] };
    const mockError = new Error('API Error BatchSummarize');

    it('should call mastraApi.batchSummarize and return data on success', async () => {
      (mastraApi.batchSummarize as jest.Mock).mockResolvedValue(mockResponse);
      const wrapper = createWrapper();
      const { result } = renderHook(() => useMastraBatchSummarize(), { wrapper });

      result.current.mutate(mockRequest);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mastraApi.batchSummarize).toHaveBeenCalledWith(mockRequest);
      expect(result.current.data).toEqual(mockResponse);
      expect(result.current.isLoading).toBe(false);
    });

    it('should return an error state when mastraApi.batchSummarize fails', async () => {
      (mastraApi.batchSummarize as jest.Mock).mockRejectedValue(mockError);
      const wrapper = createWrapper();
      const { result } = renderHook(() => useMastraBatchSummarize(), { wrapper });

      result.current.mutate(mockRequest);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(mastraApi.batchSummarize).toHaveBeenCalledWith(mockRequest);
      expect(result.current.error).toEqual(mockError);
      expect(result.current.isLoading).toBe(false);
    });

     it('should show loading state during mutation', async () => {
      (mastraApi.batchSummarize as jest.Mock).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockResponse), 100)));
      const wrapper = createWrapper();
      const { result } = renderHook(() => useMastraBatchSummarize(), { wrapper });

      result.current.mutate(mockRequest);

      expect(result.current.isLoading).toBe(true);
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.isSuccess).toBe(true);
    });
  });

  // Tests for useMastraSummarizeFile
  describe('useMastraSummarizeFile', () => {
    const mockRequest: SummarizeFileRequest = { projectId: 1, fileId: 'file1' };
    const mockResponse: SummarizeFileResponse = { fileId: 'file1', summary: 'summary1' };
    const mockError = new Error('API Error SummarizeFile');

    it('should call mastraApi.summarizeFile and return data on success', async () => {
      (mastraApi.summarizeFile as jest.Mock).mockResolvedValue(mockResponse);
      const wrapper = createWrapper();
      const { result } = renderHook(() => useMastraSummarizeFile(), { wrapper });

      result.current.mutate(mockRequest);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mastraApi.summarizeFile).toHaveBeenCalledWith(mockRequest);
      expect(result.current.data).toEqual(mockResponse);
      expect(result.current.isLoading).toBe(false);
    });

    it('should return an error state when mastraApi.summarizeFile fails', async () => {
      (mastraApi.summarizeFile as jest.Mock).mockRejectedValue(mockError);
      const wrapper = createWrapper();
      const { result } = renderHook(() => useMastraSummarizeFile(), { wrapper });

      result.current.mutate(mockRequest);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(mastraApi.summarizeFile).toHaveBeenCalledWith(mockRequest);
      expect(result.current.error).toEqual(mockError);
      expect(result.current.isLoading).toBe(false);
    });

    it('should show loading state during mutation', async () => {
      (mastraApi.summarizeFile as jest.Mock).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockResponse), 100)));
      const wrapper = createWrapper();
      const { result } = renderHook(() => useMastraSummarizeFile(), { wrapper });

      result.current.mutate(mockRequest);

      expect(result.current.isLoading).toBe(true);
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
