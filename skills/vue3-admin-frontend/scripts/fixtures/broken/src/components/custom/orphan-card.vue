<script setup lang="ts">
interface Props {
  heading: string
}

defineProps<Props>()
</script>

<template>
  <NCard>{{ heading }}</NCard>
</template>
