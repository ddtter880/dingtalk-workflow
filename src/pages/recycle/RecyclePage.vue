<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getRecycleBinItems, restoreProject, permanentDelete } from '@/utils/sheet-api'
import type { RecycleBinItem } from '@/utils/constants'
import { formatDateTime } from '@/utils/week'
import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-vue-next'

const router = useRouter()
const recycleItems = ref<RecycleBinItem[]>([])

onMounted(() => {
  loadItems()
})

function loadItems() {
  recycleItems.value = getRecycleBinItems()
}

function goBack() { router.back() }

async function handleRestore(id: string) {
  if (!confirm('确认恢复此项目？')) return
  await restoreProject(id)
  loadItems()
}

async function handlePermanentDelete(id: string) {
  if (!confirm('⚠️ 此操作不可恢复！确认永久删除？')) return
  await permanentDelete(id)
  loadItems()
}
</script>

<template>
  <div class="page-container">
    <div class="nav-bar">
      <div class="nav-bar-content">
        <button @click="goBack" class="flex items-center gap-1 text-primary">
          <ArrowLeft class="w-5 h-5" /><span class="text-sm">返回</span>
        </button>
        <h2 class="text-base font-semibold text-gray-900">垃圾箱</h2>
        <div class="w-16" />
      </div>
    </div>

    <div class="pt-14 px-4 space-y-3 mt-2">
      <div v-if="recycleItems.length === 0" class="text-center py-16">
        <Trash2 class="w-12 h-12 text-gray-300 mx-auto" />
        <p class="text-gray-400 mt-3 text-sm">垃圾箱为空</p>
      </div>

      <div
        v-for="item in recycleItems"
        :key="item.project_id"
        class="bg-white rounded-xl p-4 shadow-sm border-l-[3px] border-gray-300"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <h3 class="text-sm font-semibold text-gray-700">{{ item.work_name || item.project_id }}</h3>
            <div class="flex items-center gap-3 mt-1 text-xs text-gray-400">
              <span>销项人：{{ item.closed_by }}</span>
              <span>销项时间：{{ formatDateTime(item.closed_at) }}</span>
            </div>
          </div>
        </div>

        <div class="flex gap-2 mt-3">
          <button
            @click="handleRestore(item.project_id)"
            class="flex-1 py-2 rounded-lg text-primary text-xs font-medium border border-primary flex items-center justify-center gap-1 active:bg-primary-50 transition-colors"
          >
            <RotateCcw class="w-3.5 h-3.5" /> 恢复
          </button>
          <button
            @click="handlePermanentDelete(item.project_id)"
            class="flex-1 py-2 rounded-lg text-red-500 text-xs font-medium border border-red-300 flex items-center justify-center gap-1 active:bg-red-50 transition-colors"
          >
            <Trash2 class="w-3.5 h-3.5" /> 永久删除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
