<script setup lang="ts">
import { computed } from 'vue'
import { STATUS_CONFIG } from '@/utils/constants'

const props = defineProps<{
  status: string
}>()

const config = computed(() => STATUS_CONFIG[props.status] || STATUS_CONFIG.processing)
</script>

<template>
  <span
    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
    :style="{
      color: config.color,
      backgroundColor: config.bgColor,
    }"
  >
    {{ config.label }}
  </span>
</template>
