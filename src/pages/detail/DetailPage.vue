<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useProjectStore } from '@/store/project'
import { useUserStore } from '@/store/user'
import { getProjectHistory } from '@/utils/sheet'
import type { HistoryRecord, Project } from '@/utils/constants'
import { URGENCY_CONFIG, UserRole, ROLE_CONFIG, ProjectStatus } from '@/utils/constants'
import { formatDate } from '@/utils/week'
import StatusTag from '@/components/StatusTag.vue'
import PriorityBadge from '@/components/PriorityBadge.vue'
import ApprovalFlow from '@/components/ApprovalFlow.vue'
import HistoryTimeline from '@/components/HistoryTimeline.vue'
import { ArrowLeft, Edit } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const projectStore = useProjectStore()
const userStore = useUserStore()

const project = ref<Project | null>(null)
const historyRecords = ref<HistoryRecord[]>([])
const showHistory = ref(false)

onMounted(async () => {
  const id = route.params.id as string
  const foundProject = projectStore.projects.find(p => p.project_id === id)
  if (foundProject) {
    project.value = foundProject
    historyRecords.value = getProjectHistory(id)
  }
})

function goBack() {
  router.back()
}

function goEdit() {
  router.push(`/form/${project.value!.project_id}`)
}

function goApproval() {
  if (project.value) {
    router.push(`/approval/${project.value.project_id}`)
  }
}

const infoFields = [
  { key: 'work_requirement', label: '工作要求' },
  { key: 'progress', label: '进展情况' },
  { key: 'risk_impact', label: '风险影响' },
  { key: 'coordination_needs', label: '需协调事项' },
  { key: 'suggestion', label: '建议方案' },
  { key: 'meeting_notes', label: '会议精神' },
  { key: 'remark', label: '备注' },
]
</script>

<template>
  <div class="page-container pb-24" v-if="project">
    <!-- 顶部导航 -->
    <div class="nav-bar">
      <div class="nav-bar-content">
        <button @click="goBack" class="flex items-center gap-1 text-primary">
          <ArrowLeft class="w-5 h-5" />
          <span class="text-sm">返回</span>
        </button>
        <h2 class="text-base font-semibold text-gray-900 truncate max-w-[50%]">{{ project.work_name }}</h2>
        <button @click="goEdit" class="p-1.5 rounded-lg hover:bg-gray-100">
          <Edit class="w-5 h-5 text-primary" />
        </button>
      </div>
    </div>

    <div class="pt-14 px-4 space-y-3 mt-2">
      <!-- 状态与优先级 -->
      <div class="card">
        <div class="flex items-center justify-between">
          <StatusTag :status="project.category" />
          <PriorityBadge :level="project.urgency_level" />
        </div>
        <div class="flex items-center gap-4 mt-2 text-xs text-gray-400">
          <span>创建周次：{{ project.created_week }}</span>
          <span>更新：{{ formatDate(project.updated_at) }}</span>
        </div>
      </div>

      <!-- 基本信息 -->
      <div class="card">
        <h3 class="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">基本信息</h3>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span class="text-gray-400 text-xs">责任部门</span>
            <p class="text-gray-800 mt-0.5">{{ project.responsible_dept || '-' }}</p>
          </div>
          <div>
            <span class="text-gray-400 text-xs">责任人</span>
            <p class="text-gray-800 mt-0.5">{{ project.responsible_person || '-' }}</p>
          </div>
          <div>
            <span class="text-gray-400 text-xs">计划完成</span>
            <p class="text-gray-800 mt-0.5">{{ project.plan_finish_date ? formatDate(project.plan_finish_date) : '-' }}</p>
          </div>
          <div>
            <span class="text-gray-400 text-xs">实际完成</span>
            <p class="text-gray-800 mt-0.5">{{ project.actual_finish_date ? formatDate(project.actual_finish_date) : '-' }}</p>
          </div>
        </div>
      </div>

      <!-- 工作信息 -->
      <div class="card">
        <h3 class="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">工作信息</h3>
        <div class="space-y-3">
          <div v-for="field in infoFields" :key="field.key">
            <div v-if="project && project[field.key]" class="flex gap-2">
              <span class="text-xs text-gray-400 whitespace-nowrap min-w-[70px]">{{ field.label }}</span>
              <p class="text-sm text-gray-700 leading-relaxed">{{ project[field.key] }}</p>
            </div>
          </div>
          <div v-if="!infoFields.some(f => project?.[f.key])" class="text-center text-gray-400 text-sm py-4">
            暂无工作信息
          </div>
        </div>

        <!-- 历史版本 -->
        <HistoryTimeline v-if="historyRecords.length > 0" :records="historyRecords" />
      </div>

      <!-- 审批流程 -->
      <div class="card">
        <h3 class="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">审批流程</h3>
        <ApprovalFlow
          :current-role="userStore.userInfo?.role || UserRole.DEPT_HEAD"
          :completed-roles="project
            ? (project.category === ProjectStatus.PROCESSING || project.category === ProjectStatus.PENDING_CLOSE
                ? [UserRole.PROJECT_MANAGER, UserRole.DEPT_HEAD, UserRole.LEADER]
                : project.category === ProjectStatus.NEW
                  ? [UserRole.PROJECT_MANAGER]
                  : [UserRole.PROJECT_MANAGER])
            : [UserRole.PROJECT_MANAGER]"
        />
      </div>
    </div>

    <!-- 底部操作 -->
    <div class="fixed bottom-0 left-0 right-0 p-4 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)] flex gap-3">
      <button
        class="flex-1 py-3.5 rounded-full text-primary font-medium text-sm border border-primary active:bg-primary-50 transition-colors"
        @click="goEdit"
      >
        编辑
      </button>
      <button
        class="flex-1 py-3.5 rounded-full text-white font-medium text-sm bg-primary active:bg-primary-700 transition-colors"
        @click="goApproval"
      >
        审批操作
      </button>
    </div>
  </div>

  <div v-else class="page-container flex items-center justify-center">
    <p class="text-gray-400">项目不存在</p>
  </div>
</template>
