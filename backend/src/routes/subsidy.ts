import { Router, Request, Response } from "express";
import { SubsidyRecord } from "../models/SubsidyRecord";
import { MonthlySubsidyQuota } from "../models/MonthlySubsidyQuota";
import { authMiddleware, requireRoles } from "../middleware/auth";
import { getMonthKey } from "../utils/subsidy";
import { config } from "../config";

const router = Router();

router.use(authMiddleware);
router.use(requireRoles("admin", "worker"));

router.get("/monthly-summary", async (req: Request, res: Response) => {
  try {
    const { month = "", page = "1", pageSize = "10" } = req.query;

    const targetMonth = (month as string) || getMonthKey(new Date());

    const quota = await MonthlySubsidyQuota.findOne({ month: targetMonth });

    const records = await SubsidyRecord.aggregate([
      { $match: { month: targetMonth } },
      {
        $group: {
          _id: "$elderlyId",
          mealCount: { $sum: 1 },
          totalSubsidy: { $sum: "$totalSubsidy" },
          totalSelfPay: { $sum: "$selfPayAmount" },
          totalMealPrice: { $sum: "$mealPrice" },
        },
      },
      {
        $lookup: {
          from: "elderlies",
          localField: "_id",
          foreignField: "_id",
          as: "elderly",
        },
      },
      { $unwind: "$elderly" },
      {
        $project: {
          elderlyId: "$_id",
          name: "$elderly.name",
          idCard: "$elderly.idCard",
          community: "$elderly.community",
          subsidyCategory: "$elderly.subsidyCategory",
          mealCount: 1,
          totalSubsidy: 1,
          totalSelfPay: 1,
          totalMealPrice: 1,
        },
      },
      { $sort: { mealCount: -1 } },
    ]);

    const pageNum = parseInt(page as string, 10);
    const size = parseInt(pageSize as string, 10);
    const skip = (pageNum - 1) * size;
    const paginatedRecords = records.slice(skip, skip + size);

    res.json({
      month: targetMonth,
      quota: quota || {
        month: targetMonth,
        totalQuota: config.monthlySubsidyQuota,
        usedAmount: 0,
        remainingAmount: config.monthlySubsidyQuota,
        status: "active",
      },
      total: records.length,
      list: paginatedRecords,
      page: pageNum,
      pageSize: size,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取月度补贴汇总失败" });
  }
});

router.get("/quota", async (req: Request, res: Response) => {
  try {
    const { month = "" } = req.query;
    const targetMonth = (month as string) || getMonthKey(new Date());

    let quota = await MonthlySubsidyQuota.findOne({ month: targetMonth });
    if (!quota) {
      quota = {
        month: targetMonth,
        totalQuota: config.monthlySubsidyQuota,
        usedAmount: 0,
        remainingAmount: config.monthlySubsidyQuota,
        status: "active",
      } as any;
    }

    res.json(quota);
  } catch (error) {
    res.status(500).json({ message: "获取补贴额度失败" });
  }
});

router.get("/category-stats", async (req: Request, res: Response) => {
  try {
    const { month = "" } = req.query;
    const targetMonth = (month as string) || getMonthKey(new Date());

    const stats = await SubsidyRecord.aggregate([
      { $match: { month: targetMonth } },
      {
        $group: {
          _id: "$subsidyCategory",
          count: { $sum: 1 },
          totalSubsidy: { $sum: "$totalSubsidy" },
        },
      },
      {
        $project: {
          category: "$_id",
          count: 1,
          totalSubsidy: 1,
        },
      },
    ]);

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: "获取补贴分类统计失败" });
  }
});

