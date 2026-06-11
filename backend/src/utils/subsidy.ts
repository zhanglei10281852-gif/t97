import { IElderly } from "../models/Elderly";
import { ISubsidyPolicy, ISubsidyRule } from "../models/SubsidyPolicy";
import { ICanteen } from "../models/Canteen";
import { IMatchedRule } from "../models/SubsidyRecord";
import { SubsidyPolicy } from "../models/SubsidyPolicy";

export const MEAL_PRICES: Record<string, number> = {
  A: 12,
  B: 15,
  C: 18,
};

export interface SubsidyCalculation {
  baseSubsidy: number;
  seniorSubsidy: number;
  totalSubsidy: number;
  selfPayAmount: number;
  matchedPolicy: ISubsidyPolicy | null;
  matchedRule: ISubsidyRule | null;
  calculationDetail: string;
}

export interface OrderContext {
  elderly: IElderly;
  canteen: ICanteen;
  mealType: "lunch" | "dinner";
  mealPrice: number;
  orderDate: Date;
}

function matchesRule(
  rule: ISubsidyRule,
  elderlyCategory: string,
  age: number,
  canteenType: string,
  mealType: string,
): boolean {
  if (
    rule.elderlyCategories.length > 0 &&
    !rule.elderlyCategories.includes(elderlyCategory as any)
  ) {
    return false;
  }

  if (age < rule.ageMin) {
    return false;
  }
  if (rule.ageMax !== null && age > rule.ageMax) {
    return false;
  }

  if (
    rule.canteenTypes.length > 0 &&
    !rule.canteenTypes.includes(canteenType)
  ) {
    return false;
  }

  if (rule.mealTypes.length > 0 && !rule.mealTypes.includes(mealType as any)) {
    return false;
  }

  return true;
}

function calculateFromRule(
  rule: ISubsidyRule,
  mealPrice: number,
  age: number,
): {
  baseSubsidy: number;
  seniorSubsidy: number;
  totalSubsidy: number;
  selfPayAmount: number;
  detail: string;
} {
  let baseSubsidy: number;
  let detailParts: string[] = [];

  if (rule.subsidyType === "fixed") {
    baseSubsidy = rule.subsidyValue;
    detailParts.push(`基础补贴: 固定${rule.subsidyValue}元`);
  } else {
    baseSubsidy =
      Math.round(((mealPrice * rule.subsidyValue) / 100) * 100) / 100;
    detailParts.push(
      `基础补贴: 餐费${mealPrice}元×${rule.subsidyValue}%=${baseSubsidy}元`,
    );
  }

  let seniorSubsidy = 0;
  if (age >= rule.seniorBonusAge && rule.seniorBonus > 0) {
    seniorSubsidy = rule.seniorBonus;
    detailParts.push(
      `高龄补贴: ${age}岁≥${rule.seniorBonusAge}岁，额外${rule.seniorBonus}元`,
    );
  }

  let totalSubsidy = baseSubsidy + seniorSubsidy;

  if (totalSubsidy > mealPrice) {
    detailParts.push(
      `封顶调整: 补贴${totalSubsidy}元>餐费${mealPrice}元，补贴封顶为${mealPrice}元`,
    );
    totalSubsidy = mealPrice;
    baseSubsidy = Math.min(baseSubsidy, totalSubsidy);
    seniorSubsidy = totalSubsidy - baseSubsidy;
  }

  const selfPayAmount = mealPrice - totalSubsidy;
  detailParts.push(`自付: ${selfPayAmount}元`);

  return {
    baseSubsidy,
    seniorSubsidy,
    totalSubsidy,
    selfPayAmount,
    detail: detailParts.join("；"),
  };
}

export async function findActivePolicy(
  date: Date,
): Promise<ISubsidyPolicy | null> {
  const policy = await SubsidyPolicy.findOne({
    status: "active",
    effectiveDate: { $lte: date },
    expiryDate: { $gt: date },
  }).sort({ effectiveDate: -1 });

  return policy;
}

export async function findPolicyByDate(
  date: Date,
): Promise<ISubsidyPolicy | null> {
  const policy = await SubsidyPolicy.findOne({
    effectiveDate: { $lte: date },
    expiryDate: { $gt: date },
  }).sort({ effectiveDate: -1, version: -1 });

  return policy;
}

export function calculateSubsidyForOrder(
  policy: ISubsidyPolicy,
  context: OrderContext,
): SubsidyCalculation {
  const { elderly, canteen, mealType, mealPrice, orderDate } = context;

  const matchedRules = policy.rules.filter((rule: ISubsidyRule) =>
    matchesRule(
      rule,
      elderly.subsidyCategory,
      elderly.age,
      canteen.canteenType,
      mealType,
    ),
  );

  if (matchedRules.length === 0) {
    return {
      baseSubsidy: 0,
      seniorSubsidy: 0,
      totalSubsidy: 0,
      selfPayAmount: mealPrice,
      matchedPolicy: policy,
      matchedRule: null,
      calculationDetail: `政策"${policy.name}"(v${policy.version})无匹配规则`,
    };
  }

  const bestRule = matchedRules.reduce(
    (best: ISubsidyRule, current: ISubsidyRule) => {
      const currentResult = calculateFromRule(current, mealPrice, elderly.age);
      const bestResult = calculateFromRule(best, mealPrice, elderly.age);
      if (currentResult.totalSubsidy > bestResult.totalSubsidy) {
        return current;
      }
      if (
        currentResult.totalSubsidy === bestResult.totalSubsidy &&
        current.priority > best.priority
      ) {
        return current;
      }
      return best;
    },
  );

  const calc = calculateFromRule(bestRule, mealPrice, elderly.age);

  return {
    ...calc,
    matchedPolicy: policy,
    matchedRule: bestRule,
    calculationDetail: `政策"${policy.name}"(v${policy.version})；${calc.detail}`,
  };
}

export async function calculateSubsidy(
  elderly: IElderly,
  mealPrice: number,
  canteen: ICanteen,
  mealType: "lunch" | "dinner",
  orderDate?: Date,
): Promise<SubsidyCalculation> {
  const date = orderDate || new Date();
  const policy = await findPolicyByDate(date);

  if (!policy) {
    return {
      baseSubsidy: 0,
      seniorSubsidy: 0,
      totalSubsidy: 0,
      selfPayAmount: mealPrice,
      matchedPolicy: null,
      matchedRule: null,
      calculationDetail: `未找到${date.toISOString().slice(0, 10)}生效的补贴政策`,
    };
  }

  const context: OrderContext = {
    elderly,
    canteen,
    mealType,
    mealPrice,
    orderDate: date,
  };

  return calculateSubsidyForOrder(policy, context);
}

export function ruleToMatchedRule(rule: ISubsidyRule): IMatchedRule {
  return {
    elderlyCategories: [...rule.elderlyCategories],
    ageMin: rule.ageMin,
    ageMax: rule.ageMax,
    canteenTypes: [...rule.canteenTypes],
    mealTypes: [...rule.mealTypes],
    subsidyType: rule.subsidyType,
    subsidyValue: rule.subsidyValue,
    seniorBonus: rule.seniorBonus,
    seniorBonusAge: rule.seniorBonusAge,
    priority: rule.priority,
  };
}

let orderCounter = 0;

export function generateOrderNo(): string {
  orderCounter++;
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = now.getTime().toString().slice(-6);
  const counterStr = orderCounter.toString().padStart(6, "0");
  return `ORD${dateStr}${timeStr}${counterStr}`;
}

export function getMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${year}-${month}`;
}
