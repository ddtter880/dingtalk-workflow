<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useProjectStore } from '@/store/project'
import { useUserStore } from '@/store/user'
import { ProjectStatus, UrgencyLevel, URGENCY_CONFIG } from '@/utils/constants'
import { addHistoryRecord } from '@/utils/sheet-api'
import { getCurrentWeek } from '@/utils/week'
import { ArrowLeft } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const projectStore = useProjectStore()
const userStore = useUserStore()

const isEdit = ref(false)
const projectId = ref('')

const formData = ref({
  work_name: '',
  work_requirement: '',
  responsible_dept: '',
  responsible_person: '',
  responsible_leader: '',
  plan_finish_date: '',
  actual_finish_date: '',
  risk_impact: '',
  progress: '',
  coordination_needs: '',
  suggestion: '',
  meeting_notes: '',
  urgency_level: UrgencyLevel.NORMAL,
  is_pending_close: false,
  remark: '',
})

const urgencyOptions = [
  { value: UrgencyLevel.URGENT_IMPORTANT, ...URGENCY_CONFIG[UrgencyLevel.URGENT_IMPORTANT] },
  { value: UrgencyLevel.URGENT, ...URGENCY_CONFIG[UrgencyLevel.URGENT] },
  { value: UrgencyLevel.IMPORTANT, ...URGENCY_CONFIG[UrgencyLevel.IMPORTANT] },
  { value: UrgencyLevel.NORMAL, ...URGENCY_CONFIG[UrgencyLevel.NORMAL] },
]

const canSubmit = computed(() => formData.value.work_name.trim() !== '')

onMounted(() => {
  const id = route.params.id as string
  if (id) {
    isEdit.value = true
    projectId.value = id
    const project = projectStore.projects.find(p => p.project_id === id)
    if (project) {
      formData.value = {
        work_name: project.work_name,
        work_requirement: project.work_requirement,
        responsible_dept: project.responsible_dept,
        responsible_person: project.responsible_person,
        responsible_leader: project.responsible_leader,
        plan_finish_date: project.plan_finish_date,
        actual_finish_date: project.actual_finish_date,
        risk_impact: project.risk_impact,
        progress: project.progress,
        coordination_needs: project.coordination_needs,
        suggestion: project.suggestion,
        meeting_notes: project.meeting_notes,
        urgency_level: project.urgency_level,
        is_pending_close: project.is_pending_close,
        remark: project.remark,
      }
    }
  }
})

function fillNoProgress() {
  formData.value.progress = '本周无进展'
  formData.value.risk_impact = '无'
}

async function submitForm() {
  if (!canSubmit.value) return

  if (isEdit.value) {
    await projectStore.editProject(projectId.value, {
      ...formData.value,
      category: formData.value.is_pending_close ? ProjectStatus.PENDING_CLOSE : undefined,
    })

    // 记录历史
    addHistoryRecord({
      project_id: projectId.value,
      version: Date.now(),
      operator_id: userStore.userInfo?.userid || '',
      operator_role: userStore.userInfo?.role as any,
      field_name: '表单更新',
      old_value: '',
      new_value: '更新了工作信息',
      operated_at: new Date().toISOString(),
    })
  } else {
    await projectStore.addProject({
      ...formData.value,
      category: ProjectStatus.NEW,
      created_by: userStore.userInfo?.userid || '',
      created_week: getCurrentWeek(),
    })
  }

  router.back()
}

function goBack() {
  router.back()
}
</script>

