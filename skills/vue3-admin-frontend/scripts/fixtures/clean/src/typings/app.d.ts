declare namespace I18n {
  interface Schema {
    route: {
      home: string
    }
    common: {
      confirm: string
    }
    status: Record<'online' | 'offline', string>
  }
}
