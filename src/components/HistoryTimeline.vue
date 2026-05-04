<script setup lang="ts">
import { ref } from 'vue'
import type { HistoryRecord } from '@/utils/constants'
import { ROLE_CONFIG } from '@/utils/constants'
import { formatDateTime } from '@/utils/week'
import { ChevronDown, ChevronUp } from 'lucide-vue-next'

const props = defineProps<{
  records: HistoryRecord[]
}>()

const expanded = ref(false)

function toggleExpand() {
  expanded.value = !expanded.value
}
</script>

<template>
  <div class="mt-2">
    <button
      class="flex items-center gap-1 text-xs text-primary font-medium"
      @click="toggleExpand"
    >
      {{ expanded ? '收起历史' : '查看历史' }}
      <component :is="expanded ? ChevronUp : ChevronDown" class="w-3.5 h-3.5" />
    </button>

    <div v-if="expanded" class="mt-2 space-y-2">
      <div
        v-for="record in records"
        :key="record.record_id"
        class="flex gap-3 text-xs"
      >
        <div class="flex flex-col items-center">
          <div class="w-2 h-2 rounded-full bg-primary mt-1" />
          <div class="w-px flex-1 bg-gray-200" />
        </div>
        <div class="pb-3">
          <div class="flex items-center gap-2">
            <span class="font-medium text-gray-700">
              {{ ROLE_CONFIG[record.operator_role]?.label || record.operator_role }}
            </span>
            <span class="text-gray-400">{{ formatDateTime(record.operated_at) }}</span>
          </div>
          <div class="mt-1 text-gray-500">
            <span class="text-gray-400">{{ record.field_name }}：</span>
            <span class="line-through text-gray-300">{{ record.old_value || '空' }}</span>
            <span class="mx-1">→</span>
            <span class="text-gray-700">{{ record.new_value }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
