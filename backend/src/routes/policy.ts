import { Router, Request, Response } from "express";
import { SubsidyPolicy, ISubsidyPolicy } from "../models/SubsidyPolicy";
import { Order } from "../models/Order";
import { Elderly } from "../models/Elderly";
import { Canteen } from "../models/Canteen";
import { SubsidyRecord } from "../models/SubsidyRecord";
import { MonthlySubsidyQuota } from "../models/MonthlySubsidyQuota";
import { authMiddleware, requireRoles } from "../middleware/auth";
import {
  calculateSubsidyForOrder,
  findPolicyByDate,
  calculateSubsidy,
  ruleToMatchedRule,
  OrderContext,
} from "../utils/subsidy";
import { config } from "../config";

const router = Router();

router.use(authMiddleware);
router.use(requireRoles("admin"));

router.get("/", async (req: Request, res: Response) => {
  try {
    const { status = "", page = "1", pageSize = "10" } = req.query;

    const query: any = {};
    if (status) query.status = status;

    const pageNum = parseInt(page as string, 10);
    const size = parseInt(pageSize as string, 10);
    const skip = (pageNum - 1) * size;

    const [total, list] = await Promise.all([
      SubsidyPolicy.countDocuments(query),
      SubsidyPolicy.find(query)
        .populate("createdBy", "username")
        .populate("previousVersionId", "name version")
        .skip(skip)
        .limit(size)
        .sort({ createdAt: -1 }),
    ]);

    res.json({ total, list, page: pageNum, pageSize: size });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取政策列表失败" });
  }
});

router.get("/active", async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const policy = await SubsidyPolicy.findOne({
      status: "active",
      effectiveDate: { $lte: now },
      expiryDate: { $gt: now },
    }).sort({ effectiveDate: -1 });

    res.json(policy);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取当前生效政策失败" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const policy = await SubsidyPolicy.findById(req.params.id)
      .populate("createdBy", "username")
      .populate("previousVersionId", "name version");

    if (!policy) {
      return res.status(404).json({ message: "政策不存在" });
    }

    res.json(policy);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取政策详情失败" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, effectiveDate, expiryDate, rules, description } = req.body;

    if (
      !name ||
      !effectiveDate ||
      !expiryDate ||
      !rules ||
      rules.length === 0
    ) {
      return res
        .status(400)
        .json({ message: "政策名称、生效日期、失效日期和规则明细不能为空" });
    }

    if (new Date(effectiveDate) >= new Date(expiryDate)) {
      return res.status(400).json({ message: "生效日期必须早于失效日期" });
    }

    const lastPolicy = await SubsidyPolicy.findOne({ name }).sort({
      version: -1,
    });
    const version = lastPolicy ? lastPolicy.version + 1 : 1;

    const policy = new SubsidyPolicy({
      name,
      version,
      effectiveDate: new Date(effectiveDate),
      expiryDate: new Date(expiryDate),
      status: "draft",
      previousVersionId: lastPolicy?._id || null,
      rules,
      createdBy: req.user?._id,
      description: description || "",
    });

    await policy.save();
    res.status(201).json(policy);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message || "创建政策失败" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const policy = await SubsidyPolicy.findById(req.params.id);
    if (!policy) {
      return res.status(404).json({ message: "政策不存在" });
    }

    if (policy.status === "active" || policy.status === "expired") {
      return res
        .status(400)
        .json({ message: "已生效或已失效的政策不能修改，请新建版本" });
    }

    const { name, effectiveDate, expiryDate, rules, description } = req.body;

    if (effectiveDate) policy.effectiveDate = new Date(effectiveDate);
    if (expiryDate) policy.expiryDate = new Date(expiryDate);
    if (description !== undefined) policy.description = description;
    if (rules) policy.rules = rules;

    await policy.save();
    res.json(policy);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message || "更新政策失败" });
  }
});

router.post("/:id/activate", async (req: Request, res: Response) => {
  try {
    const policy = await SubsidyPolicy.findById(req.params.id);
    if (!policy) {
      return res.status(404).json({ message: "政策不存在" });
    }

    if (policy.status !== "draft") {
      return res.status(400).json({ message: "只有草稿状态的政策可以激活" });
    }

    const now = new Date();
    if (new Date(policy.effectiveDate) > now) {
      return res.status(400).json({ message: "生效日期未到，不能激活" });
    }

    if (new Date(policy.expiryDate) <= now) {
      return res.status(400).json({ message: "政策已过失效日期，不能激活" });
    }

    await SubsidyPolicy.updateMany(
      {
        status: "active",
        effectiveDate: { $lte: now },
        expiryDate: { $gt: now },
      },
      { status: "expired" },
    );

    policy.status = "active";
    await policy.save();

    res.json(policy);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message || "激活政策失败" });
  }
});

