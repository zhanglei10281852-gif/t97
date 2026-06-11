import mongoose from "mongoose";

export interface IMatchedRule {
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
}

export interface ISubsidyRecord extends mongoose.Document {
  orderId: mongoose.Types.ObjectId;
  elderlyId: mongoose.Types.ObjectId;
  canteenId: mongoose.Types.ObjectId;
  mealDate: Date;
  subsidyCategory: string;
  policyId: mongoose.Types.ObjectId;
  policyName: string;
  policyVersion: number;
  matchedRule: IMatchedRule;
  baseSubsidy: number;
  seniorSubsidy: number;
  totalSubsidy: number;
  mealPrice: number;
  selfPayAmount: number;
  calculationDetail: string;
  month: string;
  settled: boolean;
}

const matchedRuleSchema = new mongoose.Schema<IMatchedRule>(
  {
    elderlyCategories: [{ type: String }],
    ageMin: { type: Number },
    ageMax: { type: Number, default: null },
    canteenTypes: [{ type: String }],
    mealTypes: [{ type: String }],
    subsidyType: { type: String },
    subsidyValue: { type: Number },
    seniorBonus: { type: Number },
    seniorBonusAge: { type: Number },
    priority: { type: Number },
  },
  { _id: false },
);

const subsidyRecordSchema = new mongoose.Schema<ISubsidyRecord>(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
    },
    elderlyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Elderly",
      required: true,
    },
    canteenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Canteen",
      required: true,
    },
    mealDate: { type: Date, required: true },
    subsidyCategory: { type: String, required: true },
    policyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubsidyPolicy",
      required: true,
    },
    policyName: { type: String, required: true },
    policyVersion: { type: Number, required: true },
    matchedRule: { type: matchedRuleSchema, required: true },
    baseSubsidy: { type: Number, required: true, default: 0 },
    seniorSubsidy: { type: Number, required: true, default: 0 },
    totalSubsidy: { type: Number, required: true, default: 0 },
    mealPrice: { type: Number, required: true, default: 0 },
    selfPayAmount: { type: Number, required: true, default: 0 },
    calculationDetail: { type: String, default: "" },
    month: { type: String, required: true },
    settled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

subsidyRecordSchema.index({ month: 1, elderlyId: 1 });
subsidyRecordSchema.index({ month: 1, canteenId: 1 });
subsidyRecordSchema.index({ policyId: 1 });
subsidyRecordSchema.index({ month: 1, subsidyCategory: 1 });

export const SubsidyRecord = mongoose.model<ISubsidyRecord>(
  "SubsidyRecord",
  subsidyRecordSchema,
);
