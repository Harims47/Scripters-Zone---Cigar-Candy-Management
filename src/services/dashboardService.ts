import { ApiClient } from './apiClient';

export interface BackendCumulativeItemSold {
  productId: string;
  productName: string;
  productSku: string | null;
  category: string;
  brand: string;
  salesQuantity: number;
  baseSalesQuantity: number;
  freeQuantity: number;
  chargeableQuantity: number;
  grossSalesValue: number;
  itemDiscount: number;
  netItemSalesValue: number;
}

export interface BackendDashboardData {
  period: {
    fromDate: string;
    toDate: string;
  };
  cumulativeItemsSold: {
    items: BackendCumulativeItemSold[];
    totalSalesQty: number;
    totalBaseSalesQty: number;
    totalFreeQty: number;
    totalChargeableQty: number;
    totalGrossValue: number;
    totalItemDiscount: number;
    totalNetItemsSoldValue: number;
  };
  salesSummary: {
    grossSales: number;
    discount: number;
    netSales: number;
    emptyPacket: number;
    coupon: number;
    expectedHandover: number;
    dealerSales: number;
    salesmanSales: number;
  };
  targetSummary: {
    totalDailyRevenueTarget: number;
    actualNetSales: number;
    targetAchievementAmount: number;
    targetRemainingAmount: number;
    achievementPercentage: number;
  };
  collectionSummary: {
    expectedHandover: number;
    cashCollected: number;
    gpayCollected: number;
    collectionTotal: number;
    outstanding: number;
    excess: number;
  };
  outstandingSummary: {
    totalOutstanding: number;
    totalExcess: number;
  };
  expenseSummary: {
    office: number;
    house: number;
    gpi: number;
    emptyPacket: number;
    coupon: number;
    discount: number;
    operatingExpenses: number;
    totalCompanyCostImpact: number;
  };
  pnlSummary: {
    grossSales: number;
    discount: number;
    netRevenue: number;
    operatingExpenses: number;
    grossProfit: number;
  };
  recentActivity: Array<{
    id: string;
    handoverDate: string;
    recipientType: string;
    recipientName: string;
    netSales: number;
    expectedHandover: number;
    status: string;
  }>;
}

export class DashboardService {
  static async getAdminDashboard(params?: { fromDate?: string; toDate?: string }) {
    return ApiClient.get<BackendDashboardData>('/dashboard/admin', params);
  }
}
