import { ApiClient, setAuthToken, clearAuthToken } from './apiClient';

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    username: string;
    email?: string | null;
    role: 'ADMIN' | 'SALESMAN';
    person: {
      id: string;
      name: string;
      phone?: string | null;
    } | null;
  };
}

export interface CurrentUser {
  id: string;
  username: string;
  email?: string | null;
  role: 'ADMIN' | 'SALESMAN';
  person: {
    id: string;
    name: string;
    phone?: string | null;
  } | null;
}

export type AuthMeResponse = CurrentUser & { user: CurrentUser };

export class AuthService {
  static async login(username: string, password: string): Promise<LoginResponse> {
    const data = await ApiClient.post<LoginResponse>('/auth/login', { username, password });
    if (data?.accessToken) {
      setAuthToken(data.accessToken);
    }
    return data;
  }

  static async getMe(): Promise<AuthMeResponse> {
    const res = await ApiClient.get<any>('/auth/me');
    if (res && !res.user) {
      res.user = { ...res };
    }
    return res as AuthMeResponse;
  }

  static async logout(): Promise<void> {
    try {
      await ApiClient.post('/auth/logout', {});
    } catch {
      // Best effort logout
    } finally {
      clearAuthToken();
    }
  }
}
