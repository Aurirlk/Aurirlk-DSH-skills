<script lang="ts" setup>
interface Props {
  label: string
  // frontend-health-ignore  这个 prop 由外部插件用 v-bind 展开传，静态看不出来
  extra?: string
}

defineProps<Props>()
</script>

<template>
  <span>{{ label }}</span>
</template>
