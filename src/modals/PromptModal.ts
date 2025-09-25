import { App, Modal } from 'obsidian';

export class PromptModal extends Modal {
	private resolve: (value: string | null) => void;
	private promptText: string;
	private defaultValue: string;
	private placeholder: string;

	constructor(app: App, promptText: string, defaultValue: string, placeholder: string, resolve: (value: string | null) => void) {
		super(app);
		this.promptText = promptText;
		this.defaultValue = defaultValue;
		this.placeholder = placeholder;
		this.resolve = resolve;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: 'Prompt' });
		contentEl.createEl('p', { text: this.promptText });
		
		const input = contentEl.createEl('textarea', {
			attr: {
				rows: '8',
				placeholder: this.placeholder || ''
			}
		});
		input.value = this.defaultValue || '';
		
		const buttons = contentEl.createDiv({ cls: 'button-container' });
		const cancelButton = buttons.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => {
			this.resolve(null);
			this.close();
		});
		
		const submitButton = buttons.createEl('button', { text: 'Submit' });
		submitButton.addEventListener('click', () => {
			this.resolve(input.value);
			this.close();
		});
	}
}
