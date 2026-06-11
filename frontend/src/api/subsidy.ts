import request from "@/utils/request";
import axios from "axios";

export interface SubsidySummaryItem {
  elderlyId: string;
  name: string;
  idCard: string;
  community: string;
  subsidyCategory: string;
  mealCount: number;
  totalSubsidy: number;
  totalSelfPay: number;
  totalMealPrice: number;
}

export interface MonthlySummaryResponse {
  month: string;
  quota: {
    totalQuota: number;
    usedAmount: number;
    remainingAmount: number;
    status: string;
  };
  total: number;
  list: SubsidySummaryItem[];
  page: number;
  pageSize: number;
}

export interface CategoryStat {
  category: string;
  count: number;
  totalSubsidy: number;
}

export interface LedgerItem {
  _id: string;
  orderId: any;
  elderlyId: any;
  canteenId: any;
  mealDate: string;
  subsidyCategory: string;
  policyId: string;
  policyName: string;
  policyVersion: number;
  matchedRule: {
    elderlyCategories: string[];
    ageMin: number;
    ageMax: number | null;
    canteenTypes: string[];
    mealTypes: string[];
    subsidyType: string;
    subsidyValue: number;
    seniorBonus: number;
    seniorBonusAge: number;
    priority: number;
  };
  baseSubsidy: number;
  seniorSubsidy: number;
  totalSubsidy: number;
  mealPrice: number;
  selfPayAmount: number;
  calculationDetail: string;
  month: string;
}

export interface LedgerResponse {
  month: string;
  total: number;
  list: LedgerItem[];
  page: number;
  pageSize: number;
}

export interface PolicyStat {
  policyId: string;
  policyName: string;
  policyVersion: number;
  count: number;
  totalSubsidy: number;
  baseSubsidy: number;
  seniorSubsidy: number;
}

export interface CategoryRatioStat extends CategoryStat {
  ratio: number;
}

export interface MonthlyTrendItem {
  month: string;
  totalSubsidy: number;
  count: number;
  avgSubsidy: number;
  totalQuota: number;
  usedAmount: number;
  executionRate: number;
}

export interface AvgSubsidyStat {
  category: string;
  count: number;
  totalSubsidy: number;
  avgSubsidy: number;
}

export interface CanteenSummaryStat {
  canteenId: string;
  canteenName: string;
  subsidyCategory: string;
  count: number;
  totalSubsidy: number;
}

export function getMonthlySummary(params: {
  month?: string;
  page?: number;
  pageSize?: number;
}) {
  return request.get<any, MonthlySummaryResponse>("/subsidy/monthly-summary", {
    params,
  });
}

export function getSubsidyQuota(params?: { month?: string }) {
  return request.get<any, any>("/subsidy/quota", { params });
}

export function getCategoryStats(params?: { month?: string }) {
  return request.get<any, CategoryStat[]>("/subsidy/category-stats", {
    params,
  });
}

export function getLedger(params: {
  month?: string;
  canteenId?: string;
  subsidyCategory?: string;
  page?: number;
  pageSize?: number;
}) {
  return request.get<any, LedgerResponse>("/subsidy/ledger", { params });
}

export function getPolicyStats(params?: { month?: string }) {
  return request.get<any, PolicyStat[]>("/subsidy/stats/by-policy", {
    params,
  });
}

export function getCategoryRatioStats(params?: { month?: string }) {
  return request.get<any, CategoryRatioStat[]>(
    "/subsidy/stats/category-ratio",
    {
      params,
    },
  );
}

export function getMonthlyTrend(params?: { months?: number }) {
  return request.get<any, MonthlyTrendItem[]>("/subsidy/stats/monthly-trend", {
    params,
  });
}

export function getAvgSubsidyStats(params?: { month?: string }) {
  return request.get<any, AvgSubsidyStat[]>("/subsidy/stats/avg-subsidy", {
    params,
  });
}

export function getCanteenSummary(params?: { month?: string }) {
  return request.get<any, CanteenSummaryStat[]>(
    "/subsidy/stats/canteen-summary",
    {
      params,
    },
  );
}

export async function exportSubsidyCsv(
  month?: string,
  canteenId?: string,
  subsidyCategory?: string,
) {
  const token = localStorage.getItem("token") || "";
  const params = new URLSearchParams();
  if (month) params.set("month", month);
  if (canteenId) params.set("canteenId", canteenId);
  if (subsidyCategory) params.set("subsidyCategory", subsidyCategory);
  const url = `/api/subsidy/export-csv?${params.toString()}`;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      responseType: "blob",
    });

    const blob = new Blob([response.data], { type: "text/csv;charset=utf-8" });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    const fileName = month
      ? `subsidy-ledger-${month}.csv`
      : "subsidy-ledger.csv";
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error("导出CSV失败:", error);
    throw error;
  }
}
