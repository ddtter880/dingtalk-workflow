<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useProjectStore } from '@/store/project'
import { useUserStore } from '@/store/user'
import { ProjectStatus, UserRole, ROLE_CONFIG } from '@/utils/constants'
import { addHistoryRecord } from '@/utils/sheet-api'
import {
  sendRobotMessage,
  sendWorkNotification,
  createApproval,
  createTodoTask,
} from '@/utils/dingtalk'
import StatusTag from '@/components/StatusTag.vue'
import ApprovalFlow from '@/components/ApprovalFlow.vue'
import { ArrowLeft, Check, X, Trash2, Send } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const projectStore = useProjectStore()
const userStore = useUserStore()

const project = ref<any>(null)
const comment = ref('')
const completedRoles = ref<string[]>([])
const submitting = ref(false)

onMounted(() => {
  const id = route.params.id as string
  project.value = projectStore.projects.find(p => p.project_id === id)
  if (project.value) {
    // 根据当前审批角色和项目状态推算已完成节点
    const roleOrder = [UserRole.PROJECT_MANAGER, UserRole.DEPT_HEAD, UserRole.LEADER, UserRole.SAFETY]
    const currentIdx = roleOrder.indexOf(userStore.userInfo?.role || UserRole.DEPT_HEAD)
    completedRoles.value = roleOrder.slice(0, currentIdx)
  }
})

function goBack() {
  router.back()
}

/**
 * 审批通过
 * 支持两种模式：
 * 1. 钉钉OA审批（需配置processCode）→ 调用钉钉API
 * 2. 内置审批流程 → 直接更新状态
 */
async function approve() {
  if (!project.value || submitting.value) return
  submitting.value = true

  const currentRole = userStore.userInfo?.role || UserRole.DEPT_HEAD
  const operatorName = userStore.userInfo?.name || '未知用户'

  try {
    // 记录审批历史
    addHistoryRecord({
      project_id: project.value.project_id,
      version: Date.now(),
      operator_id: userStore.userInfo?.userid || '',
      operator_role: currentRole,
      field_name: '审批操作',
      old_value: '待审核',
      new_value: `通过（${operatorName}）${comment.value ? '：' + comment.value : ''}`,
      operated_at: new Date().toISOString(),
    })

    // 如果是质量安全人员审批且标记为待销项 → 确认销项
    if (currentRole === UserRole.SAFETY && project.value.is_pending_close) {
      await projectStore.editProject(project.value.project_id, {
        category: ProjectStatus.CLOSED,
      })

      // 发送销项通知
      await sendRobotMessage(
        `【销项通知】项目"${project.value.work_name}"已由${operatorName}确认销项`,
        true
      )

      // 同时通过工作通知给项目负责人
      if (project.value.created_by) {
        await sendWorkNotification({
          userid_list: project.value.created_by,
          content: `项目"${project.value.work_name}"已确认销项`,
          title: '销项通知',
          msgtype: 'text',
        })
      }
    } else {
      // 推进项目状态：新增 → 待处理
      if (project.value.category === ProjectStatus.NEW) {
        await projectStore.editProject(project.value.project_id, {
          category: ProjectStatus.PROCESSING,
        })
      }

      // 通知下一层级审批人
      const nextRoleMap: Record<string, string> = {
        [UserRole.PROJECT_MANAGER]: '室所主任',
        [UserRole.DEPT_HEAD]: '分管领导',
        [UserRole.LEADER]: '质量安全人员',
      }
      const nextRole = nextRoleMap[currentRole]

      if (nextRole) {
        const notifyMsg = `【审批通知】项目"${project.value.work_name}"已通过${ROLE_CONFIG[currentRole]?.label}审批，请${nextRole}审核`

        // 机器人群通知
        await sendRobotMessage(notifyMsg)

        // 也可以通过钉钉OA审批发起正式审批流（需配置审批模板）
        // TODO: 当processCode配置完成后启用
        // await createApproval({
        //   processCode: '审批模板编码',
        //   originatorUserId: userStore.userInfo?.userid || '',
        //   formComponentValues: [
        //     { name: '项目名称', value: project.value.work_name },
        //     { name: '审批意见', value: comment.value || '通过' },
        //   ],
        // })
      }
    }
  } catch (e) {
    console.error('[审批] 通过操作异常:', e)
  } finally {
    submitting.value = false
    router.back()
  }
}

// 审批驳回
async function reject() {
  if (!project.value || submitting.value) return
  submitting.value = true

  const currentRole = userStore.userInfo?.role || UserRole.DEPT_HEAD
  const operatorName = userStore.userInfo?.name || '未知用户'

  try {
    addHistoryRecord({
      project_id: project.value.project_id,
      version: Date.now(),
      operator_id: userStore.userInfo?.userid || '',
      operator_role: currentRole,
      field_name: '审批操作',
      old_value: '待审核',
      new_value: `驳回（${operatorName}）${comment.value ? '：' + comment.value : ''}`,
      operated_at: new Date().toISOString(),
    })

    // 通知项目负责人
    const rejectMsg = `【审批驳回】项目"${project.value.work_name}"被${ROLE_CONFIG[currentRole]?.label}（${operatorName}）驳回${comment.value ? '，原因：' + comment.value : ''}`
    await sendRobotMessage(rejectMsg)

    if (project.value.created_by) {
      await sendWorkNotification({
        userid_list: project.value.created_by,
        content: rejectMsg,
        title: '审批驳回通知',
        msgtype: 'text',
      })
    }
  } catch (e) {
    console.error('[审批] 驳回操作异常:', e)
  } finally {
    submitting.value = false
    router.back()
  }
}