router.get("/ledger", async (req: Request, res: Response) => {
  try {
    const {
      month = "",
      canteenId = "",
      subsidyCategory = "",
      page = "1",
      pageSize = "20",
    } = req.query;

    const targetMonth = (month as string) || getMonthKey(new Date());

    const query: any = { month: targetMonth };
    if (canteenId) query.canteenId = canteenId;
    if (subsidyCategory) query.subsidyCategory = subsidyCategory;

    const pageNum = parseInt(page as string, 10);
    const size = parseInt(pageSize as string, 10);
    const skip = (pageNum - 1) * size;

    const [total, list] = await Promise.all([
      SubsidyRecord.countDocuments(query),
      SubsidyRecord.find(query)
        .populate("elderlyId", "name age subsidyCategory")
        .populate("canteenId", "name")
        .populate("orderId", "orderNo mealType mealStandard")
        .skip(skip)
        .limit(size)
        .sort({ mealDate: -1 }),
    ]);

    res.json({
      month: targetMonth,
      total,
      list,
      page: pageNum,
      pageSize: size,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取补贴台账失败" });
  }
});

router.get("/stats/by-policy", async (req: Request, res: Response) => {
  try {
    const { month = "" } = req.query;
    const targetMonth = (month as string) || getMonthKey(new Date());

    const stats = await SubsidyRecord.aggregate([
      { $match: { month: targetMonth } },
      {
        $group: {
          _id: {
            policyId: "$policyId",
            policyName: "$policyName",
            policyVersion: "$policyVersion",
          },
          count: { $sum: 1 },
          totalSubsidy: { $sum: "$totalSubsidy" },
          baseSubsidy: { $sum: "$baseSubsidy" },
          seniorSubsidy: { $sum: "$seniorSubsidy" },
        },
      },
      {
        $project: {
          policyId: "$_id.policyId",
          policyName: "$_id.policyName",
          policyVersion: "$_id.policyVersion",
          count: 1,
          totalSubsidy: 1,
          baseSubsidy: 1,
          seniorSubsidy: 1,
        },
      },
      { $sort: { totalSubsidy: -1 } },
    ]);

    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取政策发放统计失败" });
  }
});

router.get("/stats/category-ratio", async (req: Request, res: Response) => {
  try {
    const { month = "" } = req.query;
    const targetMonth = (month as string) || getMonthKey(new Date());

    const stats = await SubsidyRecord.aggregate([
      { $match: { month: targetMonth } },
      {
        $group: {
          _id: "$subsidyCategory",
          count: { $sum: 1 },
          totalSubsidy: { $sum: "$totalSubsidy" },
        },
      },
      {
        $project: {
          category: "$_id",
          count: 1,
          totalSubsidy: 1,
        },
      },
    ]);

    const totalAmount = stats.reduce(
      (sum: number, s: any) => sum + s.totalSubsidy,
      0,
    );
    const result = stats.map((s: any) => ({
      ...s,
      ratio:
        totalAmount > 0
          ? Math.round((s.totalSubsidy / totalAmount) * 10000) / 100
          : 0,
    }));

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取补贴占比统计失败" });
  }
});

router.get("/stats/monthly-trend", async (req: Request, res: Response) => {
  try {
    const { months = "6" } = req.query;
    const monthCount = parseInt(months as string, 10);

    const now = new Date();
    const monthKeys: string[] = [];
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(getMonthKey(d));
    }

    const stats = await SubsidyRecord.aggregate([
      { $match: { month: { $in: monthKeys } } },
      {
        $group: {
          _id: "$month",
          totalSubsidy: { $sum: "$totalSubsidy" },
          count: { $sum: 1 },
          avgSubsidy: { $avg: "$totalSubsidy" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const quotaStats = await MonthlySubsidyQuota.find({
      month: { $in: monthKeys },
    });

    const result = monthKeys.map((mk) => {
      const stat = stats.find((s: any) => s._id === mk);
      const quota = quotaStats.find((q) => q.month === mk);
      return {
        month: mk,
        totalSubsidy: stat?.totalSubsidy || 0,
        count: stat?.count || 0,
        avgSubsidy: stat?.avgSubsidy
          ? Math.round(stat.avgSubsidy * 100) / 100
          : 0,
        totalQuota: quota?.totalQuota || config.monthlySubsidyQuota,
        usedAmount: quota?.usedAmount || 0,
        executionRate:
          quota && quota.totalQuota > 0
            ? Math.round((quota.usedAmount / quota.totalQuota) * 10000) / 100
            : 0,
      };
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取月度趋势统计失败" });
  }
});

router.get("/stats/avg-subsidy", async (req: Request, res: Response) => {
  try {
    const { month = "" } = req.query;
    const targetMonth = (month as string) || getMonthKey(new Date());

    const stats = await SubsidyRecord.aggregate([
      { $match: { month: targetMonth } },
      {
        $group: {
          _id: "$subsidyCategory",
          count: { $sum: 1 },
          totalSubsidy: { $sum: "$totalSubsidy" },
          avgSubsidy: { $avg: "$totalSubsidy" },
        },
      },
      {
        $project: {
          category: "$_id",
          count: 1,
          totalSubsidy: 1,
          avgSubsidy: { $round: ["$avgSubsidy", 2] },
        },
      },
    ]);

    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取人均补贴统计失败" });
  }
});

router.get("/stats/canteen-summary", async (req: Request, res: Response) => {
  try {
    const { month = "" } = req.query;
    const targetMonth = (month as string) || getMonthKey(new Date());

    const stats = await SubsidyRecord.aggregate([
      { $match: { month: targetMonth } },
      {
        $group: {
          _id: {
            canteenId: "$canteenId",
            subsidyCategory: "$subsidyCategory",
          },
          count: { $sum: 1 },
          totalSubsidy: { $sum: "$totalSubsidy" },
        },
      },
      {
        $lookup: {
          from: "canteens",
          localField: "_id.canteenId",
          foreignField: "_id",
          as: "canteen",
        },
      },
      { $unwind: "$canteen" },
      {
        $project: {
          canteenId: "$_id.canteenId",
          canteenName: "$canteen.name",
          subsidyCategory: "$_id.subsidyCategory",
          count: 1,
          totalSubsidy: 1,
        },
      },
      { $sort: { totalSubsidy: -1 } },
    ]);

    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "获取助餐点补贴汇总失败" });
  }
});

router.get("/export-csv", async (req: Request, res: Response) => {
  try {
    const { month = "", canteenId = "", subsidyCategory = "" } = req.query;
    const targetMonth = (month as string) || getMonthKey(new Date());

    const query: any = { month: targetMonth };
    if (canteenId) query.canteenId = canteenId;
    if (subsidyCategory) query.subsidyCategory = subsidyCategory;

    const records = await SubsidyRecord.find(query)
      .populate("elderlyId", "name idCard community subsidyCategory")
      .populate("canteenId", "name")
      .sort({ mealDate: -1 });

    const categoryMap: Record<string, string> = {
      dibao: "低保户",
      low_income: "低收入",
      tekun: "特困供养",
      normal: "普通老人",
      jihua_tefu: "计划生育特扶",
    };

    const header =
      "订单ID,老人姓名,身份证号,所属社区,老人类别,助餐点,用餐日期,政策名称,政策版本,基础补贴,高龄补贴,补贴总额,餐费,自付金额,计算明细\n";
    const rows = records.map((r: any) => {
      const elderlyName = r.elderlyId?.name || "";
      const idCard = r.elderlyId?.idCard || "";
      const community = r.elderlyId?.community || "";
      const category = categoryMap[r.subsidyCategory] || r.subsidyCategory;
      const canteenName = r.canteenId?.name || "";
      const mealDate = r.mealDate
        ? new Date(r.mealDate).toISOString().slice(0, 10)
        : "";
      return [
        r.orderId,
        elderlyName,
        idCard,
        community,
        category,
        canteenName,
        mealDate,
        r.policyName,
        r.policyVersion,
        r.baseSubsidy.toFixed(2),
        r.seniorSubsidy.toFixed(2),
        r.totalSubsidy.toFixed(2),
        r.mealPrice.toFixed(2),
        r.selfPayAmount.toFixed(2),
        `"${r.calculationDetail || ""}"`,
      ].join(",");
    });

    const csv = header + rows.join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="subsidy-ledger-${targetMonth}.csv"`,
    );
    res.send("\uFEFF" + csv);
  } catch (error) {
    res.status(500).json({ message: "导出CSV失败" });
  }
});

export default router;
