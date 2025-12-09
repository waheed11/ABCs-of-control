import { App, Modal, TFile, TFolder, Notice } from 'obsidian';
import { CSheetUpdateHandler } from '../handlers/cSheetUpdateHandler';

export class CSheetUpdateModal extends Modal {
	private handler: CSheetUpdateHandler;

	constructor(app: App) {
		super(app);
		this.handler = new CSheetUpdateHandler(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('abcs-of-control-modal');
		contentEl.createEl('h2', { text: 'Update C-Sheet from JSON' });

		const sheetFolder = this.app.vault.getAbstractFileByPath('C/Sheets');
		if (!sheetFolder || !(sheetFolder instanceof TFolder)) {
			contentEl.createEl('p', { text: 'Folder C/Sheets was not found in the vault.' });
			const closeBtn = contentEl.createEl('button', { text: 'Close' });
			closeBtn.addEventListener('click', () => this.close());
			return;
		}

		const sheetFiles = (sheetFolder as TFolder).children.filter(f => f instanceof TFile && f.extension === 'md') as TFile[];
		if (sheetFiles.length === 0) {
			contentEl.createEl('p', { text: 'No markdown files found in C/Sheets.' });
			const closeBtn = contentEl.createEl('button', { text: 'Close' });
			closeBtn.addEventListener('click', () => this.close());
			return;
		}

		const sheetLabel = contentEl.createEl('p', { text: 'Select C-Sheet to update:' });
		sheetLabel.addClass('csheet-update-label');
		const sheetSelect = contentEl.createEl('select');
		for (const f of sheetFiles) {
			const opt = sheetSelect.createEl('option', { text: f.path });
			opt.value = f.path;
		}

		const jsonLabel = contentEl.createEl('p', { text: 'Select JSON note in vault:' });
		jsonLabel.addClass('csheet-update-label');
		const jsonSelect = contentEl.createEl('select');
		const defaultJsonOpt = jsonSelect.createEl('option', { text: 'Select JSON note…' });
		defaultJsonOpt.value = '';

		const allMarkdown = this.app.vault.getMarkdownFiles();
		const sortedJsonCandidates = allMarkdown.slice().sort((a, b) => {
			const score = (file: TFile): number => {
				const p = file.path.toLowerCase();
				if (p.includes('/sheets/json/') || p.endsWith('/sheets/json')) return 0;
				if (p.includes('/json/')) return 1;
				if (file.basename.toLowerCase().startsWith('json-')) return 2;
				return 3;
			};
			const sa = score(a);
			const sb = score(b);
			if (sa !== sb) return sa - sb;
			return a.path.localeCompare(b.path);
		});

		if (sortedJsonCandidates.length === 0) {
			defaultJsonOpt.text = 'No markdown notes found in vault';
		} else {
			for (const f of sortedJsonCandidates) {
				const opt = jsonSelect.createEl('option', { text: f.path });
				opt.value = f.path;
			}
		}

		const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());
		const updateBtn = buttonContainer.createEl('button', { text: 'Load & update' });
		updateBtn.addEventListener('click', () => {
			void (async () => {
				const sheetPath = sheetSelect.value && sheetSelect.value.trim();
				const jsonPath = jsonSelect.value && jsonSelect.value.trim();
				if (!sheetPath) {
					new Notice('Please select a C-Sheet to update');
					return;
				}
				if (!jsonPath) {
					new Notice('Please select a JSON note');
					return;
				}
				const sheetFile = this.app.vault.getAbstractFileByPath(sheetPath);
				const jsonFile = this.app.vault.getAbstractFileByPath(jsonPath);
				if (!sheetFile || !(sheetFile instanceof TFile)) {
					new Notice('Selected C-Sheet could not be found');
					return;
				}
				if (!jsonFile || !(jsonFile instanceof TFile)) {
					new Notice('Selected JSON note could not be found');
					return;
				}
				try {
					await this.handler.updateFromJson(sheetFile, jsonFile);
					this.close();
				} catch (e) {
					console.error('Error updating C-Sheet from JSON:', e);
					new Notice('Error updating C-Sheet from JSON');
				}
			})();
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
