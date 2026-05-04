import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Project } from '@/utils/constants'
import { ProjectStatus } from '@/utils/constants'
import {
  getProjects,
  createProject as createProjectApi,
  updateProject as updateProjectApi,
  deleteProject as deleteProjectApi,
  initMockData,
  syncFromSheet,
} from '@/utils/sheet-api'

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const loading = ref(false)
  const activeFilter = ref<string>('all')
  const syncStatus = ref<'idle' | 'syncing' | 'synced' | 'error'>('idle')

  // 按状态筛选
  const filteredProjects = computed(() => {
    if (activeFilter.value === 'all') return projects.value
    return projects.value.filter(p => p.category === activeFilter.value)
  })

  // 统计数据
  const stats = computed(() => ({
    new: projects.value.filter(p => p.category === ProjectStatus.NEW).length,
    processing: projects.value.filter(p => p.category === ProjectStatus.PROCESSING).length,
    pending_close: projects.value.filter(p => p.category === ProjectStatus.PENDING_CLOSE).length,
    closed: projects.value.filter(p => p.category === ProjectStatus.CLOSED).length,
    total: projects.value.length,
  }))

  // 加载项目列表（支持从在线表格同步）
  async function loadProjects() {
    loading.value = true
    try {
      initMockData() // 确保示例数据存在

      // 尝试从在线表格同步数据
      syncStatus.value = 'syncing'
      try {
        await syncFromSheet()
        syncStatus.value = 'synced'
      } catch {
        syncStatus.value = 'error'
      }

      projects.value = getProjects()
    } finally {
      loading.value = false
    }
  }

  // 创建项目
  async function addProject(data: Omit<Project, 'project_id' | 'updated_at'>) {
    const project = createProjectApi(data)
    projects.value.push(project)
    return project
  }

  // 更新项目
  async function editProject(id: string, data: Partial<Project>) {
    const updated = updateProjectApi(id, data)
    if (updated) {
      const index = projects.value.findIndex(p => p.project_id === id)
      if (index >= 0) projects.value[index] = updated
    }
    return updated
  }

  // 删除项目（移入垃圾箱）
  async function removeProject(id: string) {
    const success = deleteProjectApi(id)
    if (success) {
      projects.value = projects.value.filter(p => p.project_id !== id)
    }
    return success
  }

  // 设置筛选
  function setFilter(filter: string) {
    activeFilter.value = filter
  }

  return {
    projects,
    loading,
    activeFilter,
    filteredProjects,
    stats,
    syncStatus,
    loadProjects,
    addProject,
    editProject,
    removeProject,
    setFilter,
  }
})
