export interface AISettingsSummary {
  model: string
  hasUserApiKey: boolean
  hasEnvironmentApiKey: boolean
}

export interface UpdateAISettingsInput {
  model: string
  apiKey?: string
  clearApiKey?: boolean
}

export interface TestConnectionInput {
  model: string
  apiKey?: string
}

