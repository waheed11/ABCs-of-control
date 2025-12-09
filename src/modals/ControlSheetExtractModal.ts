import { App, Modal, TFile, TFolder } from 'obsidian';
import { confirmModal } from '../utils';
import { ControlSheetExtractionHandler } from '../handlers/controlSheetExtractionHandler';

export class ControlSheetExtractModal extends Modal {
	private handler: ControlSheetExtractionHandler;

	constructor(app: App) {
		super(app);
		this.handler = new ControlSheetExtractionHandler(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('abcs-of-control-modal');
		contentEl.createEl('h2', { text: 'Extract from control sheet' });
		contentEl.createEl('p', {
			text: 'Select a control sheet from C/Sheets to extract notes into A, B, C and D folders.',
		});
		const folder = this.app.vault.getAbstractFileByPath('C/Sheets');
		if (!folder || !(folder instanceof TFolder)) {
			contentEl.createEl('p', { text: 'Folder C/Sheets was not found in the vault.' });
			const closeBtn = contentEl.createEl('button', { text: 'Close' });
			closeBtn.addEventListener('click', () => this.close());
			return;
		}
		const children = (folder as TFolder).children;
		const files = children.filter(f => f instanceof TFile && f.extension === 'md') as TFile[];
		if (files.length === 0) {
			contentEl.createEl('p', { text: 'No markdown files found in C/Sheets.' });
			const closeBtn = contentEl.createEl('button', { text: 'Close' });
			closeBtn.addEventListener('click', () => this.close());
			return;
		}
		const select = contentEl.createEl('select');
		for (const f of files) {
			const opt = select.createEl('option', { text: f.path });
			opt.value = f.path;
		}
		const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());
		const extractBtn = buttonContainer.createEl('button', { text: 'Extract' });
		extractBtn.addEventListener('click', () => {
			void (async () => {
				const selectedPath = select.value && select.value.trim();
				if (!selectedPath) return;
				const file = this.app.vault.getAbstractFileByPath(selectedPath);
				if (!file || !(file instanceof TFile)) return;
				try {
					const plan = await this.handler.buildPlan(file);
					const summary = this.handler.buildSummary(plan);
					const confirmed = await confirmModal(this.app, 'Extract from control sheet', summary, 'Extract', 'Cancel');
					if (!confirmed) return;
					await this.handler.executePlan(plan);
					this.close();
				} catch (e) {
					console.error('Control sheet extraction error:', e);
				}
			})();
		});
		const updateBtn = buttonContainer.createEl('button', { text: 'Update' });
		updateBtn.addEventListener('click', () => {
			void (async () => {
				const selectedPath = select.value && select.value.trim();
				if (!selectedPath) return;
				const file = this.app.vault.getAbstractFileByPath(selectedPath);
				if (!file || !(file instanceof TFile)) return;
				try {
					const plan = await this.handler.buildPlan(file);
					const summary = this.handler.buildUpdateSummary(plan);
					const confirmed = await confirmModal(
						this.app,
						'Update extracted notes from control sheet',
						summary,
						'Update',
						'Cancel',
					);
					if (!confirmed) return;
					await this.handler.executeUpdatePlan(plan);
					this.close();
				} catch (e) {
					console.error('Control sheet update error:', e);
				}
			})();
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
