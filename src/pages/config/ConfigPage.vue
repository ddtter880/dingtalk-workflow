<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getPersonnelConfigs, savePersonnelConfig, getSystemConfig, saveSystemConfig } from '@/utils/sheet'
import type { PersonnelConfig, SystemConfig } from '@/utils/constants'
import { ArrowLeft, Save, Plus, Users } from 'lucide-vue-next'

const router = useRouter()

const personnelList = ref<PersonnelConfig[]>([])
const systemConfig = ref<SystemConfig>(getSystemConfig())
const showAddPersonnel = ref(false)
const newPersonnel = ref<PersonnelConfig>({
  project_id: '',
  project_manager: '',
  dept_head: '',
  leader: '',
  safety_officer: '',
})

onMounted(() => {
  personnelList.value = getPersonnelConfigs()
})

function goBack() { router.back() }

function saveNewPersonnel() {
  if (!newPersonnel.value.project_id) return
  savePersonnelConfig(newPersonnel.value)
  personnelList.value = getPersonnelConfigs()
  showAddPersonnel.value = false
  newPersonnel.value = { project_id: '', project_manager: '', dept_head: '', leader: '', safety_officer: '' }
}

function saveConfig() {
  saveSystemConfig(systemConfig.value)
  alert('配置已保存')
}
</script>

<template>
  <div class="page-container pb-8">
    <div class="nav-bar">
      <div class="nav-bar-content">
        <button @click="goBack" class="flex items-center gap-1 text-primary">
          <ArrowLeft class="w-5 h-5" /><span class="text-sm">返回</span>
        </button>
        <h2 class="text-base font-semibold text-gray-900">系统配置</h2>
        <div class="w-16" />
      </div>
    </div>

    <div class="pt-14 px-4 space-y-3 mt-2">
      <!-- 人员配置 -->
      <div class="card">
        <div class="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
          <h3 class="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <Users class="w-4 h-4 text-primary" /> 项目人员配置
          </h3>
          <button @click="showAddPersonnel = !showAddPersonnel" class="text-primary text-xs font-medium flex items-center gap-1">
            <Plus class="w-3.5 h-3.5" /> 新增
          </button>
        </div>

        <!-- 新增人员表单 -->
        <div v-if="showAddPersonnel" class="mb-3 p-3 bg-gray-50 rounded-lg space-y-2">
          <input v-model="newPersonnel.project_id" class="input-field" placeholder="项目ID" />
          <input v-model="newPersonnel.project_manager" class="input-field" placeholder="项目负责人" />
          <input v-model="newPersonnel.dept_head" class="input-field" placeholder="室所主任" />
          <input v-model="newPersonnel.leader" class="input-field" placeholder="分管领导" />
          <input v-model="newPersonnel.safety_officer" class="input-field" placeholder="质量安全人员" />
          <button @click="saveNewPersonnel" class="btn-primary text-sm w-full">保存</button>
        </div>

        <!-- 人员列表 -->
        <div class="space-y-2">
          <div v-for="p in personnelList" :key="p.project_id" class="p-3 bg-gray-50 rounded-lg">
            <div class="text-sm font-medium text-gray-800">{{ p.project_id }}</div>
            <div class="grid grid-cols-2 gap-1 mt-1 text-xs text-gray-500">
              <span>负责人：{{ p.project_manager || '-' }}</span>
              <span>室所主任：{{ p.dept_head || '-' }}</span>
              <span>分管领导：{{ p.leader || '-' }}</span>
              <span>质安人员：{{ p.safety_officer || '-' }}</span>
            </div>
          </div>
          <div v-if="personnelList.length === 0" class="text-center text-gray-400 text-sm py-4">暂无配置</div>
        </div>
      </div>

      <!-- 垃圾箱设置 -->
      <div class="card">
        <h3 class="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">垃圾箱设置</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-sm text-gray-500 mb-1">自动删除周期（天）</label>
            <div class="flex gap-2">
              <button v-for="d in [7, 15, 30, 60]" :key="d"
                class="flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all"
                :class="systemConfig.auto_delete_days === d ? 'border-primary text-primary bg-primary-50' : 'border-gray-100 text-gray-500'"
                @click="systemConfig.auto_delete_days = d">
                {{ d }}天
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 机器人配置 -->
      <div class="card">
        <h3 class="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">机器人配置</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-sm text-gray-500 mb-1">Webhook地址</label>
            <input v-model="systemConfig.robot_webhook" class="input-field" placeholder="https://oapi.dingtalk.com/robot/send?access_token=..." />
          </div>
          <div>
            <label class="block text-sm text-gray-500 mb-1">提醒时间</label>
            <input v-model="systemConfig.remind_schedule" class="input-field" placeholder="周一 09:00" />
          </div>
        </div>
      </div>

      <!-- 保存按钮 -->
      <button @click="saveConfig" class="btn-primary w-full flex items-center justify-center gap-2">
        <Save class="w-4 h-4" /> 保存配置
      </button>
    </div>
  </div>
</template>
