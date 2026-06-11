import mongoose from "mongoose";

export type ElderlyCategory =
  | "dibao"
  | "low_income"
  | "tekun"
  | "normal"
  | "jihua_tefu";
export type SubsidyType = "fixed" | "percentage";
export type PolicyStatus = "draft" | "active" | "expired";

export interface ISubsidyRule {
  elderlyCategories: ElderlyCategory[];
  ageMin: number;
  ageMax: number | null;
  canteenTypes: string[];
  mealTypes: ("lunch" | "dinner")[];
  subsidyType: SubsidyType;
  subsidyValue: number;
  seniorBonus: number;
  seniorBonusAge: number;
  priority: number;
}

export interface ISubsidyPolicy extends mongoose.Document {
  name: string;
  version: number;
  effectiveDate: Date;
  expiryDate: Date;
  status: PolicyStatus;
  previousVersionId: mongoose.Types.ObjectId | null;
  rules: ISubsidyRule[];
  createdBy: mongoose.Types.ObjectId;
  description: string;
}

const subsidyRuleSchema = new mongoose.Schema<ISubsidyRule>(
  {
    elderlyCategories: [
      {
        type: String,
        enum: ["dibao", "low_income", "tekun", "normal", "jihua_tefu"],
        required: true,
      },
    ],
    ageMin: { type: Number, required: true, min: 0 },
    ageMax: { type: Number, default: null },
    canteenTypes: [{ type: String }],
    mealTypes: [
      {
        type: String,
        enum: ["lunch", "dinner"],
        required: true,
      },
    ],
    subsidyType: {
      type: String,
      enum: ["fixed", "percentage"],
      required: true,
    },
    subsidyValue: { type: Number, required: true, min: 0 },
    seniorBonus: { type: Number, default: 0, min: 0 },
    seniorBonusAge: { type: Number, default: 80, min: 0 },
    priority: { type: Number, default: 0 },
  },
  { _id: true },
);

const subsidyPolicySchema = new mongoose.Schema<ISubsidyPolicy>(
  {
    name: { type: String, required: true },
    version: { type: Number, required: true, min: 1 },
    effectiveDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["draft", "active", "expired"],
      default: "draft",
    },
    previousVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubsidyPolicy",
      default: null,
    },
    rules: [subsidyRuleSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    description: { type: String, default: "" },
  },
  { timestamps: true },
);

subsidyPolicySchema.index({ status: 1, effectiveDate: -1 });
subsidyPolicySchema.index({ name: 1, version: 1 }, { unique: true });

export const SubsidyPolicy = mongoose.model<ISubsidyPolicy>(
  "SubsidyPolicy",
  subsidyPolicySchema,
);
