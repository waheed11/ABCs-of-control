import { App, Modal, Setting, Notice } from 'obsidian';
import { ArchiveSettings } from '../types';

export class ArchiveSettingsModal extends Modal {
	private settings: ArchiveSettings;
	private onSave: (settings: ArchiveSettings) => void;

	constructor(app: App, settings: ArchiveSettings, onSave: (settings: ArchiveSettings) => void) {
		super(app);
		this.settings = { ...settings }; // Create a copy
		this.onSave = onSave;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('archive-settings-modal');

		contentEl.createEl('h2', { text: 'Archive Settings' });

		// Enable/Disable archive
		new Setting(contentEl)
        .setName('Enable archiving by age')
        .setDesc('Enable the option to archive notes older than specified days (requires manual confirmation)')
			.addToggle(toggle => toggle
				.setValue(this.settings.enabled)
				.onChange(value => {
					this.settings.enabled = value;
				}));

		// Days setting
		new Setting(contentEl)
			.setName('Archive after days')
			.setDesc('Number of days after note creation to automatically archive')
			.addText(text => text
				.setPlaceholder('30')
				.setValue(this.settings.archiveAfterDays.toString())
				.onChange(value => {
					const days = parseInt(value);
					if (!isNaN(days) && days > 0) {
						this.settings.archiveAfterDays = days;
					}
				}));

		// Exclude folders
		new Setting(contentEl)
			.setName('Exclude folders')
			.setDesc('Comma-separated list of folders to exclude from archiving (e.g., "Templates, Daily Notes")')
			.addText(text => text
				.setPlaceholder('Templates, Daily Notes')
				.setValue(this.settings.excludeFolders.join(', '))
				.onChange(value => {
					this.settings.excludeFolders = value
						.split(',')
						.map(folder => folder.trim())
						.filter(folder => folder.length > 0);
				}));

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
		
		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => this.close());

		const previewButton = buttonContainer.createEl('button', { text: 'Preview Archive' });
		previewButton.addEventListener('click', () => this.previewArchive());

		const saveButton = buttonContainer.createEl('button', { text: 'Save Settings' });
		saveButton.addEventListener('click', () => this.saveSettings());
	}

	private async previewArchive() {
		if (!this.settings.enabled) {
			new Notice('Enable automatic archiving first');
			return;
		}

		// Import ArchiveHandler to get preview
		const { ArchiveHandler } = await import('../handlers/archiveHandler');
		const archiveHandler = new ArchiveHandler(this.app);
		
		const filesToArchive = await archiveHandler.getFilesToArchiveByAge(this.settings);
		
		if (filesToArchive.length === 0) {
			new Notice('No files found that match the archive criteria');
			return;
		}

		// Show preview modal
		const previewModal = new ArchivePreviewModal(
			this.app, 
			filesToArchive, 
			this.settings,
			async () => {
				// Execute archive
				await archiveHandler.archiveFilesByAge(this.settings);
				this.close();
			}
		);
		previewModal.open();
	}

	private saveSettings() {
		if (this.settings.archiveAfterDays <= 0) {
			new Notice('Please enter a valid number of days');
			return;
		}

		this.onSave(this.settings);
		new Notice('Archive settings saved');
		this.close();
	}
}

export class ArchivePreviewModal extends Modal {
	private filesToArchive: { file: any; age: number }[];
	private settings: ArchiveSettings;
	private onConfirm: () => void;

	constructor(app: App, filesToArchive: { file: any; age: number }[], settings: ArchiveSettings, onConfirm: () => void) {
		super(app);
		this.filesToArchive = filesToArchive;
		this.settings = settings;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('archive-preview-modal');

		contentEl.createEl('h2', { text: 'Archive Preview' });
		
		contentEl.createEl('p', { 
			text: `Found ${this.filesToArchive.length} file(s) older than ${this.settings.archiveAfterDays} days that will be archived to E/Archive:` 
		});

		// File list
		const fileList = contentEl.createEl('div', { cls: 'archive-file-list' });
		
		this.filesToArchive.forEach(({ file, age }) => {
			const fileItem = fileList.createEl('div', { cls: 'archive-file-item' });
			fileItem.createEl('strong', { text: file.basename });
			fileItem.createEl('br');
			fileItem.createEl('span', { 
				text: `Path: ${file.path}`,
				cls: 'file-path'
			});
			fileItem.createEl('br');
			fileItem.createEl('span', { 
				text: `Age: ${age} days`,
				cls: 'file-age'
			});
		});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
		
		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => this.close());

		const confirmButton = buttonContainer.createEl('button', { 
			text: `Archive ${this.filesToArchive.length} file(s)`,
			cls: 'mod-cta'
		});
		confirmButton.addEventListener('click', () => {
			this.onConfirm();
			this.close();
		});
	}
}
