<script setup lang="ts">
import { useTable } from '@/hooks/common/table'
import { fetchHomeList } from '@/service/api/home'
import StatCard from '@/components/custom/stat-card.vue'
import BadgeDot from '@/components/custom/badge-dot.vue'
import RowActions from '@/components/custom/row-actions.vue'

const { columns, data } = useTable({
  apiFn: fetchHomeList,
  columns: () => [
    { key: 'name', title: '名称' }
  ]
})

// 展开传参：检查器必须判为「无法判定」，而不是挨个报 prop 没人传
const rowProps = { rowId: 1, extra: 'x' }
</script>

<template>
  <div class="flex flex-col gap-16px">
    <StatCard label="总览" />
    <!-- 裸属性 + 短横线写法，两种都必须认成「传了值」 -->
    <BadgeDot label="在线" active />
    <BadgeDot label="离线" :active="false" />
    <RowActions v-bind="rowProps" />
    <NDataTable :columns="columns" :data="data" />
  </div>
</template>
