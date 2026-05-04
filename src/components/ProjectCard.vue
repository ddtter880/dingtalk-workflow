<script setup lang="ts">
import type { Project } from '@/utils/constants'
import { URGENCY_CONFIG } from '@/utils/constants'
import StatusTag from './StatusTag.vue'
import PriorityBadge from './PriorityBadge.vue'
import { formatDate, getDeadlineStatus } from '@/utils/week'
import { Clock, AlertTriangle } from 'lucide-vue-next'

const props = defineProps<{
  project: Project
}>()

const urgencyConfig = URGENCY_CONFIG[props.project.urgency_level] || URGENCY_CONFIG.normal
const deadlineStatus = getDeadlineStatus(props.project.plan_finish_date)
</script>

<template>
  <div
    class="bg-white rounded-xl p-4 shadow-sm border-l-[3px] transition-all active:scale-[0.98] cursor-pointer"
    :style="{ borderLeftColor: urgencyConfig.borderColor }"
  >
    <!-- 头部：项目名 + 状态标签 -->
    <div class="flex items-start justify-between gap-2">
      <h3 class="text-[15px] font-semibold text-gray-900 leading-snug line-clamp-2">
        {{ project.work_name }}
      </h3>
      <StatusTag :status="project.category" />
    </div>

    <!-- 优先级 + 负责人 -->
    <div class="flex items-center gap-3 mt-2">
      <PriorityBadge :level="project.urgency_level" size="sm" />
      <span class="text-xs text-gray-500">{{ project.responsible_person }}</span>
    </div>

    <!-- 进展摘要 -->
    <p v-if="project.progress" class="mt-2 text-[13px] text-gray-600 leading-relaxed line-clamp-2">
      {{ project.progress }}
    </p>

    <!-- 底部：截止日期 -->
    <div class="flex items-center justify-between mt-3 pt-2 border-t border-gray-50">
      <div class="flex items-center gap-1">
        <Clock class="w-3.5 h-3.5" :class="deadlineStatus === 'overdue' ? 'text-red-500' : 'text-gray-400'" />
        <span
          class="text-xs"
          :class="{
            'text-red-500 font-medium': deadlineStatus === 'overdue',
            'text-orange-500': deadlineStatus === 'urgent',
            'text-gray-400': deadlineStatus === 'normal',
          }"
        >
          {{ project.plan_finish_date ? formatDate(project.plan_finish_date) : '无截止日期' }}
        </span>
      </div>
      <div v-if="project.risk_impact" class="flex items-center gap-1">
        <AlertTriangle class="w-3.5 h-3.5 text-orange-400" />
        <span class="text-xs text-orange-400">有风险</span>
      </div>
    </div>
  </div>
</template>
