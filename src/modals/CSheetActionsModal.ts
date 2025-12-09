import { App, Modal } from 'obsidian';

export class CSheetActionsModal extends Modal {
	private onCreateNew: () => void;
	private onUpdateExisting: () => void;

	constructor(app: App, onCreateNew: () => void, onUpdateExisting: () => void) {
		super(app);
		this.onCreateNew = onCreateNew;
		this.onUpdateExisting = onUpdateExisting;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('abcs-of-control-modal');
		contentEl.createEl('h2', { text: 'C-Sheets' });

		const question = contentEl.createEl('p', {
			text: 'What would you like to do?',
		});
		question.addClass('csheet-actions-question');

		const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
		const createBtn = buttonContainer.createEl('button', { text: 'Create new C-Sheet' });
		const updateBtn = buttonContainer.createEl('button', { text: 'Update existing C-Sheet from JSON' });

		createBtn.addEventListener('click', () => {
			this.close();
			this.onCreateNew();
		});

		updateBtn.addEventListener('click', () => {
			this.close();
			this.onUpdateExisting();
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
