<script setup lang="tsx">
import { useTable } from '@/hooks/common/table'
import { fetchDemoList } from '@/service/api/demo'

const { columns, data } = useTable({
  apiFn: fetchDemoList,
  // frontend-health-ignore  这份列配置被外部注入后不会变，确认过是故意的
  columns: [
    { key: 'name', title: '名称' }
  ]
})
</script>

<template>
  <NDataTable :columns="columns" :data="data" />
</template>
