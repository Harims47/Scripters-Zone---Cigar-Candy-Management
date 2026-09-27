import { PersonType } from '@prisma/client';

export interface PersonSummary {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  type: PersonType;
  active: boolean;
  hasUserAccount: boolean;
  username?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PersonFilterQuery {
  type?: PersonType;
  active?: boolean;
  search?: string;
}
