<script setup lang="ts">
import UserPicker from '@/components/custom/user-picker.vue'
import IgnoredPanel from '@/components/custom/ignored-panel.vue'

const value = ref('')
</script>

<template>
  <!-- title 传了；size 全仓没人传；modelValue 由 v-model 传 -->
  <UserPicker v-model="value" title="选择用户" />
    <IgnoredPanel label="说明" />
</template>
