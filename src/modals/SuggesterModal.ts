import { App, Modal } from 'obsidian';

export class SuggesterModal extends Modal {
	private resolve: (value: any) => void;
	private displayTexts: string[];
	private values: any[];
	private placeholder: string;

	constructor(app: App, displayTexts: string[], values: any[], placeholder: string, resolve: (value: any) => void) {
		super(app);
		this.displayTexts = displayTexts;
		this.values = values;
		this.placeholder = placeholder;
		this.resolve = resolve;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: this.placeholder || 'Select an option' });
		
		const list = contentEl.createEl('ul', { cls: 'suggester-list' });
		this.displayTexts.forEach((text, i) => {
			const li = list.createEl('li');
			const button = li.createEl('button', { text });
			button.addEventListener('click', () => {
				this.resolve(this.values[i]);
				this.close();
			});
		});
		
		const cancelButton = contentEl.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => {
			this.resolve(null);
			this.close();
		});
	}
}
