import { clearSave, downloadText, importSave, unreadableBackup, type AutoSaver } from '../game/save'
import { SaveSystem } from '../game/SaveSystem'
import { SETTING_LABELS, type SettingsStore, type SwitchSetting } from '../game/settings'
import { el } from './dom'
import { Sheet, button } from './Sheet'

// The Settings sheet: switches, sound volume, the save (save now, export,
// import, the unreadable backup), credits and starting over. It only sends
// choices to the settings store and the saver; Game applies what they mean.
export class SettingsPanel {
  private container: HTMLElement
  private settings: SettingsStore
  private saver: AutoSaver
  private toast: (message: string, kind?: 'info' | 'warn') => void
  private sheet: Sheet | null = null

  constructor(container: HTMLElement, settings: SettingsStore, saver: AutoSaver, toast: (message: string, kind?: 'info' | 'warn') => void) {
    this.container = container
    this.settings = settings
    this.saver = saver
    this.toast = toast
  }

  // Built the first time it opens, so the backup button reflects the current state.
  open() {
    this.sheet ??= this.build()
    this.sheet.open()
  }

  private build(): Sheet {
    const sheet = new Sheet(this.container, '⚙️ Settings')
    for (const key of Object.keys(SETTING_LABELS) as SwitchSetting[]) {
      const row = el('label', 'setting-row')
      const box = el('input', '')
      box.type = 'checkbox'
      box.addEventListener('change', () => this.settings.set(key, box.checked))
      this.settings.onChange((s) => (box.checked = s[key]))
      row.append(el('span', '', SETTING_LABELS[key]), box)
      sheet.body.append(row)
    }
    // Volume: 0 mutes; the game is fully playable without sound.
    const volumeRow = el('label', 'setting-row')
    const volume = el('input', '')
    volume.type = 'range'
    volume.min = '0'
    volume.max = '1'
    volume.step = '0.1'
    volume.setAttribute('aria-label', 'Sound volume')
    volume.addEventListener('input', () => this.settings.set('soundVolume', Number(volume.value)))
    this.settings.onChange((s) => (volume.value = String(s.soundVolume)))
    volumeRow.append(el('span', '', '🔊 Sound volume (left = mute)'), volume)
    sheet.body.append(volumeRow)

    // Saving: manual save, export and import.
    const saveNow = button('💾 Save now', () => this.toast(this.saver.saveNow() ? 'Saved.' : "Couldn't save: the browser isn't allowing it.", 'info'), 'panel-button secondary')
    const exportSave = button('⬇️ Export', () => {
      const day = new Date().toISOString().slice(0, 10)
      downloadText(`hearthvale-${day}.json`, JSON.stringify(this.saver.snapshot(), null, 2))
    }, 'panel-button secondary')
    const file = el('input', '')
    file.type = 'file'
    file.accept = 'application/json,.json'
    file.hidden = true
    file.addEventListener('change', async () => {
      const chosen = file.files?.[0]
      if (!chosen) return
      if (!confirm('Replace your current town with the imported one?')) return
      const problem = importSave(await chosen.text(), SaveSystem.canLoad)
      if (problem) this.toast(problem, 'warn')
      else {
        this.saver.disable() // don't overwrite the import on the way out
        location.reload()
      }
    })
    const importButton = button('⬆️ Import', () => file.click(), 'panel-button secondary')
    const tools = el('div', 'panel-buttons')
    tools.append(saveNow, exportSave, importButton, file)
    const backup = unreadableBackup()
    sheet.body.append(
      el('h3', 'level-subtitle', 'Your save'),
      el(
        'p',
        'muted',
        'Your town saves itself in this browser, on this device; nothing is sent anywhere. Clearing site data or private browsing deletes it, so export a copy to keep it safe.',
      ),
      tools,
      ...(backup ? [button('Download the unreadable save that was set aside', () => downloadText('hearthvale-unreadable.json', backup), 'panel-button secondary')] : []),
      el('p', 'muted', 'Models: City Kit (Suburban) by Kenney, CC0. Sounds are made by the game. Built with three.js.'),
    )
    sheet.setButtons(button('Start a new town', () => this.newTown(), 'panel-button danger'))
    return sheet
  }

  private newTown() {
    if (!confirm('Start a new town? Your current town will be deleted.')) return
    this.saver.disable()
    clearSave()
    location.reload()
  }
}
