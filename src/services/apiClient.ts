/**
 * Centralized API Client for Candy & Cigarette Management System.
 * Connects frontend client cleanly to backend /api/v1 endpoints.
 */

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: any;

  constructor(status: number, message: string, code?: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let inMemoryToken: string | null = null;

export const getAuthToken = (): string | null => {
  return inMemoryToken;
};

export const setAuthToken = (token: string): void => {
  inMemoryToken = token;
};

export const clearAuthToken = (): void => {
  inMemoryToken = null;
};

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
}

export class ApiClient {
  private static getBaseUrl(): string {
    const metaEnv = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env.VITE_API_BASE_URL : null;
    const procEnv = typeof globalThis !== 'undefined' && (globalThis as any).process?.env ? (globalThis as any).process.env.VITE_API_BASE_URL : null;
    const envBase = metaEnv || procEnv;
    if (envBase) {
      const trimmed = envBase.replace(/\/$/, '');
      if (trimmed.endsWith('/api/v1')) {
        return trimmed;
      }
      if (trimmed.endsWith('/api')) {
        return `${trimmed}/v1`;
      }
      return `${trimmed}/api/v1`;
    }
    return '/api/v1';
  }

  private static onUnauthorizedCallback: (() => void) | null = null;

  public static onUnauthorized(cb: () => void) {
    this.onUnauthorizedCallback = cb;
  }

  public static async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const baseUrl = this.getBaseUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    let url = `${baseUrl}${cleanEndpoint}`;

    // Append query params if provided
    if (options.params) {
      const searchParams = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      });
      const qs = searchParams.toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (options.body !== undefined && options.body !== null) {
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    }

    const token = getAuthToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        credentials: 'include',
        ...options,
        headers,
      });

      // Handle 401 Unauthorized
      if (response.status === 401) {
        if (!cleanEndpoint.includes('/auth/login')) {
          clearAuthToken();
          if (this.onUnauthorizedCallback) {
            this.onUnauthorizedCallback();
          }
        }
        throw new ApiError(401, 'Session expired or unauthorized. Please log in again.', 'UNAUTHORIZED');
      }

      let responseData: any = null;
      const text = await response.text();
      if (text) {
        try {
          responseData = JSON.parse(text);
        } catch {
          responseData = text;
        }
      }

      if (!response.ok) {
        const errorInfo = responseData?.error || responseData;
        let message =
          errorInfo?.message ||
          responseData?.message ||
          `Request failed with status ${response.status}`;

        if (errorInfo?.details && typeof errorInfo.details === 'object') {
          const detailKeys = Object.keys(errorInfo.details).filter((k) => k !== '_errors');
          if (detailKeys.length > 0) {
            const fieldIssues: string[] = [];
            for (const key of detailKeys) {
              const fieldObj = errorInfo.details[key];
              if (fieldObj?._errors && Array.isArray(fieldObj._errors) && fieldObj._errors.length > 0) {
                fieldIssues.push(fieldObj._errors.join(', '));
              }
            }
            if (fieldIssues.length > 0) {
              message = fieldIssues.join('; ');
            }
          }
        }

        const code = errorInfo?.code || responseData?.code;
        const details = errorInfo?.details || responseData?.details;

        throw new ApiError(response.status, message, code, details);
      }

      return (responseData?.data !== undefined ? responseData.data : responseData) as T;
    } catch (err: any) {
      if (err instanceof ApiError) {
        throw err;
      }
      throw new ApiError(0, err.message || 'Network error occurred. Please check your connection.');
    }
  }

  public static get<T = any>(endpoint: string, params?: RequestOptions['params'], headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', params, headers });
  }

  public static post<T = any>(endpoint: string, body?: any, params?: RequestOptions['params'], headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      params,
      headers,
    });
  }

  public static patch<T = any>(endpoint: string, body?: any, params?: RequestOptions['params'], headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      params,
      headers,
    });
  }

  public static delete<T = any>(endpoint: string, params?: RequestOptions['params'], headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', params, headers });
  }
}
