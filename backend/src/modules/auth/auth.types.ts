import { UserRole } from '@prisma/client';

export interface AuthLoginResponse {
  accessToken: string;
  user: {
    id: string;
    username: string;
    email: string | null;
    role: UserRole;
    person: {
      id: string;
      name: string;
      phone: string | null;
      type: string;
    } | null;
  };
}

export interface CurrentUserResponse {
  id: string;
  username: string;
  email: string | null;
  role: UserRole;
  isActive: boolean;
  person: {
    id: string;
    name: string;
    phone: string | null;
    type: string;
  } | null;
}
