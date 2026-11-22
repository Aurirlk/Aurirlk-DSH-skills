<script setup lang="tsx">
import { useTable } from '@/hooks/common/table'
import { fetchDemoList } from '@/service/api/demo'

const { columns, data, getData } = useTable({
  apiFn: fetchDemoList,
  columns: [
    { key: 'name', title: '名称' },
    { key: 'status', title: '状态' }
  ]
})
</script>

<template>
  <NDataTable :columns="columns" :data="data" />
</template>
