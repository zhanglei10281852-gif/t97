<template>
  <div class="page">
    <a-tabs v-model:activeKey="activeTab">
      <a-tab-pane key="overview" tab="补贴概览">
        <a-row :gutter="16">
          <a-col :span="8">
            <a-card>
              <a-statistic
                title="本月补贴总额度"
                :value="quota.totalQuota"
                prefix="¥"
                :value-style="{ color: '#1890ff' }"
              />
            </a-card>
          </a-col>
          <a-col :span="8">
            <a-card>
              <a-statistic
                title="已使用补贴"
                :value="quota.usedAmount"
                prefix="¥"
                :value-style="{ color: '#fa8c16' }"
              />
            </a-card>
          </a-col>
          <a-col :span="8">
            <a-card>
              <a-statistic
                title="剩余额度"
                :value="quota.remainingAmount"
                prefix="¥"
                :value-style="{ color: quota.remainingAmount > 0 ? '#52c41a' : '#ff4d4f' }"
              />
            </a-card>
          </a-col>
        </a-row>

        <a-row :gutter="16" style="margin-top: 16px">
          <a-col :span="16">
            <a-card title="月度补贴汇总">
              <template #extra>
                <div>
                  <a-month-picker
                    v-model:value="selectedMonth"
                    format="YYYY年MM月"
                    :allow-clear="false"
                    style="margin-right: 12px"
                    @change="handleMonthChange"
                  />
                  <a-button type="primary" @click="handleExport">
                    <DownloadOutlined />
                    导出CSV
                  </a-button>
                </div>
              </template>

              <a-table
                :columns="columns"
                :data-source="dataSource"
                :pagination="pagination"
                :loading="loading"
                row-key="elderlyId"
                @change="handleTableChange"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'subsidyCategory'">
                    <a-tag :color="getCategoryTagColor(record.subsidyCategory)">
                      {{ getCategoryText(record.subsidyCategory) }}
                    </a-tag>
                  </template>
                  <template v-else-if="column.key === 'totalSubsidy'">
                    <span style="color: #52c41a; font-weight: 500">
                      ¥{{ record.totalSubsidy.toFixed(2) }}
                    </span>
                  </template>
                  <template v-else-if="column.key === 'totalSelfPay'">
                    <span style="color: #fa8c16">
                      ¥{{ record.totalSelfPay.toFixed(2) }}
                    </span>
                  </template>
                </template>
              </a-table>
            </a-card>
          </a-col>
          <a-col :span="8">
            <a-card title="补贴类别占比">
              <div ref="pieChart" style="width: 100%; height: 350px"></div>
            </a-card>
          </a-col>
        </a-row>
      </a-tab-pane>

      <a-tab-pane key="ledger" tab="补贴台账">
        <a-card>
          <template #extra>
            <div style="display: flex; gap: 12px; align-items: center;">
              <a-month-picker
                v-model:value="ledgerMonth"
                format="YYYY年MM月"
                :allow-clear="false"
                @change="loadLedger"
              />
              <a-select
                v-model:value="ledgerCategoryFilter"
                placeholder="老人类别"
                allow-clear
                style="width: 140px"
                @change="loadLedger"
              >
                <a-select-option value="dibao">低保户</a-select-option>
                <a-select-option value="low_income">低收入</a-select-option>
                <a-select-option value="tekun">特困供养</a-select-option>
                <a-select-option value="normal">普通老人</a-select-option>
                <a-select-option value="jihua_tefu">计生特扶</a-select-option>
              </a-select>
              <a-button type="primary" @click="handleExportLedger">
                <DownloadOutlined /> 导出台账
              </a-button>
            </div>
          </template>

          <a-table
            :columns="ledgerColumns"
            :data-source="ledgerData"
            :pagination="ledgerPagination"
            :loading="ledgerLoading"
            row-key="_id"
            @change="handleLedgerTableChange"
            size="small"
            :scroll="{ x: 1400 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'subsidyCategory'">
                <a-tag :color="getCategoryTagColor(record.subsidyCategory)" size="small">
                  {{ getCategoryText(record.subsidyCategory) }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'policyInfo'">
                {{ record.policyName }} v{{ record.policyVersion }}
              </template>
              <template v-else-if="column.key === 'totalSubsidy'">
                <span style="color: #52c41a; font-weight: 500;">¥{{ record.totalSubsidy?.toFixed(2) }}</span>
              </template>
              <template v-else-if="column.key === 'calculationDetail'">
                <a-tooltip :title="record.calculationDetail">
                  <span style="color: #1890ff; cursor: pointer;">查看</span>
                </a-tooltip>
              </template>
              <template v-else-if="column.key === 'mealDate'">
                {{ record.mealDate ? new Date(record.mealDate).toISOString().slice(0, 10) : '' }}
              </template>
            </template>
          </a-table>
        </a-card>
      </a-tab-pane>

      <a-tab-pane key="stats" tab="统计分析">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-card title="月度补贴支出趋势">
              <template #extra>
                <a-select v-model:value="trendMonths" style="width: 100px" @change="loadTrend">
                  <a-select-option :value="6">近6月</a-select-option>
                  <a-select-option :value="12">近12月</a-select-option>
                </a-select>
              </template>
              <div ref="trendChart" style="width: 100%; height: 350px"></div>
            </a-card>
          </a-col>
          <a-col :span="12">
            <a-card title="各政策发放总额">
              <div ref="policyBarChart" style="width: 100%; height: 350px"></div>
            </a-card>
          </a-col>
        </a-row>
        <a-row :gutter="16" style="margin-top: 16px;">
          <a-col :span="12">
            <a-card title="各老人类别补贴占比">
              <div ref="ratioChart" style="width: 100%; height: 350px"></div>
            </a-card>
          </a-col>
          <a-col :span="12">
            <a-card title="人均补贴金额">
              <div ref="avgChart" style="width: 100%; height: 350px"></div>
            </a-card>
          </a-col>
        </a-row>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick, watch } from 'vue'