router.post("/:id/new-version", async (req: Request, res: Response) => {
  try {
    const oldPolicy = await SubsidyPolicy.findById(req.params.id);
    if (!oldPolicy) {
      return res.status(404).json({ message: "原政策不存在" });
    }

    const { effectiveDate, expiryDate, rules, description } = req.body;

    if (!effectiveDate || !expiryDate) {
      return res
        .status(400)
        .json({ message: "新版本必须指定生效日期和失效日期" });
    }

    if (new Date(effectiveDate) <= new Date(oldPolicy.effectiveDate)) {
      return res
        .status(400)
        .json({ message: "新版本的生效日期必须晚于旧版本" });
    }

    const version = oldPolicy.version + 1;

    const newPolicy = new SubsidyPolicy({
      name: oldPolicy.name,
      version,
      effectiveDate: new Date(effectiveDate),
      expiryDate: new Date(expiryDate),
      status: "draft",
      previousVersionId: oldPolicy._id,
      rules: rules || oldPolicy.rules.map((r: any) => r.toObject()),
      createdBy: req.user?._id,
      description: description || oldPolicy.description,
    });

    await newPolicy.save();
    res.status(201).json(newPolicy);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message || "创建新版本失败" });
  }
});

router.post("/simulate", async (req: Request, res: Response) => {
  try {
    const { policyId, orders } = req.body;

    if (!policyId || !orders || !Array.isArray(orders)) {
      return res.status(400).json({ message: "请提供政策ID和样本订单列表" });
    }

    const newPolicy = await SubsidyPolicy.findById(policyId);
    if (!newPolicy) {
      return res.status(404).json({ message: "新政策不存在" });
    }

    const results: any[] = [];
    let newTotalSubsidy = 0;
    let oldTotalSubsidy = 0;

    for (const orderInfo of orders) {
      const elderly = await Elderly.findById(orderInfo.elderlyId);
      const canteen = await Canteen.findById(orderInfo.canteenId);
      if (!elderly || !canteen) continue;

      const mealPrice = orderInfo.mealPrice || 15;
      const mealType = orderInfo.mealType || "lunch";
      const orderDate = orderInfo.orderDate
        ? new Date(orderInfo.orderDate)
        : new Date();

      const context: OrderContext = {
        elderly,
        canteen,
        mealType,
        mealPrice,
        orderDate,
      };

      const newCalc = calculateSubsidyForOrder(newPolicy, context);

      const oldPolicy = await findPolicyByDate(orderDate);
      let oldCalc;
      if (oldPolicy && oldPolicy._id.toString() !== newPolicy._id.toString()) {
        oldCalc = calculateSubsidyForOrder(oldPolicy, context);
      } else {
        oldCalc = {
          baseSubsidy: 0,
          seniorSubsidy: 0,
          totalSubsidy: 0,
          selfPayAmount: mealPrice,
          calculationDetail: "无旧政策",
        };
      }

      newTotalSubsidy += newCalc.totalSubsidy;
      oldTotalSubsidy += oldCalc.totalSubsidy;

      results.push({
        elderlyId: orderInfo.elderlyId,
        elderlyName: elderly.name,
        mealPrice,
        mealType,
        oldSubsidy: oldCalc.totalSubsidy,
        newSubsidy: newCalc.totalSubsidy,
        diff: newCalc.totalSubsidy - oldCalc.totalSubsidy,
        oldDetail: oldCalc.calculationDetail,
        newDetail: newCalc.calculationDetail,
      });
    }

    res.json({
      totalOrders: results.length,
      newTotalSubsidy: Math.round(newTotalSubsidy * 100) / 100,
      oldTotalSubsidy: Math.round(oldTotalSubsidy * 100) / 100,
      diffTotal: Math.round((newTotalSubsidy - oldTotalSubsidy) * 100) / 100,
      diffPercent:
        oldTotalSubsidy > 0
          ? Math.round(
              ((newTotalSubsidy - oldTotalSubsidy) / oldTotalSubsidy) * 10000,
            ) / 100
          : 0,
      results,
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message || "模拟测算失败" });
  }
});

router.post("/calculate-historical", async (req: Request, res: Response) => {
  try {
    const { elderlyId, canteenId, mealPrice, mealType, date } = req.body;

    if (!elderlyId || !canteenId || !mealPrice || !mealType || !date) {
      return res.status(400).json({ message: "缺少必要参数" });
    }

    const elderly = await Elderly.findById(elderlyId);
    if (!elderly) {
      return res.status(404).json({ message: "老人信息不存在" });
    }

    const canteen = await Canteen.findById(canteenId);
    if (!canteen) {
      return res.status(404).json({ message: "助餐点不存在" });
    }

    const orderDate = new Date(date);
    const calc = await calculateSubsidy(
      elderly,
      mealPrice,
      canteen,
      mealType,
      orderDate,
    );

    res.json({
      date: orderDate.toISOString().slice(0, 10),
      elderlyId,
      canteenId,
      mealPrice,
      mealType,
      ...calc,
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message || "历史补贴计算失败" });
  }
});

router.get("/:id/version-history", async (req: Request, res: Response) => {
  try {
    const policy = await SubsidyPolicy.findById(req.params.id);
    if (!policy) {
      return res.status(404).json({ message: "政策不存在" });
    }

    const versions = await SubsidyPolicy.find({ name: policy.name })
      .select(
        "name version status effectiveDate expiryDate previousVersionId createdAt",
      )
      .sort({ version: 1 });

    res.json(versions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取版本历史失败" });
  }
});

export default router;
