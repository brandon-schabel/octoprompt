import { useMutation } from '@tanstack/react-query';
import { mastraApi } from '../api/mastra-api';
import { CodeChangeRequest, BatchSummarizeRequest, SummarizeFileRequest, CodeChangeResponse, BatchSummarizeResponse, SummarizeFileResponse } from '../api/mastra-api-types';

// Hook for codeChange API
export const useMastraCodeChange = () => {
  return useMutation<CodeChangeResponse, Error, CodeChangeRequest>(
    (requestData) => mastraApi.codeChange(requestData),
    {
      onError: (error) => {
        // Handle error, e.g., show a notification
        console.error('Error in useMastraCodeChange:', error);
      },
    }
  );
};

// Hook for batchSummarize API
export const useMastraBatchSummarize = () => {
  return useMutation<BatchSummarizeResponse, Error, BatchSummarizeRequest>(
    (requestData) => mastraApi.batchSummarize(requestData),
    {
      onError: (error) => {
        // Handle error
        console.error('Error in useMastraBatchSummarize:', error);
      },
    }
  );
};

// Hook for summarizeFile API
export const useMastraSummarizeFile = () => {
  return useMutation<SummarizeFileResponse, Error, SummarizeFileRequest>(
    (requestData) => mastraApi.summarizeFile(requestData),
    {
      onError: (error) => {
        // Handle error
        console.error('Error in useMastraSummarizeFile:', error);
      },
    }
  );
};
