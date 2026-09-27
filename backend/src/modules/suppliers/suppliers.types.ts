export interface SupplierSummary {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
