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
		// RTL + i18n
		const isArabic = (() => {
			try { const p = (this.app as any).plugins?.plugins?.['abcs-of-control']; return p?.settings?.language === 'arabic'; } catch { return false; }
		})();
		const t = (en: string, ar: string) => isArabic ? ar : en;
		contentEl.setAttr('dir', isArabic ? 'rtl' : 'ltr');
		const headerText = this.placeholder || t('Select an option', 'اختر خيارًا');
		contentEl.createEl('h2', { text: headerText });
		
		const list = contentEl.createEl('ul', { cls: 'suggester-list' });
		this.displayTexts.forEach((text, i) => {
			const li = list.createEl('li');
			const button = li.createEl('button', { text });
			button.addEventListener('click', () => {
				this.resolve(this.values[i]);
				this.close();
			});
		});
		
		const cancelButton = contentEl.createEl('button', { text: t('Cancel', 'إلغاء') });
		cancelButton.addEventListener('click', () => {
			this.resolve(null);
			this.close();
		});
	}
}
