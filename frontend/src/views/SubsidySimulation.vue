<template>
  <div class="page">
    <a-row :gutter="16">
      <a-col :span="12">
        <a-card title="模拟测算" :loading="simulating">
          <a-form layout="vertical">
            <a-form-item label="选择新政策" required>
              <a-select
                v-model:value="selectedPolicyId"
                placeholder="选择待测算的草稿政策"
                style="width: 100%"
              >
                <a-select-option v-for="p in draftPolicies" :key="p._id" :value="p._id">
                  {{ p.name }} (v{{ p.version }})
                </a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="样本订单">
              <a-textarea
                v-model:value="sampleOrdersText"
                :rows="6"
                placeholder="每行一条：老人ID,助餐点ID,餐费,餐段(lunch/dinner),日期(YYYY-MM-DD)"
              />
              <div style="margin-top: 8px; color: #999; font-size: 12px;">
                示例：647a1b2c3d4e5f6a7b8c9d0e,647a1b2c3d4e5f6a7b8c9d0f,15,lunch,2026-07-01
              </div>
            </a-form-item>
            <a-form-item>
              <a-space>
                <a-button type="primary" @click="runSimulation" :disabled="!selectedPolicyId">
                  开始测算
                </a-button>
                <a-button @click="loadRecentOrders">导入近期订单</a-button>
              </a-space>
            </a-form-item>
          </a-form>
        </a-card>
      </a-col>

      <a-col :span="12">
        <a-card title="测算结果">
          <template v-if="simulationResult">
            <a-row :gutter="16" style="margin-bottom: 16px;">
              <a-col :span="6">
                <a-statistic title="样本数" :value="simulationResult.totalOrders" />
              </a-col>
              <a-col :span="6">
                <a-statistic
                  title="新政策补贴总额"
                  :value="simulationResult.newTotalSubsidy"
                  prefix="¥"
                  :value-style="{ color: '#1890ff' }"
                />
              </a-col>
              <a-col :span="6">
                <a-statistic
                  title="旧政策补贴总额"
                  :value="simulationResult.oldTotalSubsidy"
                  prefix="¥"
                  :value-style="{ color: '#999' }"
                />
              </a-col>
              <a-col :span="6">
                <a-statistic
                  title="差异额"
                  :value="simulationResult.diffTotal"
                  prefix="¥"
                  :value-style="{ color: simulationResult.diffTotal > 0 ? '#ff4d4f' : '#52c41a' }"
                />
              </a-col>
            </a-row>
            <a-row :gutter="16" style="margin-bottom: 16px;">
              <a-col :span="12">
                <a-alert
                  :type="simulationResult.diffTotal > 0 ? 'warning' : 'success'"
                  show-icon
                >
                  <template #message>
                    新政策相比旧政策{{ simulationResult.diffTotal > 0 ? '增加' : '减少' }}
                    ¥{{ Math.abs(simulationResult.diffTotal).toFixed(2) }}支出
                    <span v-if="simulationResult.diffPercent !== 0">
                      ({{ simulationResult.diffPercent > 0 ? '+' : '' }}{{ simulationResult.diffPercent }}%)
                    </span>
                  </template>
                </a-alert>
              </a-col>
            </a-row>
          </template>
          <a-empty v-else description="请选择政策并输入样本订单进行测算" />
        </a-card>
      </a-col>
    </a-row>

    <a-card title="逐笔对比明细" style="margin-top: 16px;" v-if="simulationResult && simulationResult.results.length > 0">
      <a-table
        :columns="compareColumns"
        :data-source="simulationResult.results"
        :pagination="{ pageSize: 20 }"
        row-key="elderlyId"
        size="small"
        :scroll="{ x: 1000 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'diff'">
            <span :style="{ color: record.diff > 0 ? '#ff4d4f' : record.diff < 0 ? '#52c41a' : '#999', fontWeight: 500 }">
              {{ record.diff > 0 ? '+' : '' }}{{ record.diff.toFixed(2) }}
            </span>
          </template>
          <template v-else-if="column.key === 'oldSubsidy'">
            ¥{{ record.oldSubsidy.toFixed(2) }}
          </template>
          <template v-else-if="column.key === 'newSubsidy'">
            <span style="color: #1890ff; font-weight: 500;">¥{{ record.newSubsidy.toFixed(2) }}</span>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-card title="历史补贴补算" style="margin-top: 16px;">
      <a-form layout="inline">
        <a-form-item label="老人ID">
          <a-input v-model:value="historicalForm.elderlyId" placeholder="老人ID" style="width: 200px" />
        </a-form-item>
        <a-form-item label="助餐点ID">
          <a-input v-model:value="historicalForm.canteenId" placeholder="助餐点ID" style="width: 200px" />
        </a-form-item>
        <a-form-item label="餐费">
          <a-input-number v-model:value="historicalForm.mealPrice" :min="0" />
        </a-form-item>
        <a-form-item label="餐段">
          <a-select v-model:value="historicalForm.mealType" style="width: 100px">
            <a-select-option value="lunch">午餐</a-select-option>
            <a-select-option value="dinner">晚餐</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="历史日期">
          <a-date-picker v-model:value="historicalForm.date" />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" @click="calcHistorical" :loading="calcLoading">计算</a-button>
        </a-form-item>
      </a-form>

      <a-descriptions
        v-if="historicalResult"
        bordered
        :column="2"
        size="small"
        style="margin-top: 16px;"
      >
        <a-descriptions-item label="日期">{{ historicalResult.date }}</a-descriptions-item>
        <a-descriptions-item label="基础补贴">¥{{ historicalResult.baseSubsidy.toFixed(2) }}</a-descriptions-item>
        <a-descriptions-item label="高龄补贴">¥{{ historicalResult.seniorSubsidy.toFixed(2) }}</a-descriptions-item>
        <a-descriptions-item label="补贴总额">¥{{ historicalResult.totalSubsidy.toFixed(2) }}</a-descriptions-item>
        <a-descriptions-item label="自付金额">¥{{ historicalResult.selfPayAmount.toFixed(2) }}</a-descriptions-item>
        <a-descriptions-item label="计算明细" :span="2">{{ historicalResult.calculationDetail }}</a-descriptions-item>
      </a-descriptions>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import dayjs, { Dayjs } from 'dayjs'
