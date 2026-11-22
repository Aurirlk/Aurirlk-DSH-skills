<script setup lang="ts">
interface Props {
  modelValue?: string
  title: string
  size?: 'sm' | 'md'
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  size: 'md'
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <NInput :value="props.modelValue" @update:value="emit('update:modelValue', $event)" />
</template>
