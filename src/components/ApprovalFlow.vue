<script setup lang="ts">
import { UserRole, ROLE_CONFIG } from '@/utils/constants'
import { Check, Circle, Clock } from 'lucide-vue-next'

const props = defineProps<{
  currentRole: string
  completedRoles: string[]
}>()

const flowNodes = [
  UserRole.PROJECT_MANAGER,
  UserRole.DEPT_HEAD,
  UserRole.LEADER,
  UserRole.SAFETY,
]

function getNodeStatus(role: string): 'completed' | 'current' | 'pending' {
  if (props.completedRoles.includes(role)) return 'completed'
  if (role === props.currentRole) return 'current'
  return 'pending'
}
</script>

<template>
  <div class="flex items-center justify-between px-2">
    <div v-for="(role, index) in flowNodes" :key="role" class="flex items-center flex-1">
      <!-- 节点 -->
      <div class="flex flex-col items-center">
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center transition-all"
          :class="{
            'bg-primary text-white': getNodeStatus(role) === 'completed' || getNodeStatus(role) === 'current',
            'bg-gray-200 text-gray-400': getNodeStatus(role) === 'pending',
          }"
        >
          <Check v-if="getNodeStatus(role) === 'completed'" class="w-4 h-4" />
          <Clock v-else-if="getNodeStatus(role) === 'current'" class="w-4 h-4" />
          <Circle v-else class="w-3 h-3" />
        </div>
        <span class="text-[10px] mt-1 text-gray-500 whitespace-nowrap">
          {{ ROLE_CONFIG[role]?.label || role }}
        </span>
      </div>

      <!-- 连接线 -->
      <div
        v-if="index < flowNodes.length - 1"
        class="flex-1 h-0.5 mx-1"
        :class="{
          'bg-primary': getNodeStatus(role) === 'completed',
          'bg-gray-200': getNodeStatus(role) !== 'completed',
        }"
      />
    </div>
  </div>
</template>
