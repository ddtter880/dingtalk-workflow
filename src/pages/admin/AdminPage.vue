<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '@/store/project'
import { useUserStore } from '@/store/user'
import {
  getProjects,
  getRecycleBinItems,
  getPersonnelConfigs,
} from '@/utils/sheet-api'
import { ProjectStatus, URGENCY_CONFIG } from '@/utils/constants'
import type { Project } from '@/utils/constants'
import * as XLSX from 'xlsx'
import {
  ArrowLeft, Download, Upload, BarChart3, Users,
  FileSpreadsheet, AlertTriangle, Clock, CheckCircle2,
  Trash2, Eye
} from 'lucide-vue-next'

const router = useRouter()
const projectStore = useProjectStore()
const userStore = useUserStore()

// 数据状态
const allProjects = ref<Project[]>([])
const closedCount = ref(0)
const recycleCount = ref(0)
const personnelCount = ref(0)
const importMessage = ref('')
const importStatus = ref<'idle' | 'success' | 'error'>('idle')
const showImportModal = ref(false)
const importType = ref<'projects' | 'personnel'>('projects')

onMounted(() => {
  loadData()
})

function loadData() {
  allProjects.value = getProjects()
  closedCount.value = allProjects.value.filter(p => p.category === ProjectStatus.CLOSED).length
  recycleCount.value = getRecycleBinItems().length
  personnelCount.value = getPersonnelConfigs().length
}

