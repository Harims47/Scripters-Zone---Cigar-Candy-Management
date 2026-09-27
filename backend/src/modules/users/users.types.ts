import { UserRole } from '@prisma/client';

export interface UserSummary {
  id: string;
  username: string;
  email: string | null;
  role: UserRole;
  isActive: boolean;
  personId: string | null;
  person?: {
    id: string;
    name: string;
    phone: string | null;
    type: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}
