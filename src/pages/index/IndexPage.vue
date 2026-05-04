<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '@/store/project'
import { useUserStore } from '@/store/user'
import { ProjectStatus } from '@/utils/constants'
import ProjectCard from '@/components/ProjectCard.vue'
import { Plus, Trash2, Settings, FileText, BarChart3 } from 'lucide-vue-next'

const router = useRouter()
const projectStore = useProjectStore()
const userStore = useUserStore()

const tabs = [
  { label: '全部', value: 'all' },
  { label: '新增', value: ProjectStatus.NEW },
  { label: '待处理', value: ProjectStatus.PROCESSING },
  { label: '待销项', value: ProjectStatus.PENDING_CLOSE },
]

onMounted(async () => {
  await userStore.login()
  await projectStore.loadProjects()
})

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
      <!-- 统计概览 -->
      <div class="mx-4 mt-3 flex gap-2">
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

      <!-- 项目列表 -->
      <div class="mx-4 mt-3 space-y-3">
        <ProjectCard
          v-for="project in projectStore.filteredProjects"
          :key="project.project_id"
          :project="project"
          @click="goDetail(project.project_id)"
        />

        <div v-if="projectStore.filteredProjects.length === 0" class="text-center py-12">
          <FileText class="w-12 h-12 text-gray-300 mx-auto" />
          <p class="text-gray-400 mt-3 text-sm">暂无工作事项</p>
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
