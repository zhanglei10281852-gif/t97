import request from "@/utils/request";
import axios from "axios";

export interface SubsidyRule {
  _id?: string;
  elderlyCategories: string[];
  ageMin: number;
  ageMax: number | null;
  canteenTypes: string[];
  mealTypes: string[];
  subsidyType: "fixed" | "percentage";
  subsidyValue: number;
  seniorBonus: number;
  seniorBonusAge: number;
  priority: number;
}

export interface SubsidyPolicy {
  _id: string;
  name: string;
  version: number;
  effectiveDate: string;
  expiryDate: string;
  status: "draft" | "active" | "expired";
  previousVersionId: string | null;
  rules: SubsidyRule[];
  createdBy: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyListResponse {
  total: number;
  list: SubsidyPolicy[];
  page: number;
  pageSize: number;
}

export interface SimulationResult {
  totalOrders: number;
  newTotalSubsidy: number;
  oldTotalSubsidy: number;
  diffTotal: number;
  diffPercent: number;
  results: {
    elderlyId: string;
    elderlyName: string;
    mealPrice: number;
    mealType: string;
    oldSubsidy: number;
    newSubsidy: number;
    diff: number;
    oldDetail: string;
    newDetail: string;
  }[];
}

export interface HistoricalCalcResult {
  date: string;
  elderlyId: string;
  canteenId: string;
  mealPrice: number;
  mealType: string;
  baseSubsidy: number;
  seniorSubsidy: number;
  totalSubsidy: number;
  selfPayAmount: number;
  calculationDetail: string;
}

export function getPolicyList(params: {
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  return request.get<any, PolicyListResponse>("/policy", { params });
}

export function getActivePolicy() {
  return request.get<any, SubsidyPolicy>("/policy/active");
}

export function getPolicyDetail(id: string) {
  return request.get<any, SubsidyPolicy>(`/policy/${id}`);
}

export function createPolicy(data: {
  name: string;
  effectiveDate: string;
  expiryDate: string;
  rules: SubsidyRule[];
  description?: string;
}) {
  return request.post<any, SubsidyPolicy>("/policy", data);
}

export function updatePolicy(
  id: string,
  data: {
    name?: string;
    effectiveDate?: string;
    expiryDate?: string;
    rules?: SubsidyRule[];
    description?: string;
  },
) {
  return request.put<any, SubsidyPolicy>(`/policy/${id}`, data);
}

export function activatePolicy(id: string) {
  return request.post<any, SubsidyPolicy>(`/policy/${id}/activate`);
}

export function createNewVersion(
  id: string,
  data: {
    effectiveDate: string;
    expiryDate: string;
    rules?: SubsidyRule[];
    description?: string;
  },
) {
  return request.post<any, SubsidyPolicy>(`/policy/${id}/new-version`, data);
}

export function getVersionHistory(id: string) {
  return request.get<any, SubsidyPolicy[]>(`/policy/${id}/version-history`);
}

export function simulatePolicy(data: {
  policyId: string;
  orders: {
    elderlyId: string;
    canteenId: string;
    mealPrice?: number;
    mealType?: string;
    orderDate?: string;
  }[];
}) {
  return request.post<any, SimulationResult>("/policy/simulate", data);
}

export function calculateHistorical(data: {
  elderlyId: string;
  canteenId: string;
  mealPrice: number;
  mealType: string;
  date: string;
}) {
  return request.post<any, HistoricalCalcResult>(
    "/policy/calculate-historical",
    data,
  );
}
