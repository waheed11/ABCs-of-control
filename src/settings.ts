import { App, PluginSettingTab, Setting } from 'obsidian';
import { MyPluginSettings } from './types';

export class ABCsSettingTab extends PluginSettingTab {
	plugin: any; // Will be properly typed when we refactor the main plugin

	constructor(app: App, plugin: any) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'ABCs of Control Settings' });

		new Setting(containerEl)
			.setName('Template Folder Path')
			.setDesc('Path to the folder containing your templates')
			.addText(text => text
				.setPlaceholder('C/Templates')
				.setValue(this.plugin.settings.templateFolderPath)
				.onChange(async (value) => {
					this.plugin.settings.templateFolderPath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Default Highlight Color')
			.setDesc('Default Color for text highlighting')
			.addDropdown(dropdown => dropdown
				.addOption('yellow', 'Yellow')
				.addOption('green', 'Green')
				.addOption('red', 'Red')
				.addOption('blue', 'Blue')
				.addOption('gray', 'Gray')
				.setValue(this.plugin.settings.defaultHighlightColor)
				.onChange(async (value) => {
					this.plugin.settings.defaultHighlightColor = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Default Language')
			.setDesc('Default language for section headers')
			.addDropdown(dropdown => dropdown
				.addOption('english', 'English')
				.addOption('arabic', 'Arabic')
				.setValue(this.plugin.settings.language || 'english')
				.onChange(async (value) => {
					this.plugin.settings.language = value;
					await this.plugin.saveSettings();
				}));
	}
}
