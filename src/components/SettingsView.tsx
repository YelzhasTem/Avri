import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  GEMINI_MODELS,
  type ConnectionStatus,
} from '../services/ai'
import { GEMINI_API_KEY_URL } from '../services/links'
import type { AISettingsSummary } from '../services/settings'

interface SettingsViewProps {
  onSettingsChange(settings: AISettingsSummary): void
}

function getStatusLabel(status: ConnectionStatus): string {
  switch (status) {
    case 'testing':
      return 'Testing connection…'
    case 'connected':
      return 'Connected to Gemini'
    case 'error':
      return 'Connection failed'
    default:
      return 'Not tested'
  }
}

export function SettingsView({ onSettingsChange }: SettingsViewProps) {
  const [settings, setSettings] = useState<AISettingsSummary | null>(null)
  const [model, setModel] = useState<string>(GEMINI_MODELS[0].id)
  const [apiKey, setApiKey] = useState('')
  const [status, setStatus] = useState<ConnectionStatus>('not-tested')
  const [message, setMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    void window.avri.settings.get().then((current) => {
      setSettings(current)
      setModel(current.model)
      onSettingsChange(current)
    })
  }, [onSettingsChange])

  const updateSettings = (next: AISettingsSummary) => {
    setSettings(next)
    setModel(next.model)
    setApiKey('')
    onSettingsChange(next)
  }

  const save = async () => {
    setIsSaving(true)
    setMessage(null)

    try {
      const next = await window.avri.settings.update({
        model,
        apiKey: apiKey.trim() || undefined,
      })
      updateSettings(next)
      setMessage('Settings saved.')
    } catch {
      setMessage('Avri could not save these settings.')
    } finally {
      setIsSaving(false)
    }
  }

  const clearOverride = async () => {
    setIsSaving(true)
    setMessage(null)

    try {
      const next = await window.avri.settings.update({
        model,
        clearApiKey: true,
      })
      updateSettings(next)
      setStatus('not-tested')
      setMessage(
        next.hasEnvironmentApiKey
          ? 'Using the environment API key.'
          : 'Saved API key removed.',
      )
    } catch {
      setMessage('Avri could not remove the saved API key.')
    } finally {
      setIsSaving(false)
    }
  }

  const testConnection = async () => {
    setStatus('testing')
    setMessage(null)

    try {
      const result = await window.avri.settings.test({
        model,
        apiKey: apiKey.trim() || undefined,
      })
      setStatus(result.ok ? 'connected' : 'error')
      setMessage(result.error?.message ?? null)
    } catch {
      setStatus('error')
      setMessage('Avri could not complete the connection test.')
    }
  }

  const hasAvailableKey = Boolean(
    apiKey.trim() || settings?.hasUserApiKey || settings?.hasEnvironmentApiKey,
  )

  return (
    <main className="avri-view-scroll min-h-0 flex-1 overflow-y-auto px-8 py-10 max-[760px]:px-5">
      <div className="avri-enter mx-auto w-full max-w-[680px]">
        <div className="mb-8">
          <h2 className="text-[24px] font-[550] tracking-[-0.03em]">AI Settings</h2>
          <p className="avri-secondary mt-2 text-[13.5px]">
            Configure the Gemini connection used by Avri.
          </p>
        </div>

        <div className="avri-settings-panel rounded-[16px] p-5 max-[760px]:p-4">
          <div className="space-y-6">
            <div>
              <label htmlFor="gemini-api-key" className="block text-[12.5px] font-[550]">
                Gemini API Key
              </label>
              <p className="avri-secondary mb-2.5 mt-1 text-[11.5px] leading-5">
                Stored encrypted on this computer and used only for requests to
                Gemini.{' '}
                <a
                  href={GEMINI_API_KEY_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="avri-link"
                >
                  Get a free key in Google AI Studio
                </a>
              </p>
              <input
                id="gemini-api-key"
                type="password"
                value={apiKey}
                autoComplete="off"
                spellCheck={false}
                placeholder={
                  settings?.hasUserApiKey
                    ? 'Saved override ••••••••'
                    : settings?.hasEnvironmentApiKey
                      ? 'Using environment key'
                      : 'Enter a Gemini API key'
                }
                className="avri-field w-full rounded-[12px] px-3.5 py-3 text-[13.5px] outline-none"
                onChange={(event) => {
                  setApiKey(event.target.value)
                  setStatus('not-tested')
                }}
              />
            </div>

            <div>
              <label htmlFor="gemini-model" className="block text-[12.5px] font-[550]">
                Model
              </label>
              <select
                id="gemini-model"
                value={model}
                className="avri-field mt-2.5 w-full rounded-[12px] px-3.5 py-3 text-[13.5px] outline-none"
                onChange={(event) => {
                  setModel(event.target.value)
                  setStatus('not-tested')
                }}
              >
                {GEMINI_MODELS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="avri-settings-divider" />

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-2.5">
                {status === 'testing' ? (
                  <LoaderCircle className="avri-spin avri-secondary" size={16} aria-hidden="true" />
                ) : status === 'connected' ? (
                  <CircleCheck className="avri-status-success" size={16} aria-hidden="true" />
                ) : status === 'error' ? (
                  <CircleX className="avri-status-error" size={16} aria-hidden="true" />
                ) : (
                  <span className="avri-status-dot" aria-hidden="true" />
                )}
                <span className="text-[12.5px] font-[500]">{getStatusLabel(status)}</span>
              </div>

              <div className="flex items-center gap-2">
                {settings?.hasUserApiKey && (
                  <button
                    type="button"
                    disabled={isSaving || status === 'testing'}
                    className="avri-secondary-button rounded-[10px] px-3.5 py-2 text-[12px] font-[550]"
                    onClick={() => void clearOverride()}
                  >
                    Use environment key
                  </button>
                )}
                <button
                  type="button"
                  disabled={!hasAvailableKey || status === 'testing'}
                  className="avri-secondary-button rounded-[10px] px-3.5 py-2 text-[12px] font-[550]"
                  onClick={() => void testConnection()}
                >
                  Test Connection
                </button>
                <button
                  type="button"
                  disabled={isSaving || status === 'testing'}
                  className="avri-primary-button rounded-[10px] px-3.5 py-2 text-[12px] font-[550]"
                  onClick={() => void save()}
                >
                  {isSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            {message && (
              <p
                className={`text-[12px] leading-5 ${status === 'error' ? 'avri-status-error' : 'avri-secondary'}`}
                role={status === 'error' ? 'alert' : 'status'}
              >
                {message}
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