// 确认销项
async function confirmClose() {
  if (!project.value || submitting.value) return
  submitting.value = true

  const operatorName = userStore.userInfo?.name || '未知用户'

  try {
    await projectStore.editProject(project.value.project_id, {
      category: ProjectStatus.CLOSED,
    })
    await projectStore.removeProject(project.value.project_id)

    // 全员通知销项
    await sendRobotMessage(
      `【销项通知】项目"${project.value.work_name}"已由${operatorName}确认销项`,
      true
    )

    // 记录历史
    addHistoryRecord({
      project_id: project.value.project_id,
      version: Date.now(),
      operator_id: userStore.userInfo?.userid || '',
      operator_role: UserRole.SAFETY,
      field_name: '销项确认',
      old_value: '待销项',
      new_value: `已销项（${operatorName}确认）`,
      operated_at: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[审批] 销项操作异常:', e)
  } finally {
    submitting.value = false
    router.push('/')
  }
}
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
        <h2 class="text-base font-semibold text-gray-900">审批操作</h2>
        <div class="w-16" />
      </div>
    </div>

    <div class="pt-14 px-4 space-y-3 mt-2">
      <!-- 项目信息 -->
      <div class="card">
        <div class="flex items-start justify-between">
          <h3 class="text-base font-semibold text-gray-900 leading-snug">{{ project.work_name }}</h3>
          <StatusTag :status="project.category" />
        </div>
        <p v-if="project.progress" class="mt-2 text-sm text-gray-600">{{ project.progress }}</p>
        <div class="flex items-center gap-2 mt-2 text-xs text-gray-400">
          <span>责任人：{{ project.responsible_person || '-' }}</span>
          <span>·</span>
          <span>截止：{{ project.plan_finish_date || '无' }}</span>
        </div>
      </div>

      <!-- 当前审批人信息 -->
      <div class="card bg-blue-50/50">
        <div class="flex items-center gap-2 text-sm">
          <Send class="w-4 h-4 text-primary" />
          <span class="text-gray-600">当前审批人：</span>
          <span class="font-medium text-primary">{{ userStore.userInfo?.name }}</span>
          <span class="text-gray-400">（{{ ROLE_CONFIG[userStore.userInfo?.role || '']?.label }}）</span>
        </div>
      </div>

      <!-- 审批流程 -->
      <div class="card">
        <h3 class="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">审批流程</h3>
        <ApprovalFlow
          :current-role="userStore.userInfo?.role || UserRole.DEPT_HEAD"
          :completed-roles="completedRoles"
        />
      </div>

      <!-- 审批意见 -->
      <div class="card">
        <h3 class="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">审批意见</h3>
        <textarea
          v-model="comment"
          class="textarea-field h-24"
          placeholder="请输入审批意见（选填）"
        />
      </div>

      <!-- 销项确认（仅质量安全人员可见） -->
      <div v-if="userStore.isSafety && project.is_pending_close" class="card border-2 border-pink-200 bg-pink-50/50">
        <div class="flex items-center gap-2 mb-2">
          <Trash2 class="w-4 h-4 text-pink-500" />
          <h3 class="text-sm font-semibold text-pink-700">销项确认</h3>
        </div>
        <p class="text-xs text-pink-600 mb-3">项目负责人已标记此项目为待销项，请确认是否销项</p>
        <button
          class="w-full py-3 rounded-xl bg-pink-500 text-white font-medium text-sm active:bg-pink-600 transition-colors flex items-center justify-center gap-1"
          :disabled="submitting"
          @click="confirmClose"
        >
          <Check class="w-4 h-4" />
          {{ submitting ? '处理中...' : '确认销项' }}
        </button>
      </div>
    </div>

    <!-- 底部操作 -->
    <div class="fixed bottom-0 left-0 right-0 p-4 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)] flex gap-3">
      <button
        class="flex-1 py-3.5 rounded-full text-red-500 font-medium text-sm border border-red-300 active:bg-red-50 transition-colors flex items-center justify-center gap-1"
        :disabled="submitting"
        @click="reject"
      >
        <X class="w-4 h-4" />
        {{ submitting ? '处理中...' : '驳回' }}
      </button>
      <button
        class="flex-1 py-3.5 rounded-full text-white font-medium text-sm bg-primary active:bg-primary-700 transition-colors flex items-center justify-center gap-1"
        :disabled="submitting"
        @click="approve"
      >
        <Check class="w-4 h-4" />
        {{ submitting ? '处理中...' : '通过' }}
      </button>
    </div>
  </div>

  <div v-else class="page-container flex items-center justify-center">
    <p class="text-gray-400">项目不存在</p>
  </div>
</template>
