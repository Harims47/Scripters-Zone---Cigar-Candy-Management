export interface PnLFilters {
  fromDate?: string;
  toDate?: string;
}

export interface PnLReportResponse {
  period: {
    fromDate?: string;
    toDate?: string;
  };
  grossSales: number;
  discount: number;
  netRevenue: number;

  officeExpense: number;
  houseExpense: number;
  gpiExpense: number;
  emptyPacketExpense: number;
  couponExpense: number;

  operatingExpenses: number;
  grossProfit: number;

  collectionTotal: number;
  outstanding: number;
  excess: number;
}