// 统计数据
const statsCards = computed(() => [
  { label: '总项目数', value: allProjects.value.length, icon: FileSpreadsheet, color: 'text-primary', bg: 'bg-blue-50' },
  { label: '新增项目', value: allProjects.value.filter(p => p.category === ProjectStatus.NEW).length, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: '进行中', value: allProjects.value.filter(p => p.category === ProjectStatus.PROCESSING).length, icon: BarChart3, color: 'text-amber-600', bg: 'bg-amber-50' },
  { label: '待销项', value: allProjects.value.filter(p => p.category === ProjectStatus.PENDING_CLOSE).length, icon: AlertTriangle, color: 'text-pink-600', bg: 'bg-pink-50' },
  { label: '已销项', value: closedCount.value, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
  { label: '垃圾箱', value: recycleCount.value, icon: Trash2, color: 'text-gray-500', bg: 'bg-gray-50' },
])

// 紧急项目
const urgentProjects = computed(() =>
  allProjects.value.filter(p =>
    p.urgency_level === 'urgent_important' || p.urgency_level === 'urgent'
  )
)

function goBack() { router.back() }
function goDetail(id: string) { router.push(`/detail/${id}`) }

// ==================== Excel 导出 ====================

function exportProjects() {
  const data = allProjects.value.map(p => ({
    '工作事项': p.work_name,
    '状态': p.category === 'new' ? '新增' : p.category === 'processing' ? '待处理' : p.category === 'pending_close' ? '待销项' : '已销项',
    '紧急程度': URGENCY_CONFIG[p.urgency_level]?.label || '一般',
    '工作要求': p.work_requirement,
    '责任部门': p.responsible_dept,
    '责任人': p.responsible_person,
    '责任领导': p.responsible_leader,
    '计划完成时间': p.plan_finish_date,
    '实际完成时间': p.actual_finish_date,
    '风险影响': p.risk_impact,
    '进展情况': p.progress,
    '需协调事项': p.coordination_needs,
    '建议方案': p.suggestion,
    '会议精神': p.meeting_notes,
    '备注': p.remark,
    '创建周次': p.created_week,
    '创建人': p.created_by,
    '更新时间': p.updated_at,
  }))

  const ws = XLSX.utils.json_to_sheet(data)
  // 设置列宽
  ws['!cols'] = [
    { wch: 30 }, { wch: 8 }, { wch: 10 }, { wch: 30 },
    { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
    { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
    { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 10 },
    { wch: 12 }, { wch: 18 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '工作事项')
  XLSX.writeFile(wb, `工作事项管理_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

function exportPersonnel() {
  const personnel = getPersonnelConfigs()
  const data = personnel.map(p => ({
    '项目ID': p.project_id,
    '项目负责人': p.project_manager,
    '室所主任': p.dept_head,
    '分管领导': p.leader,
    '质量安全人员': p.safety_officer,
  }))

  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '人员配置')
  XLSX.writeFile(wb, `人员配置_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ==================== Excel 导入 ====================

function triggerImport(type: 'projects' | 'personnel') {
  importType.value = type
  showImportModal.value = true
  importStatus.value = 'idle'
  importMessage.value = ''
}

async function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return

  const file = input.files[0]
  importStatus.value = 'idle'
  importMessage.value = '正在解析文件...'

  try {
    const arrayBuffer = await file.arrayBuffer()
    const wb = XLSX.read(arrayBuffer)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws)

    if (rows.length === 0) {
      importStatus.value = 'error'
      importMessage.value = '文件为空，没有数据'
      return
    }

    if (importType.value === 'projects') {
      await importProjects(rows)
    } else {
      await importPersonnel(rows)
    }

    // 刷新数据
    await projectStore.loadProjects()
    loadData()
  } catch (e: any) {
    importStatus.value = 'error'
    importMessage.value = `导入失败：${e.message}`
  }
}

async function importProjects(rows: Record<string, string>[]) {
  let imported = 0
  for (const row of rows) {
    try {
      await projectStore.addProject({
        work_name: row['工作事项'] || row['项目名称'] || '',
        work_requirement: row['工作要求'] || '',
        responsible_dept: row['责任部门'] || '',
        responsible_person: row['责任人'] || '',
        responsible_leader: row['责任领导'] || '',
        plan_finish_date: row['计划完成时间'] || '',
        actual_finish_date: row['实际完成时间'] || '',
        risk_impact: row['风险影响'] || '',
        progress: row['进展情况'] || '',
        coordination_needs: row['需协调事项'] || row['需议事协调支持'] || '',
        suggestion: row['建议方案'] || '',
        meeting_notes: row['会议精神'] || '',
        urgency_level: parseUrgency(row['紧急程度'] || row['紧急重要程度'] || ''),
        is_pending_close: false,
        remark: row['备注'] || '',
        category: ProjectStatus.NEW,
        created_by: userStore.userInfo?.userid || 'import',
        created_week: '',
      })
      imported++
    } catch {
      // 跳过错误行
    }
  }
  importStatus.value = 'success'
  importMessage.value = `成功导入 ${imported} 个工作事项`
}

async function importPersonnel(rows: Record<string, string>[]) {
  const { savePersonnelConfig } = await import('@/utils/sheet-api')
  let imported = 0
  for (const row of rows) {
    const projectId = row['项目ID'] || row['项目名称'] || ''
    if (!projectId) continue
    savePersonnelConfig({
      project_id: projectId,
      project_manager: row['项目负责人'] || '',
      dept_head: row['室所主任'] || '',
      leader: row['分管领导'] || '',
      safety_officer: row['质量安全人员'] || '',
    })
    imported++
  }
  importStatus.value = 'success'
  importMessage.value = `成功导入 ${imported} 条人员配置`
}

function parseUrgency(val: string): string {
  if (val.includes('紧急重要') || val.includes('紧急且重要')) return 'urgent_important'
  if (val.includes('紧急')) return 'urgent'
  if (val.includes('重要')) return 'important'
  return 'normal'
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = { new: '新增', processing: '待处理', pending_close: '待销项', closed: '已销项' }
  return map[status] || status
}
</script>

<template>
  <div class="page-container pb-8">
    <!-- 顶部导航 -->
    <div class="nav-bar">
      <div class="nav-bar-content">
        <button @click="goBack" class="flex items-center gap-1 text-primary">
          <ArrowLeft class="w-5 h-5" /><span class="text-sm">返回</span>
        </button>
        <h2 class="text-base font-semibold text-gray-900">管理员控制台</h2>
        <div class="w-16" />
      </div>
    </div>

    <div class="pt-14 px-4 space-y-3 mt-2">
      <!-- 数据总览卡片 -->
      <div class="grid grid-cols-3 gap-2">
        <div v-for="card in statsCards" :key="card.label"
          :class="[card.bg, 'rounded-lg p-3 text-center']">
          <component :is="card.icon" :class="['w-4 h-4 mx-auto', card.color]" />
          <div :class="['text-xl font-bold mt-1', card.color]">{{ card.value }}</div>
          <div class="text-[11px] text-gray-500 mt-0.5">{{ card.label }}</div>
        </div>
      </div>

      <!-- Excel 操作 -->
      <div class="card">
        <h3 class="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">数据导入导出</h3>
        <div class="space-y-2">
          <!-- 导出按钮 -->
          <div class="flex gap-2">
            <button @click="exportProjects"
              class="flex-1 py-2.5 rounded-lg text-sm font-medium bg-green-50 text-green-700 border border-green-200 flex items-center justify-center gap-1.5 active:bg-green-100">
              <Download class="w-4 h-4" /> 导出项目数据
            </button>
            <button @click="exportPersonnel"
              class="flex-1 py-2.5 rounded-lg text-sm font-medium bg-blue-50 text-primary border border-blue-200 flex items-center justify-center gap-1.5 active:bg-blue-100">
              <Download class="w-4 h-4" /> 导出人员配置
            </button>
          </div>
          <!-- 导入按钮 -->
          <div class="flex gap-2">
            <button @click="triggerImport('projects')"
              class="flex-1 py-2.5 rounded-lg text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center gap-1.5 active:bg-amber-100">
              <Upload class="w-4 h-4" /> 导入项目数据
            </button>
            <button @click="triggerImport('personnel')"
              class="flex-1 py-2.5 rounded-lg text-sm font-medium bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center gap-1.5 active:bg-purple-100">
              <Upload class="w-4 h-4" /> 导入人员配置
            </button>
          </div>
        </div>
      </div>

      <!-- 导入弹窗 -->
      <div v-if="showImportModal" class="card border-2 border-primary/30 bg-primary-5">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-semibold text-primary">
            导入{{ importType === 'projects' ? '项目数据' : '人员配置' }}
          </h3>
          <button @click="showImportModal = false" class="text-gray-400 text-sm">关闭</button>
        </div>
        <p class="text-xs text-gray-500 mb-3">
          请上传 Excel 文件（.xlsx），表头需包含：
          {{ importType === 'projects' ? '工作事项、工作要求、责任部门、责任人、责任领导、紧急程度等' : '项目ID、项目负责人、室所主任、分管领导、质量安全人员' }}
        </p>
        <input type="file" accept=".xlsx,.xls" @change="handleFileUpload"
          class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-primary-700" />
        <div v-if="importMessage" :class="[
          'mt-2 text-sm p-2 rounded-lg',
          importStatus === 'success' ? 'bg-green-50 text-green-700' : importStatus === 'error' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-600'
        ]">
          {{ importMessage }}
        </div>
      </div>

      <!-- 紧急项目提醒 -->
      <div v-if="urgentProjects.length > 0" class="card border-l-4 border-red-400">
        <h3 class="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1.5">
          <AlertTriangle class="w-4 h-4" /> 紧急/重要项目（{{ urgentProjects.length }}）
        </h3>
        <div class="space-y-2">
          <div v-for="p in urgentProjects.slice(0, 5)" :key="p.project_id"
            class="flex items-center justify-between p-2 bg-red-50 rounded-lg">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-800 truncate">{{ p.work_name }}</p>
              <p class="text-xs text-gray-500">{{ p.responsible_person }} · {{ p.responsible_dept }}</p>
            </div>
            <button @click="goDetail(p.project_id)" class="ml-2 p-1.5 text-primary">
              <Eye class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- 全部项目列表 -->
      <div class="card">
        <h3 class="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100 flex items-center gap-1.5">
          <FileSpreadsheet class="w-4 h-4 text-primary" /> 全部项目（{{ allProjects.length }}）
        </h3>
        <div class="space-y-2 max-h-96 overflow-y-auto">
          <div v-for="p in allProjects" :key="p.project_id"
            class="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span :class="[
                  'inline-block w-2 h-2 rounded-full',
                  p.urgency_level === 'urgent_important' ? 'bg-red-500' :
                  p.urgency_level === 'urgent' ? 'bg-orange-500' :
                  p.urgency_level === 'important' ? 'bg-blue-500' : 'bg-gray-300'
                ]" />
                <p class="text-sm font-medium text-gray-800 truncate">{{ p.work_name }}</p>
              </div>
              <div class="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                <span>{{ getStatusLabel(p.category) }}</span>
                <span>{{ p.responsible_person || '-' }}</span>
                <span>{{ p.created_week }}</span>
              </div>
            </div>
            <button @click="goDetail(p.project_id)" class="ml-2 p-1.5 text-primary">
              <Eye class="w-4 h-4" />
            </button>
          </div>
          <div v-if="allProjects.length === 0" class="text-center text-gray-400 text-sm py-4">暂无项目数据</div>
        </div>
      </div>
    </div>
  </div>
</template>
