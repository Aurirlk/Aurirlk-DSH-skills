<script setup lang="ts">
interface Props {
  label: string
}

defineProps<Props>()
</script>

<template>
  <NCard>{{ label }}</NCard>
</template>
