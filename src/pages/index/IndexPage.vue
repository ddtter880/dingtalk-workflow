<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '@/store/project'
import { useUserStore } from '@/store/user'
import { ProjectStatus } from '@/utils/constants'
import ProjectCard from '@/components/ProjectCard.vue'
import { autoCleanRecycleBin, shouldSendWeeklyReminder, getProjectsNeedingAttention, markReminderSent } from '@/utils/sheet-api'
import { sendWorkNotification } from '@/utils/dingtalk'
import { Plus, Trash2, Settings, FileText, BarChart3, Loader2, RefreshCw, CheckCircle2 } from 'lucide-vue-next'

const router = useRouter()
const projectStore = useProjectStore()
const userStore = useUserStore()

const isLoading = ref(true)

const tabs = [
  { label: '全部', value: 'all' },
  { label: '新增', value: ProjectStatus.NEW },
  { label: '待处理', value: ProjectStatus.PROCESSING },
  { label: '待销项', value: ProjectStatus.PENDING_CLOSE },
  { label: '已销项', value: ProjectStatus.CLOSED },
]

const syncStatusText = computed(() => {
  switch (projectStore.syncStatus) {
    case 'syncing': return '同步中...'
    case 'synced': return '已同步'
    case 'error': return '同步失败'
    default: return ''
  }
})

onMounted(async () => {
  try {
    await userStore.login()
    await projectStore.loadProjects()

    // 自动清理过期垃圾箱项目
    const cleaned = autoCleanRecycleBin()
    if (cleaned > 0) {
      console.log(`[App] 自动清理了 ${cleaned} 个过期项目`)
    }

    // 周一提醒：通知有待处理项目的负责人
    if (shouldSendWeeklyReminder()) {
      const pending = getProjectsNeedingAttention()
      if (pending.length > 0 && userStore.userInfo?.userid) {
        try {
          await sendWorkNotification({
            userid_list: userStore.userInfo.userid,
            content: `本周有 ${pending.length} 个待处理工作事项，请及时查看处理。`,
            msgtype: 'text',
          })
          markReminderSent()
        } catch (e) {
          console.warn('[App] 周提醒发送失败:', e)
        }
      }
    }
  } finally {
    isLoading.value = false
  }
})

async function refresh() {
  isLoading.value = true
  try {
    await projectStore.loadProjects()
  } finally {
    isLoading.value = false
  }
}

function goDetail(id: string) {
  router.push(`/detail/${id}`)
}

function goCreate() {
  router.push('/form')
}

function goConfig() {
  router.push('/config')
}

function goRecycle() {
  router.push('/recycle')
}

function goAdmin() {
  router.push('/admin')
}
</script>

<template>
  <div class="page-container pb-20">
    <!-- 顶部导航 -->
    <div class="nav-bar">
      <div class="nav-bar-content">
        <div class="flex items-center gap-2">
          <FileText class="w-5 h-5 text-primary" />
          <h1 class="text-lg font-semibold text-gray-900">工作事项管理</h1>
        </div>
        <div class="flex items-center gap-3">
          <button v-if="userStore.isAdmin" @click="goAdmin" class="p-1.5 rounded-lg hover:bg-gray-100">
            <BarChart3 class="w-5 h-5 text-primary" />
          </button>
          <button @click="goRecycle" class="p-1.5 rounded-lg hover:bg-gray-100">
            <Trash2 class="w-5 h-5 text-gray-400" />
          </button>
          <button v-if="userStore.isAdmin" @click="goConfig" class="p-1.5 rounded-lg hover:bg-gray-100">
            <Settings class="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>
    </div>

    <div class="pt-14">
      <!-- 用户信息 + 同步状态 -->
      <div class="mx-4 mt-3 flex items-center justify-between">
        <div class="text-sm text-gray-500">
          <span v-if="userStore.isLoggedIn">{{ userStore.userInfo?.name }}</span>
          <span v-else class="text-amber-500">未登录</span>
        </div>
        <div class="flex items-center gap-2">
          <span v-if="syncStatusText" class="text-xs flex items-center gap-1"
            :class="projectStore.syncStatus === 'error' ? 'text-red-400' : 'text-green-500'">
            <CheckCircle2 v-if="projectStore.syncStatus === 'synced'" class="w-3 h-3" />
            <RefreshCw v-else-if="projectStore.syncStatus === 'syncing'" class="w-3 h-3 animate-spin" />
            {{ syncStatusText }}
          </span>
          <button @click="refresh" class="p-1 rounded hover:bg-gray-100" :disabled="isLoading">
            <RefreshCw class="w-4 h-4 text-gray-400" :class="{ 'animate-spin': isLoading }" />
          </button>
        </div>
      </div>

      <!-- 统计概览 -->
      <div class="mx-4 mt-2 flex gap-2">
        <div class="flex-1 bg-blue-50 rounded-lg p-3 text-center">
          <div class="text-xl font-bold text-primary">{{ projectStore.stats.new }}</div>
          <div class="text-xs text-blue-600 mt-0.5">新增</div>
        </div>
        <div class="flex-1 bg-amber-50 rounded-lg p-3 text-center">
          <div class="text-xl font-bold text-amber-600">{{ projectStore.stats.processing }}</div>
          <div class="text-xs text-amber-600 mt-0.5">待处理</div>
        </div>
        <div class="flex-1 bg-pink-50 rounded-lg p-3 text-center">
          <div class="text-xl font-bold text-pink-600">{{ projectStore.stats.pending_close }}</div>
          <div class="text-xs text-pink-600 mt-0.5">待销项</div>
        </div>
        <div class="flex-1 bg-green-50 rounded-lg p-3 text-center">
          <div class="text-xl font-bold text-green-600">{{ projectStore.stats.closed }}</div>
          <div class="text-xs text-green-600 mt-0.5">已销项</div>
        </div>
      </div>

      <!-- 状态标签栏 -->
      <div class="mx-4 mt-3 flex bg-gray-100 rounded-lg p-1">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          class="flex-1 py-2 text-sm font-medium rounded-md transition-all"
          :class="projectStore.activeFilter === tab.value
            ? 'bg-white text-primary shadow-sm'
            : 'text-gray-500'"
          @click="projectStore.setFilter(tab.value)"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- 加载状态 -->
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-16">
        <Loader2 class="w-8 h-8 text-primary animate-spin" />
        <p class="text-gray-400 mt-3 text-sm">加载中...</p>
      </div>

      <!-- 项目列表 -->
      <div v-else class="mx-4 mt-3 space-y-3">
        <ProjectCard
          v-for="project in projectStore.filteredProjects"
          :key="project.project_id"
          :project="project"
          @click="goDetail(project.project_id)"
        />

        <div v-if="projectStore.filteredProjects.length === 0" class="text-center py-12">
          <FileText class="w-12 h-12 text-gray-300 mx-auto" />
          <p class="text-gray-400 mt-3 text-sm">暂无工作事项</p>
          <button @click="goCreate" class="mt-3 text-sm text-primary hover:underline">
            创建第一个工作事项
          </button>
        </div>
      </div>
    </div>

    <!-- 新建按钮 -->
    <button
      class="fixed right-5 bottom-24 w-14 h-14 bg-primary rounded-full shadow-lg shadow-primary/30 flex items-center justify-center active:scale-95 transition-transform"
      @click="goCreate"
    >
      <Plus class="w-7 h-7 text-white" />
    </button>
  </div>
</template>
