<script setup lang="ts">
interface Props {
  label: string
  active?: boolean
}

defineProps<Props>()
</script>

<template>
  <span :class="active ? 'dot-on' : 'dot-off'">{{ label }}</span>
</template>
