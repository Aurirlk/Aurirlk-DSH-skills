<script setup lang="tsx">
import { useTable } from '@/hooks/common/table'
import { fetchDemoList } from '@/service/api/demo'

const { columns, data } = useTable({
  apiFn: fetchDemoList,
  columns: () => [
    { key: 'name', title: '名称' }
  ]
})
</script>

<template>
  <NDataTable :columns="columns" :data="data" />
</template>
