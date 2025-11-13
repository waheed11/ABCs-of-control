import { App, Modal, Setting, Notice, TFile } from 'obsidian';
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

		contentEl.createEl('h2', { text: 'Archive settings' });

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

		const previewButton = buttonContainer.createEl('button', { text: 'Preview archive' });
		previewButton.addEventListener('click', () => { void this.previewArchive(); });

		const saveButton = buttonContainer.createEl('button', { text: 'Save settings' });
		saveButton.addEventListener('click', () => this.saveSettings());
	}

	private async previewArchive() {
		if (!this.settings.enabled) {
			new Notice('Enable archiving by age first');
			return;
		}

		// Import ArchiveHandler to get preview
		const { ArchiveHandler } = await import('../handlers/archiveHandler');
		const archiveHandler = new ArchiveHandler(this.app);
		
		const filesToArchive = archiveHandler.getFilesToArchiveByAge(this.settings);
		
		if (filesToArchive.length === 0) {
			new Notice('No files found that match the archive criteria');
			return;
		}

		// Show preview modal with updated callback
		const previewModal = new ArchivePreviewModal(
			this.app, 
			filesToArchive, 
			this.settings,
			(selectedFiles) => {  // Now receives only selected files
				void (async () => {
					// Execute archive for selected files only
					const { ArchiveHandler } = await import('../handlers/archiveHandler');
					const archiveHandler = new ArchiveHandler(this.app);
					await archiveHandler.archiveSpecificFiles(selectedFiles);  // New method needed
					this.close();
				})();
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
	private filesToArchive: { file: TFile; age: number }[];
	private settings: ArchiveSettings;
	private onConfirm: (selectedFiles: { file: TFile; age: number }[]) => void;
	private selectedFiles: Set<string> = new Set(); // Track selected files
	private confirmButton: HTMLButtonElement;

	constructor(app: App, filesToArchive: { file: TFile; age: number }[], settings: ArchiveSettings, onConfirm: (selectedFiles: { file: TFile; age: number }[]) => void) {
		super(app);
		this.filesToArchive = filesToArchive;
		this.settings = settings;
		this.onConfirm = onConfirm;
		
		// Initialize all files as selected by default
		this.filesToArchive.forEach(({ file }) => {
			this.selectedFiles.add(file.path);
		});
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('archive-preview-modal');

		contentEl.createEl('h2', { text: 'Archive Preview' });
		
		contentEl.createEl('p', { 
			text: `Found ${this.filesToArchive.length} file(s) older than ${this.settings.archiveAfterDays} days. Select which files to archive to E/Archive:` 
		});

		// Master "Check All" checkbox
		const masterCheckboxContainer = contentEl.createDiv({ cls: 'master-checkbox-container' });
		const masterCheckbox = masterCheckboxContainer.createEl('input', {
			type: 'checkbox',
			attr: { id: 'check-all-files' }
		});
		masterCheckbox.checked = true; // Checked by default
		
		masterCheckboxContainer.createEl('label', {
			text: `Check All (${this.filesToArchive.length} files)`,
			attr: { for: 'check-all-files' }
		});

		// Master checkbox event listener
		masterCheckbox.addEventListener('change', () => {
			const isChecked = masterCheckbox.checked;
			
			// Update all individual checkboxes
			const individualCheckboxes = contentEl.querySelectorAll('.file-checkbox');
			individualCheckboxes.forEach((checkbox) => {
				if (checkbox instanceof HTMLInputElement) {
					checkbox.checked = isChecked;
				}
			});
			
			// Update selected files set
			this.selectedFiles.clear();
			if (isChecked) {
				this.filesToArchive.forEach(({ file }) => {
					this.selectedFiles.add(file.path);
				});
			}
			
			// Update confirm button text
			this.updateConfirmButton();
		});

		// File list with individual checkboxes
		const fileList = contentEl.createEl('div', { cls: 'archive-file-list' });
		
		this.filesToArchive.forEach(({ file, age }) => {
			const fileItem = fileList.createEl('div', { cls: 'archive-file-item' });
			
			// Individual checkbox for each file
			const fileCheckbox = fileItem.createEl('input', {
				type: 'checkbox',
				cls: 'file-checkbox',
				attr: { 'data-file-path': file.path }
			});
			fileCheckbox.checked = true; // Checked by default
			
			// File info container
			const fileInfo = fileItem.createEl('div', { cls: 'file-info' });
			fileInfo.createEl('strong', { text: file.basename });
			fileInfo.createEl('br');
			fileInfo.createEl('span', { 
				text: `Path: ${file.path}`,
				cls: 'file-path'
			});
			fileInfo.createEl('br');
			fileInfo.createEl('span', { 
				text: `Age: ${age} days`,
				cls: 'file-age'
			});
			
			// Individual checkbox event listener
			fileCheckbox.addEventListener('change', () => {
				if (fileCheckbox.checked) {
					this.selectedFiles.add(file.path);
				} else {
					this.selectedFiles.delete(file.path);
				}
				
				// Update master checkbox state
				const allChecked = this.selectedFiles.size === this.filesToArchive.length;
				const noneChecked = this.selectedFiles.size === 0;
				
				masterCheckbox.checked = allChecked;
				masterCheckbox.indeterminate = !allChecked && !noneChecked;
				
				// Update confirm button text
				this.updateConfirmButton();
			});
		});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
		
		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => this.close());

		this.confirmButton = buttonContainer.createEl('button', { 
			text: `Archive ${this.selectedFiles.size} file(s)`,
			cls: 'mod-cta'
		});
		
		this.confirmButton.addEventListener('click', () => {
			// Get only the selected files
			const selectedFilesToArchive = this.filesToArchive.filter(({ file }) => 
				this.selectedFiles.has(file.path)
			);
			
			if (selectedFilesToArchive.length === 0) {
				new Notice('Please select at least one file to archive');
				return;
			}
			
			this.onConfirm(selectedFilesToArchive);
			this.close();
		});
	}
	
	private updateConfirmButton() {
		if (this.confirmButton) {
			this.confirmButton.textContent = `Archive ${this.selectedFiles.size} file(s)`;
			this.confirmButton.disabled = this.selectedFiles.size === 0;
		}
	}
}
