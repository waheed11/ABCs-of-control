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
		// RTL + i18n
		const isArabic = (() => {
			try { const p = (this.app as any).plugins?.plugins?.['abcs-of-control']; return p?.settings?.language === 'arabic'; } catch { return false; }
		})();
		const t = (en: string, ar: string) => isArabic ? ar : en;
		contentEl.setAttr('dir', isArabic ? 'rtl' : 'ltr');
		contentEl.createEl('h2', { text: t('Prompt', 'مُدخل') });
		contentEl.createEl('p', { text: this.promptText });
		
		const input = contentEl.createEl('textarea', {
			attr: {
				rows: '8',
				placeholder: this.placeholder || ''
			}
		});
		input.value = this.defaultValue || '';
		
		const buttons = contentEl.createDiv({ cls: 'button-container' });
		const cancelButton = buttons.createEl('button', { text: t('Cancel', 'إلغاء') });
		cancelButton.addEventListener('click', () => {
			this.resolve(null);
			this.close();
		});
		
		const submitButton = buttons.createEl('button', { text: t('Submit', 'إرسال') });
		submitButton.addEventListener('click', () => {
			this.resolve(input.value);
			this.close();
		});
	}
}
