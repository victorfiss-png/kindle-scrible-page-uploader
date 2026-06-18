import {App, PluginSettingTab, Setting } from "obsidian";
import KindleScribeNotesPlugin from "./index";

export interface ScribeNotesSettings {
	openRouterApiKey: string;
	model: string
}

export const DEFAULT_SETTINGS: ScribeNotesSettings = {
	openRouterApiKey: '',
	model: 'google/gemini-3.1-flash-lite-preview'
}

export class ScribeSettingsTab extends PluginSettingTab {
	plugin: KindleScribeNotesPlugin;

	constructor(app: App, plugin: KindleScribeNotesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Openrouter API key')
			.setDesc('Enter your openrouter API key. This is going to be stored in data.json file.') // Added period
			.addText(text => {
				text.inputEl.type = 'password';

				//eslint-disable-next-line obsidianmd/ui/sentence-case
				text.setPlaceholder('sk-or-v1-...')
					.setValue(this.plugin.settings.openRouterApiKey)
					.onChange(async (value) => {
						// Update the setting and save to data.json
						this.plugin.settings.openRouterApiKey = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Model')
			.setDesc('Enter your chosen model')
			.addText(text => {
				//eslint-disable-next-line obsidianmd/ui/sentence-case
				text.setPlaceholder('google/gemini-3-flash-preview')
					.setValue(this.plugin.settings.model)
					.onChange(async (value) => {
						// Update the setting and save to data.json
						this.plugin.settings.model = value.trim();
						await this.plugin.saveSettings();
					});
			});

	}
}
