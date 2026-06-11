<template>
  <div class="page">
    <a-card title="补贴政策管理">
      <template #extra>
        <a-button type="primary" @click="showCreateModal">
          <PlusOutlined /> 新建政策
        </a-button>
      </template>

      <div style="margin-bottom: 16px">
        <a-radio-group v-model:value="statusFilter" button-style="solid" @change="loadData">
          <a-radio-button value="">全部</a-radio-button>
          <a-radio-button value="draft">草稿</a-radio-button>
          <a-radio-button value="active">生效中</a-radio-button>
          <a-radio-button value="expired">已失效</a-radio-button>
        </a-radio-group>
      </div>

      <a-table
        :columns="columns"
        :data-source="policyList"
        :pagination="pagination"
        :loading="loading"
        row-key="_id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="getStatusColor(record.status)">
              {{ getStatusText(record.status) }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'version'">
            <a-tag color="blue">v{{ record.version }}</a-tag>
          </template>
          <template v-else-if="column.key === 'effectiveDate'">
            {{ formatDate(record.effectiveDate) }} ~ {{ formatDate(record.expiryDate) }}
          </template>
          <template v-else-if="column.key === 'rulesCount'">
            {{ record.rules?.length || 0 }} 条规则
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button type="link" size="small" @click="viewDetail(record)">查看</a-button>
              <a-button
                type="link"
                size="small"
                v-if="record.status === 'draft'"
                @click="editPolicy(record)"
              >编辑</a-button>
              <a-button
                type="link"
                size="small"
                v-if="record.status === 'draft'"
                @click="handleActivate(record)"
              >激活</a-button>
              <a-button
                type="link"
                size="small"
                @click="handleNewVersion(record)"
              >新建版本</a-button>
              <a-button
                type="link"
                size="small"
                @click="viewVersionHistory(record)"
              >版本历史</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="createModalVisible"
      :title="editingPolicy ? '编辑政策' : '新建政策'"
      width="900px"
      @ok="handleSavePolicy"
      :confirm-loading="saving"
    >
      <a-form :model="policyForm" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="政策名称" required>
              <a-input v-model:value="policyForm.name" placeholder="如：社区助餐补贴政策" :disabled="!!editingPolicy" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="生效日期" required>
              <a-date-picker
                v-model:value="policyForm.effectiveDate"
                style="width: 100%"
                :disabled-date="editingPolicy?.status === 'draft' ? undefined : undefined"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="失效日期" required>
              <a-date-picker v-model:value="policyForm.expiryDate" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="政策说明">
          <a-textarea v-model:value="policyForm.description" :rows="2" placeholder="政策说明（可选）" />
        </a-form-item>

        <a-form-item label="规则明细" required>
          <div v-for="(rule, index) in policyForm.rules" :key="index"
            style="border: 1px solid #f0f0f0; border-radius: 6px; padding: 16px; margin-bottom: 12px; position: relative;">
            <a-button
              type="text" danger size="small"
              style="position: absolute; top: 8px; right: 8px;"
              @click="removeRule(index)"
            >
              <DeleteOutlined />
            </a-button>
            <a-row :gutter="12">
              <a-col :span="12">
                <a-form-item label="适用老人类别" style="margin-bottom: 8px;">
                  <a-checkbox-group v-model:value="rule.elderlyCategories" :options="categoryOptions" />
                </a-form-item>
              </a-col>
              <a-col :span="6">
                <a-form-item label="最小年龄" style="margin-bottom: 8px;">
                  <a-input-number v-model:value="rule.ageMin" :min="0" style="width: 100%" />
                </a-form-item>
              </a-col>
              <a-col :span="6">
                <a-form-item label="最大年龄" style="margin-bottom: 8px;">
                  <a-input-number v-model:value="rule.ageMax" :min="0" placeholder="不限" style="width: 100%" />
                </a-form-item>
              </a-col>
            </a-row>
            <a-row :gutter="12">
              <a-col :span="8">
                <a-form-item label="助餐点类型" style="margin-bottom: 8px;">
                  <a-select v-model:value="rule.canteenTypes" mode="multiple" placeholder="不限" allow-clear>
                    <a-select-option value="community">社区食堂</a-select-option>
                    <a-select-option value="partner">合作餐厅</a-select-option>
                    <a-select-option value="senior_center">养老中心</a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="适用餐段" style="margin-bottom: 8px;">
                  <a-checkbox-group v-model:value="rule.mealTypes" :options="mealTypeOptions" />
                </a-form-item>
              </a-col>
              <a-col :span="4">
                <a-form-item label="补贴方式" style="margin-bottom: 8px;">
                  <a-select v-model:value="rule.subsidyType">
                    <a-select-option value="fixed">固定金额</a-select-option>
                    <a-select-option value="percentage">比例</a-select-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="4">
                <a-form-item :label="rule.subsidyType === 'fixed' ? '补贴金额(元)' : '补贴比例(%)'" style="margin-bottom: 8px;">
                  <a-input-number v-model:value="rule.subsidyValue" :min="0" style="width: 100%" />
                </a-form-item>
              </a-col>
            </a-row>
            <a-row :gutter="12">
              <a-col :span="6">
                <a-form-item label="高龄补贴(元)" style="margin-bottom: 8px;">
                  <a-input-number v-model:value="rule.seniorBonus" :min="0" style="width: 100%" />
                </a-form-item>
              </a-col>
              <a-col :span="6">
                <a-form-item label="高龄门槛年龄" style="margin-bottom: 8px;">
                  <a-input-number v-model:value="rule.seniorBonusAge" :min="0" style="width: 100%" />
                </a-form-item>
              </a-col>
              <a-col :span="6">
                <a-form-item label="优先级" style="margin-bottom: 8px;">
                  <a-input-number v-model:value="rule.priority" style="width: 100%" />
                </a-form-item>
              </a-col>
            </a-row>
          </div>
          <a-button type="dashed" block @click="addRule">
            <PlusOutlined /> 添加规则
          </a-button>
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="detailModalVisible"
      :title="`政策详情 - ${detailPolicy?.name || ''}`"
      width="800px"
      :footer="null"
    >
      <template v-if="detailPolicy">
        <a-descriptions bordered :column="2" size="small">
          <a-descriptions-item label="政策名称">{{ detailPolicy.name }}</a-descriptions-item>
          <a-descriptions-item label="版本">
            <a-tag color="blue">v{{ detailPolicy.version }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag :color="getStatusColor(detailPolicy.status)">{{ getStatusText(detailPolicy.status) }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="生效期">
            {{ formatDate(detailPolicy.effectiveDate) }} ~ {{ formatDate(detailPolicy.expiryDate) }}
          </a-descriptions-item>
          <a-descriptions-item label="说明" :span="2">{{ detailPolicy.description || '无' }}</a-descriptions-item>
        </a-descriptions>

        <a-divider>规则明细 ({{ detailPolicy.rules?.length || 0 }}条)</a-divider>

        <a-table
          :columns="ruleColumns"
          :data-source="detailPolicy.rules || []"
          :pagination="false"
          row-key="_id"
          size="small"
          :scroll="{ x: 800 }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'elderlyCategories'">
              <a-tag v-for="cat in record.elderlyCategories" :key="cat" size="small" style="margin: 2px;">
                {{ getCategoryText(cat) }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'ageRange'">
              {{ record.ageMin }}~{{ record.ageMax ?? '∞' }}岁
            </template>
            <template v-else-if="column.key === 'subsidyValue'">
              <span style="color: #52c41a; font-weight: 500;">
                {{ record.subsidyType === 'fixed' ? `${record.subsidyValue}元` : `${record.subsidyValue}%` }}
              </span>
            </template>
            <template v-else-if="column.key === 'seniorBonus'">
              {{ record.seniorBonus > 0 ? `${record.seniorBonus}元(${record.seniorBonusAge}岁+)` : '无' }}
            </template>
          </template>
        </a-table>
      </template>
    </a-modal>

    <a-modal
      v-model:open="versionModalVisible"
      title="版本历史"
      width="700px"
      :footer="null"
    >
      <a-timeline>
        <a-timeline-item v-for="v in versionHistory" :key="v._id" :color="getVersionColor(v.status)">
          <a-space>
            <a-tag color="blue">v{{ v.version }}</a-tag>
            <a-tag :color="getStatusColor(v.status)">{{ getStatusText(v.status) }}</a-tag>
            <span>{{ formatDate(v.effectiveDate) }} ~ {{ formatDate(v.expiryDate) }}</span>
          </a-space>
          <div style="color: #999; font-size: 12px; margin-top: 4px;">
            创建于 {{ formatDate(v.createdAt) }}
          </div>
        </a-timeline-item>
      </a-timeline>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import dayjs, { Dayjs } from 'dayjs'
import {
  getPolicyList,
  createPolicy,
  updatePolicy,
  activatePolicy,
  createNewVersion,
  getVersionHistory,
  SubsidyPolicy,
  SubsidyRule,
} from '@/api/policy'

const loading = ref(false)
const saving = ref(false)
const policyList = ref<SubsidyPolicy[]>([])
const statusFilter = ref('')

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条政策`,
})

const columns = [
  { title: '政策名称', dataIndex: 'name', key: 'name', width: 180 },
  { title: '版本', key: 'version', width: 80, align: 'center' },
  { title: '状态', key: 'status', width: 90, align: 'center' },
  { title: '生效期', key: 'effectiveDate', width: 240 },
  { title: '规则数', key: 'rulesCount', width: 100, align: 'center' },
  { title: '操作', key: 'action', width: 280, fixed: 'right' as const },
]

const ruleColumns = [
  { title: '老人类别', key: 'elderlyCategories', width: 200 },
  { title: '年龄段', key: 'ageRange', width: 100 },
  { title: '补贴标准', key: 'subsidyValue', width: 120 },
  { title: '高龄补贴', key: 'seniorBonus', width: 140 },
  { title: '优先级', dataIndex: 'priority', width: 80 },
]

const categoryOptions = [
  { label: '低保户', value: 'dibao' },
  { label: '低收入', value: 'low_income' },
  { label: '特困供养', value: 'tekun' },
  { label: '普通老人', value: 'normal' },
  { label: '计生特扶', value: 'jihua_tefu' },
]

const mealTypeOptions = [
  { label: '午餐', value: 'lunch' },
  { label: '晚餐', value: 'dinner' },
]

const createModalVisible = ref(false)
const detailModalVisible = ref(false)
const versionModalVisible = ref(false)
const editingPolicy = ref<SubsidyPolicy | null>(null)
const detailPolicy = ref<SubsidyPolicy | null>(null)
const versionHistory = ref<any[]>([])

const defaultRule = (): SubsidyRule => ({
  elderlyCategories: [],
  ageMin: 60,
  ageMax: null,
  canteenTypes: [],
  mealTypes: ['lunch', 'dinner'],
  subsidyType: 'fixed',
  subsidyValue: 5,
  seniorBonus: 0,
  seniorBonusAge: 80,
  priority: 0,
})

const policyForm = reactive({
  name: '',
  effectiveDate: null as Dayjs | null,
  expiryDate: null as Dayjs | null,
  description: '',
  rules: [defaultRule()] as SubsidyRule[],
})

function getCategoryText(category: string): string {
  const map: Record<string, string> = {
    dibao: '低保户',
    low_income: '低收入',
    tekun: '特困供养',
    normal: '普通老人',
    jihua_tefu: '计生特扶',
  }
  return map[category] || category
}

function getStatusText(status: string): string {
  const map: Record<string, string> = { draft: '草稿', active: '生效中', expired: '已失效' }
  return map[status] || status
}

function getStatusColor(status: string): string {
  const map: Record<string, string> = { draft: 'default', active: 'green', expired: 'red' }
  return map[status] || 'default'
}

function getVersionColor(status: string): string {
  const map: Record<string, string> = { draft: 'gray', active: 'green', expired: 'red' }
  return map[status] || 'gray'
}

function formatDate(date: string | Date): string {
  if (!date) return '-'
  return dayjs(date).format('YYYY-MM-DD')
}

async function loadData() {
  loading.value = true
  try {
    const res = await getPolicyList({
      status: statusFilter.value || undefined,
      page: pagination.current,
      pageSize: pagination.pageSize,
    })
    policyList.value = res.list
    pagination.total = res.total
  } finally {
    loading.value = false
  }
}

function handleTableChange(pag: any) {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  loadData()
}

function showCreateModal() {
  editingPolicy.value = null
  policyForm.name = ''
  policyForm.effectiveDate = null
  policyForm.expiryDate = null
  policyForm.description = ''
  policyForm.rules = [defaultRule()]
  createModalVisible.value = true
}

function editPolicy(record: SubsidyPolicy) {
  editingPolicy.value = record
  policyForm.name = record.name
  policyForm.effectiveDate = dayjs(record.effectiveDate)
  policyForm.expiryDate = dayjs(record.expiryDate)
  policyForm.description = record.description
  policyForm.rules = record.rules.map(r => ({ ...r, elderlyCategories: [...r.elderlyCategories], canteenTypes: [...r.canteenTypes], mealTypes: [...r.mealTypes] }))
  createModalVisible.value = true
}

function addRule() {
  policyForm.rules.push(defaultRule())
}

function removeRule(index: number) {
  policyForm.rules.splice(index, 1)
}

async function handleSavePolicy() {
  if (!policyForm.name || !policyForm.effectiveDate || !policyForm.expiryDate) {
    message.warning('请填写政策名称、生效日期和失效日期')
    return
  }
  if (policyForm.rules.length === 0) {
    message.warning('请至少添加一条规则')
    return
  }

  saving.value = true
  try {
    const data = {
      name: policyForm.name,
      effectiveDate: policyForm.effectiveDate!.toISOString(),
      expiryDate: policyForm.expiryDate!.toISOString(),
      description: policyForm.description,
      rules: policyForm.rules,
    }

    if (editingPolicy.value) {
      await updatePolicy(editingPolicy.value._id, data)
      message.success('政策更新成功')
    } else {
      await createPolicy(data)
      message.success('政策创建成功')
    }

    createModalVisible.value = false
    loadData()
  } catch (error) {
    console.error(error)
  } finally {
    saving.value = false
  }
}

async function handleActivate(record: SubsidyPolicy) {
  Modal.confirm({
    title: '确认激活政策',
    content: `激活"${record.name}"(v${record.version})后，当前生效的政策将被标记为已失效。确定继续？`,
    async onOk() {
      try {
        await activatePolicy(record._id)
        message.success('政策已激活')
        loadData()
      } catch (error) {
        console.error(error)
      }
    },
  })
}

function viewDetail(record: SubsidyPolicy) {
  detailPolicy.value = record
  detailModalVisible.value = true
}

async function handleNewVersion(record: SubsidyPolicy) {
  Modal.confirm({
    title: '创建新版本',
    content: `将基于"${record.name}"(v${record.version})创建新版本。请在新窗口中设置生效日期和失效日期。`,
    async onOk() {
      try {
        const newEffective = dayjs().add(1, 'month').startOf('month')
        const newExpiry = newEffective.add(1, 'year').endOf('month')
        await createNewVersion(record._id, {
          effectiveDate: newEffective.toISOString(),
          expiryDate: newExpiry.toISOString(),
        })
        message.success('新版本已创建，请编辑草稿后激活')
        loadData()
      } catch (error) {
        console.error(error)
      }
    },
  })
}

async function viewVersionHistory(record: SubsidyPolicy) {
  try {
    versionHistory.value = await getVersionHistory(record._id)
    versionModalVisible.value = true
  } catch (error) {
    console.error(error)
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.page {
  padding: 24px;
}
</style>