<template>
  <div class="page-container pb-24">
    <!-- 顶部导航 -->
    <div class="nav-bar">
      <div class="nav-bar-content">
        <button @click="goBack" class="flex items-center gap-1 text-primary">
          <ArrowLeft class="w-5 h-5" />
          <span class="text-sm">返回</span>
        </button>
        <h2 class="text-base font-semibold text-gray-900">
          {{ isEdit ? '编辑项目' : '新建项目' }}
        </h2>
        <div class="w-16" />
      </div>
    </div>

    <div class="pt-14 px-4 space-y-3 mt-2">
      <!-- 基本信息 -->
      <div class="card">
        <h3 class="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">基本信息</h3>

        <div class="space-y-4">
          <div>
            <label class="block text-sm text-gray-500 mb-1">项目名称 <span class="text-red-500">*</span></label>
            <input v-model="formData.work_name" class="input-field" placeholder="请输入项目名称" />
          </div>

          <div>
            <label class="block text-sm text-gray-500 mb-1">责任部门</label>
            <input v-model="formData.responsible_dept" class="input-field" placeholder="请输入责任部门" />
          </div>

          <div>
            <label class="block text-sm text-gray-500 mb-1">责任人</label>
            <input v-model="formData.responsible_person" class="input-field" placeholder="请输入责任人" />
          </div>

          <div>
            <label class="block text-sm text-gray-500 mb-1">责任领导</label>
            <input v-model="formData.responsible_leader" class="input-field" placeholder="请输入责任领导" />
          </div>

          <div>
            <label class="block text-sm text-gray-500 mb-1">紧急重要程度</label>
            <div class="grid grid-cols-4 gap-2">
              <button
                v-for="opt in urgencyOptions"
                :key="opt.value"
                class="flex flex-col items-center py-2.5 rounded-lg border-2 transition-all"
                :class="formData.urgency_level === opt.value ? 'border-current' : 'border-gray-100'"
                :style="{
                  borderColor: formData.urgency_level === opt.value ? opt.color : '',
                  backgroundColor: formData.urgency_level === opt.value ? opt.bgColor : '',
                }"
                @click="formData.urgency_level = opt.value"
              >
                <span class="text-base" :style="{ color: opt.color }">{{ opt.icon }}</span>
                <span class="text-[10px] mt-0.5" :style="{ color: opt.color }">{{ opt.label }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 工作信息 -->
      <div class="card">
        <h3 class="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">工作信息</h3>

        <div class="space-y-4">
          <div>
            <label class="block text-sm text-gray-500 mb-1">工作要求</label>
            <textarea v-model="formData.work_requirement" class="textarea-field h-20" placeholder="请输入工作要求" />
          </div>

          <div>
            <label class="block text-sm text-gray-500 mb-1">进展情况</label>
            <textarea v-model="formData.progress" class="textarea-field h-20" placeholder="请输入当前进展" />
          </div>

          <div>
            <label class="block text-sm text-gray-500 mb-1">风险影响</label>
            <textarea v-model="formData.risk_impact" class="textarea-field h-16" placeholder="请输入风险影响" />
          </div>

          <div>
            <label class="block text-sm text-gray-500 mb-1">需协调事项</label>
            <textarea v-model="formData.coordination_needs" class="textarea-field h-16" placeholder="请输入需要协调的事项" />
          </div>

          <div>
            <label class="block text-sm text-gray-500 mb-1">建议方案</label>
            <textarea v-model="formData.suggestion" class="textarea-field h-16" placeholder="请输入建议方案" />
          </div>

          <div>
            <label class="block text-sm text-gray-500 mb-1">会议精神</label>
            <textarea v-model="formData.meeting_notes" class="textarea-field h-16" placeholder="请输入会议决策内容" />
          </div>

          <div>
            <label class="block text-sm text-gray-500 mb-1">备注</label>
            <textarea v-model="formData.remark" class="textarea-field h-16" placeholder="请输入备注" />
          </div>
        </div>
      </div>

      <!-- 时间信息 -->
      <div class="card">
        <h3 class="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">时间信息</h3>

        <div class="space-y-4">
          <div>
            <label class="block text-sm text-gray-500 mb-1">计划完成时间</label>
            <input v-model="formData.plan_finish_date" type="date" class="input-field" />
          </div>

          <div>
            <label class="block text-sm text-gray-500 mb-1">实际完成时间</label>
            <input v-model="formData.actual_finish_date" type="date" class="input-field" />
          </div>
        </div>
      </div>

      <!-- 快捷操作 -->
      <button
        class="w-full py-3 border-2 border-dashed border-primary rounded-xl text-primary text-sm font-medium flex items-center justify-center gap-2 active:bg-primary-50 transition-colors"
        @click="fillNoProgress"
      >
        <span>○</span>
        <span>本周无进展</span>
      </button>

      <!-- 销项标记 -->
      <div v-if="isEdit" class="card">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-gray-700">标记为待销项</h3>
            <p class="text-xs text-gray-400 mt-0.5">确认后将进入销项审批流程</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="formData.is_pending_close" class="sr-only peer" />
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
          </label>
        </div>
      </div>
    </div>

    <!-- 提交按钮 -->
    <div class="fixed bottom-0 left-0 right-0 p-4 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <button
        class="w-full py-3.5 rounded-full text-white font-medium text-base transition-all"
        :class="canSubmit ? 'bg-primary active:bg-primary-700' : 'bg-gray-300 cursor-not-allowed'"
        :disabled="!canSubmit"
        @click="submitForm"
      >
        提交
      </button>
    </div>
  </div>
</template>
