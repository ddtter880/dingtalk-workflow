<script setup lang="ts">
import { computed } from 'vue'
import { URGENCY_CONFIG } from '@/utils/constants'

const props = defineProps<{
  level: string
  size?: 'sm' | 'md'
}>()

const config = computed(() => URGENCY_CONFIG[props.level] || URGENCY_CONFIG.normal)
const sizeClass = computed(() => props.size === 'sm' ? 'w-2 h-2' : 'w-3 h-3')
</script>

<template>
  <div class="inline-flex items-center gap-1.5">
    <span :class="sizeClass" class="rounded-full" :style="{ backgroundColor: config.color }" />
    <span class="text-xs font-medium" :style="{ color: config.color }">{{ config.label }}</span>
  </div>
</template>
