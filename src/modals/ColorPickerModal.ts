import { App, Modal } from 'obsidian';
export class ColorPickerModal extends Modal {
	private colors: string[];
	private defaultColor: string;
	private resolve: (value: string | null) => void;

	constructor(app: App, colors: string[], defaultColor: string, resolve: (value: string | null) => void) {
		super(app);
		this.colors = colors;
		this.defaultColor = defaultColor;
		this.resolve = resolve;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('color-picker-modal');
		// RTL + i18n
		const isArabic = (() => {
			try { const p = (this.app as any).plugins?.plugins?.['abcs-of-control']; return p?.settings?.language === 'arabic'; } catch { return false; }
		})();
		const t = (en: string, ar: string) => isArabic ? ar : en;
		contentEl.setAttr('dir', isArabic ? 'rtl' : 'ltr');
		contentEl.createEl('h2', { text: t('Select Highlight Color', 'اختر لون التحديد') });

		const row = contentEl.createDiv({ cls: 'color-container' });
		this.colors.forEach((color) => {
			const swatch = row.createDiv({ cls: 'color-swatch' });
			swatch.setAttr('data-color', color);
			if (color === this.defaultColor) {
				swatch.addClass('selected');
			}
			swatch.addEventListener('click', () => {
				this.resolve(color);
				this.close();
			});
		});

		const buttons = contentEl.createDiv({ cls: 'button-container' });
		const cancelButton = buttons.createEl('button', { text: t('Cancel', 'إلغاء') });
		cancelButton.addEventListener('click', () => {
			this.resolve(null);
			this.close();
		});
	}
}
