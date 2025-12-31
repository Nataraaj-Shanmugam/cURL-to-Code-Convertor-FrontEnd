import { apiClient } from "./apiClient";

export interface FeedbackRequest {
  email?: string;
  category: string;
  details: string;
  metadata?: {
    userAgent: string;
    pageUrl: string;
    timestamp: string;
    screenResolution: string;
  };
}

export interface FeedbackResponse {
  success: boolean;
  message?: string;
  error?: {
    message: string;
  };
}

export const feedbackApi = {
  /**
   * Submit user feedback
   * Maps to: POST /api/feedback
   */
  submit: async (feedback: FeedbackRequest): Promise<FeedbackResponse> => {
    const { data } = await apiClient.post<FeedbackResponse>(
      import.meta.env.VITE_CURL_CRAFT_API_FEEDBACK_ENDPOINT,
      feedback
    );
    return data;
  },
};