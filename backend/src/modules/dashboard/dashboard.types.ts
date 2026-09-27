export interface DashboardFilters {
  fromDate?: string;
  toDate?: string;
}

export interface CumulativeItemSoldRow {
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

export interface CumulativeItemsSoldSummary {
  items: CumulativeItemSoldRow[];
  totalSalesQty: number;
  totalBaseSalesQty: number;
  totalFreeQty: number;
  totalChargeableQty: number;
  totalGrossValue: number;
  totalItemDiscount: number;
  totalNetItemsSoldValue: number;
}

export interface DashboardSalesSummary {
  grossSales: number;
  discount: number;
  netSales: number;
  emptyPacket: number;
  coupon: number;
  expectedHandover: number;
  dealerSales: number;
  salesmanSales: number;
}

export interface DashboardTargetSummary {
  totalDailyRevenueTarget: number;
  actualNetSales: number;
  targetAchievementAmount: number;
  targetRemainingAmount: number;
  achievementPercentage: number;
}

export interface DashboardCollectionSummary {
  expectedHandover: number;
  cashCollected: number;
  gpayCollected: number;
  collectionTotal: number;
  outstanding: number;
  excess: number;
}

export interface DashboardOutstandingSummary {
  totalOutstanding: number;
  totalExcess: number;
}

export interface DashboardExpenseSummary {
  office: number;
  house: number;
  gpi: number;
  emptyPacket: number;
  coupon: number;
  discount: number;
  operatingExpenses: number;
  totalCompanyCostImpact: number;
}

export interface DashboardPnlSummary {
  grossSales: number;
  discount: number;
  netRevenue: number;
  operatingExpenses: number;
  grossProfit: number;
}

export interface DashboardRecentActivityItem {
  id: string;
  handoverDate: string;
  recipientType: string;
  recipientName: string;
  netSales: number;
  expectedHandover: number;
  status: string;
}

export interface AdminDashboardResponse {
  period: {
    fromDate: string;
    toDate: string;
  };
  cumulativeItemsSold: CumulativeItemsSoldSummary;
  salesSummary: DashboardSalesSummary;
  targetSummary: DashboardTargetSummary;
  collectionSummary: DashboardCollectionSummary;
  outstandingSummary: DashboardOutstandingSummary;
  expenseSummary: DashboardExpenseSummary;
  pnlSummary: DashboardPnlSummary;
  recentActivity: DashboardRecentActivityItem[];
}
