export interface DealerSummary {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  active: boolean;
  hasUserAccount: false;
  createdAt: Date;
  updatedAt: Date;
}
