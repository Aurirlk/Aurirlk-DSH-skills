<script setup lang="ts">
// 这个组件故意用「展开传参」，用来证明检查器不会把它的 prop 误报成没人传
interface Props {
  rowId: number
  extra: string
}

defineProps<Props>()
</script>

<template>
  <NButton>{{ rowId }}</NButton>
</template>