import * as echarts from 'echarts'
import { message } from 'ant-design-vue'
import { DownloadOutlined } from '@ant-design/icons-vue'
import dayjs, { Dayjs } from 'dayjs'
import {
  getMonthlySummary,
  getCategoryStats,
  exportSubsidyCsv,
  getLedger,
  getPolicyStats,
  getCategoryRatioStats,
  getMonthlyTrend,
  getAvgSubsidyStats,
  SubsidySummaryItem,
  CategoryStat,
  LedgerItem,
  PolicyStat,
  CategoryRatioStat,
  MonthlyTrendItem,
  AvgSubsidyStat,
} from '@/api/subsidy'

const activeTab = ref('overview')
const loading = ref(false)
const dataSource = ref<SubsidySummaryItem[]>([])
const categoryStats = ref<CategoryStat[]>([])
const selectedMonth = ref<Dayjs>(dayjs())

const quota = reactive({
  totalQuota: 100000,
  usedAmount: 0,
  remainingAmount: 100000,
  status: 'active',
})

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 位老人`,
})

const columns = [
  { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
  { title: '身份证号', dataIndex: 'idCard', key: 'idCard', width: 160 },
  { title: '所属社区', dataIndex: 'community', key: 'community', width: 100 },
  { title: '补贴类别', key: 'subsidyCategory', width: 140 },
  { title: '用餐次数', dataIndex: 'mealCount', key: 'mealCount', width: 90, align: 'right' as const },
  { title: '补贴总额', key: 'totalSubsidy', width: 100, align: 'right' as const },
  { title: '自付总额', key: 'totalSelfPay', width: 100, align: 'right' as const },
]

const pieChart = ref<HTMLElement | null>(null)
let pieChartInstance: echarts.ECharts | null = null

const ledgerMonth = ref<Dayjs>(dayjs())
const ledgerCategoryFilter = ref<string | undefined>(undefined)
const ledgerLoading = ref(false)
const ledgerData = ref<LedgerItem[]>([])
const ledgerPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
})

const ledgerColumns = [
  { title: '老人姓名', key: 'elderlyName', width: 90, customRender: ({ record }: any) => record.elderlyId?.name || '-' },
  { title: '助餐点', key: 'canteenName', width: 120, customRender: ({ record }: any) => record.canteenId?.name || '-' },
  { title: '用餐日期', key: 'mealDate', width: 110 },
  { title: '老人类别', key: 'subsidyCategory', width: 100 },
  { title: '适用政策', key: 'policyInfo', width: 160 },
  { title: '基础补贴', dataIndex: 'baseSubsidy', width: 90, align: 'right' as const, customRender: ({ text }: any) => `¥${(text || 0).toFixed(2)}` },
  { title: '高龄补贴', dataIndex: 'seniorSubsidy', width: 90, align: 'right' as const, customRender: ({ text }: any) => `¥${(text || 0).toFixed(2)}` },
  { title: '补贴总额', key: 'totalSubsidy', width: 100 },
  { title: '餐费', dataIndex: 'mealPrice', width: 80, align: 'right' as const, customRender: ({ text }: any) => `¥${(text || 0).toFixed(2)}` },
  { title: '自付', dataIndex: 'selfPayAmount', width: 80, align: 'right' as const, customRender: ({ text }: any) => `¥${(text || 0).toFixed(2)}` },
  { title: '计算明细', key: 'calculationDetail', width: 80 },
]

const trendMonths = ref(6)
const trendChart = ref<HTMLElement | null>(null)
let trendChartInstance: echarts.ECharts | null = null
const policyBarChart = ref<HTMLElement | null>(null)
let policyBarChartInstance: echarts.ECharts | null = null
const ratioChart = ref<HTMLElement | null>(null)
let ratioChartInstance: echarts.ECharts | null = null
const avgChart = ref<HTMLElement | null>(null)
let avgChartInstance: echarts.ECharts | null = null

function getCategoryText(category: string): string {
  const map: Record<string, string> = {
    dibao: '低保户',
    low_income: '低收入',
    tekun: '特困供养',
    normal: '普通老人',
    jihua_tefu: '计生特扶',
    low_income_full: '低保户全额',
    senior_extra: '高龄额外',
  }
  return map[category] || category
}

function getCategoryTagColor(category: string): string {
  const map: Record<string, string> = {
    dibao: 'red',
    low_income: 'orange',
    tekun: 'purple',
    normal: 'blue',
    jihua_tefu: 'cyan',
    low_income_full: 'red',
    senior_extra: 'purple',
  }
  return map[category] || 'default'
}

async function loadData() {
  loading.value = true
  try {
    const monthStr = selectedMonth.value.format('YYYY-MM')

    const [summaryRes, statsRes] = await Promise.all([
      getMonthlySummary({
        month: monthStr,
        page: pagination.current,
        pageSize: pagination.pageSize,
      }),
      getCategoryStats({ month: monthStr }),
    ])

    dataSource.value = summaryRes.list
    pagination.total = summaryRes.total

    if (summaryRes.quota) {
      quota.totalQuota = summaryRes.quota.totalQuota
      quota.usedAmount = summaryRes.quota.usedAmount
      quota.remainingAmount = summaryRes.quota.remainingAmount
      quota.status = summaryRes.quota.status
    }

    categoryStats.value = statsRes

    await nextTick()
    initPieChart()
  } finally {
    loading.value = false
  }
}

function initPieChart() {
  if (!pieChart.value) return
  if (pieChartInstance) pieChartInstance.dispose()

  pieChartInstance = echarts.init(pieChart.value)

  const colors = ['#ff4d4f', '#fa8c16', '#722ed1', '#1890ff', '#13c2c2']
  const data = categoryStats.value.map((item, index) => ({
    value: item.totalSubsidy,
    name: getCategoryText(item.category),
    itemStyle: { color: colors[index % colors.length] },
  }))

  const option = {
    tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
    legend: { orient: 'vertical', left: 'left', top: 'center' },
    series: [{
      name: '补贴类别',
      type: 'pie',
      radius: ['40%', '65%'],
      center: ['60%', '50%'],
      data,
      emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } },
      label: { formatter: '{b}\n{d}%' },
    }],
  }

  pieChartInstance.setOption(option)
}

function handleMonthChange(date: Dayjs | null) {
  if (date) {
    selectedMonth.value = date
    pagination.current = 1
    loadData()
  }
}

function handleTableChange(pag: any) {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  loadData()
}

function handleExport() {
  const monthStr = selectedMonth.value.format('YYYY-MM')
  exportSubsidyCsv(monthStr)
  message.success('正在导出CSV...')
}

function handleExportLedger() {
  const monthStr = ledgerMonth.value.format('YYYY-MM')
  exportSubsidyCsv(monthStr, undefined, ledgerCategoryFilter.value)
  message.success('正在导出台账...')
}

async function loadLedger() {
  ledgerLoading.value = true
  try {
    const res = await getLedger({
      month: ledgerMonth.value.format('YYYY-MM'),
      subsidyCategory: ledgerCategoryFilter.value,
      page: ledgerPagination.current,
      pageSize: ledgerPagination.pageSize,
    })
    ledgerData.value = res.list
    ledgerPagination.total = res.total
  } finally {
    ledgerLoading.value = false
  }
}

function handleLedgerTableChange(pag: any) {
  ledgerPagination.current = pag.current
  ledgerPagination.pageSize = pag.pageSize
  loadLedger()
}

async function loadTrend() {
  try {
    const data = await getMonthlyTrend({ months: trendMonths.value })
    await nextTick()
    initTrendChart(data)
  } catch (error) {
    console.error(error)
  }
}

function initTrendChart(data: MonthlyTrendItem[]) {
  if (!trendChart.value) return
  if (trendChartInstance) trendChartInstance.dispose()
  trendChartInstance = echarts.init(trendChart.value)

  trendChartInstance.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['补贴支出', '配额额度', '执行率'] },
    xAxis: { type: 'category', data: data.map(d => d.month) },
    yAxis: [
      { type: 'value', name: '金额(元)', position: 'left' },
      { type: 'value', name: '执行率(%)', position: 'right', max: 100 },
    ],
    series: [
      { name: '补贴支出', type: 'bar', data: data.map(d => d.totalSubsidy), itemStyle: { color: '#1890ff' } },
      { name: '配额额度', type: 'bar', data: data.map(d => d.totalQuota), itemStyle: { color: '#e8e8e8' } },
      { name: '执行率', type: 'line', yAxisIndex: 1, data: data.map(d => d.executionRate), itemStyle: { color: '#fa8c16' } },
    ],
  })
}

async function loadPolicyStats() {
  try {
    const data = await getPolicyStats({ month: selectedMonth.value.format('YYYY-MM') })
    await nextTick()
    initPolicyBarChart(data)
  } catch (error) {
    console.error(error)
  }
}

function initPolicyBarChart(data: PolicyStat[]) {
  if (!policyBarChart.value) return
  if (policyBarChartInstance) policyBarChartInstance.dispose()
  policyBarChartInstance = echarts.init(policyBarChart.value)

  policyBarChartInstance.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: data.map(d => `${d.policyName} v${d.policyVersion}`) },
    yAxis: { type: 'value', name: '金额(元)' },
    series: [
      { name: '基础补贴', type: 'bar', stack: 'total', data: data.map(d => d.baseSubsidy), itemStyle: { color: '#1890ff' } },
      { name: '高龄补贴', type: 'bar', stack: 'total', data: data.map(d => d.seniorSubsidy), itemStyle: { color: '#722ed1' } },
    ],
  })
}

async function loadRatioStats() {
  try {
    const data = await getCategoryRatioStats({ month: selectedMonth.value.format('YYYY-MM') })
    await nextTick()
    initRatioChart(data)
  } catch (error) {
    console.error(error)
  }
}

function initRatioChart(data: CategoryRatioStat[]) {
  if (!ratioChart.value) return
  if (ratioChartInstance) ratioChartInstance.dispose()
  ratioChartInstance = echarts.init(ratioChart.value)

  const colors = ['#ff4d4f', '#fa8c16', '#722ed1', '#1890ff', '#13c2c2']
  ratioChartInstance.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
    legend: { orient: 'vertical', left: 'left', top: 'center' },
    series: [{
      type: 'pie',
      radius: ['40%', '65%'],
      center: ['60%', '50%'],
      data: data.map((d, i) => ({
        value: d.totalSubsidy,
        name: getCategoryText(d.category),
        itemStyle: { color: colors[i % colors.length] },
      })),
      label: { formatter: '{b}\n{d}%' },
    }],
  })
}

async function loadAvgStats() {
  try {
    const data = await getAvgSubsidyStats({ month: selectedMonth.value.format('YYYY-MM') })
    await nextTick()
    initAvgChart(data)
  } catch (error) {
    console.error(error)
  }
}

function initAvgChart(data: AvgSubsidyStat[]) {
  if (!avgChart.value) return
  if (avgChartInstance) avgChartInstance.dispose()
  avgChartInstance = echarts.init(avgChart.value)

  avgChartInstance.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: data.map(d => getCategoryText(d.category)) },
    yAxis: { type: 'value', name: '元/人' },
    series: [{
      type: 'bar',
      data: data.map(d => d.avgSubsidy),
      itemStyle: { color: '#1890ff' },
      label: { show: true, position: 'top', formatter: '¥{c}' },
    }],
  })
}

function handleResize() {
  pieChartInstance?.resize()
  trendChartInstance?.resize()
  policyBarChartInstance?.resize()
  ratioChartInstance?.resize()
  avgChartInstance?.resize()
}

watch(activeTab, (val) => {
  if (val === 'ledger') {
    loadLedger()
  } else if (val === 'stats') {
    loadTrend()
    loadPolicyStats()
    loadRatioStats()
    loadAvgStats()
  }
})

onMounted(() => {
  loadData()
  window.addEventListener('resize', handleResize)
})
</script>

<style scoped>
.page {
  padding: 24px;
}
</style>
