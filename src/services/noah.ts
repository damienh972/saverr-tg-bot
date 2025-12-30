import dotenv from "dotenv";

dotenv.config();

const NOAH_API_URL =
  process.env.NOAH_API_URL || "https://api.sandbox.noah.com/v1";
const NOAH_API_KEY = process.env.NOAH_API_KEY;

interface HostedOnboardingRequest {
  ReturnURL: string;
  FiatOptions: { FiatCurrencyCode: string }[];
  Metadata?: Record<string, string>;
  Form?: Record<string, any>;
}

interface HostedSessionResponse {
  HostedURL: string;
}

class NoahClient {
  private baseURL: string;
  private apiKey: string;

  constructor(baseURL: string, apiKey: string) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    const url = `${this.baseURL}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Api-Key": this.apiKey,
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Noah API Error: ${response.status} - ${
          error.Detail || response.statusText
        }`
      );
    }

    return response.json();
  }

  async createOnboardingSession(
    customerId: string,
    request: HostedOnboardingRequest
  ): Promise<HostedSessionResponse> {
    return this.request<HostedSessionResponse>(
      "POST",
      `/onboarding/${customerId}`,
      request
    );
  }
}

// Only create client if API key is provided
export const noahClient = NOAH_API_KEY
  ? new NoahClient(NOAH_API_URL, NOAH_API_KEY)
  : null;