import {
  getPolicyList,
  simulatePolicy,
  calculateHistorical,
  SubsidyPolicy,
  SimulationResult,
  HistoricalCalcResult,
} from '@/api/policy'
import request from '@/utils/request'

const draftPolicies = ref<SubsidyPolicy[]>([])
const selectedPolicyId = ref('')
const sampleOrdersText = ref('')
const simulating = ref(false)
const simulationResult = ref<SimulationResult | null>(null)

const compareColumns = [
  { title: '老人姓名', dataIndex: 'elderlyName', key: 'elderlyName', width: 100 },
  { title: '餐费', dataIndex: 'mealPrice', key: 'mealPrice', width: 80 },
  { title: '餐段', dataIndex: 'mealType', key: 'mealType', width: 80 },
  { title: '旧政策补贴', key: 'oldSubsidy', width: 120 },
  { title: '新政策补贴', key: 'newSubsidy', width: 120 },
  { title: '差异', key: 'diff', width: 100 },
  { title: '旧政策明细', dataIndex: 'oldDetail', key: 'oldDetail', ellipsis: true },
  { title: '新政策明细', dataIndex: 'newDetail', key: 'newDetail', ellipsis: true },
]

const historicalForm = reactive({
  elderlyId: '',
  canteenId: '',
  mealPrice: 15,
  mealType: 'lunch' as string,
  date: null as Dayjs | null,
})
const historicalResult = ref<HistoricalCalcResult | null>(null)
const calcLoading = ref(false)

async function loadDraftPolicies() {
  try {
    const res = await getPolicyList({ status: 'draft', page: 1, pageSize: 100 })
    draftPolicies.value = res.list
    if (!selectedPolicyId.value && res.list.length > 0) {
      const allRes = await getPolicyList({ page: 1, pageSize: 100 })
      const drafts = allRes.list.filter(p => p.status === 'draft')
      if (drafts.length > 0) {
        selectedPolicyId.value = drafts[0]._id
      }
    }
  } catch (error) {
    console.error(error)
  }
}

async function runSimulation() {
  if (!selectedPolicyId.value) {
    message.warning('请选择政策')
    return
  }

  const lines = sampleOrdersText.value.trim().split('\n').filter(l => l.trim())
  if (lines.length === 0) {
    message.warning('请输入样本订单')
    return
  }

  const orders = lines.map(line => {
    const parts = line.split(',').map(s => s.trim())
    return {
      elderlyId: parts[0],
      canteenId: parts[1],
      mealPrice: parts[2] ? parseFloat(parts[2]) : 15,
      mealType: parts[3] || 'lunch',
      orderDate: parts[4] || new Date().toISOString().slice(0, 10),
    }
  })

  simulating.value = true
  try {
    simulationResult.value = await simulatePolicy({
      policyId: selectedPolicyId.value,
      orders,
    })
    message.success('测算完成')
  } catch (error) {
    console.error(error)
  } finally {
    simulating.value = false
  }
}

async function loadRecentOrders() {
  try {
    const res: any = await request.get('/orders', {
      params: { page: 1, pageSize: 20, status: 'completed' },
    })
    if (res.list && res.list.length > 0) {
      const lines = res.list.map((o: any) => {
        const elderlyId = o.elderlyId?._id || o.elderlyId
        const canteenId = o.canteenId?._id || o.canteenId
        return `${elderlyId},${canteenId},${o.mealPrice},${o.mealType},${dayjs(o.mealDate).format('YYYY-MM-DD')}`
      })
      sampleOrdersText.value = lines.join('\n')
      message.success(`已导入 ${lines.length} 条近期订单`)
    } else {
      message.info('暂无已完成订单')
    }
  } catch (error) {
    console.error(error)
  }
}

async function calcHistorical() {
  if (!historicalForm.elderlyId || !historicalForm.canteenId || !historicalForm.date) {
    message.warning('请填写完整的补算参数')
    return
  }

  calcLoading.value = true
  try {
    historicalResult.value = await calculateHistorical({
      elderlyId: historicalForm.elderlyId,
      canteenId: historicalForm.canteenId,
      mealPrice: historicalForm.mealPrice,
      mealType: historicalForm.mealType,
      date: historicalForm.date!.format('YYYY-MM-DD'),
    })
  } catch (error) {
    console.error(error)
  } finally {
    calcLoading.value = false
  }
}

onMounted(() => {
  loadDraftPolicies()
})
</script>

<style scoped>
.page {
  padding: 24px;
}
</style>
