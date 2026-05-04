<script setup lang="ts">
import { onMounted } from 'vue'
import { initDingTalk } from './utils/dingtalk'

onMounted(async () => {
  await initDingTalk()
})
</script>

<template>
  <router-view />
</template>
