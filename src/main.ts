import { App, Editor, MarkdownView, Plugin, MarkdownFileInfo } from 'obsidian';
import { ABCsOfControlSettings, SettingsRoot } from './types';
import { DEFAULT_SETTINGS } from './constants';
import { ABCsModal } from './modals/ABCsModal';
import { ABCsSettingTab } from './settings';
import { HighlightHandler } from './handlers/highlightHandler';
import { QuoteHandler } from './handlers/quoteHandler';
import { ensureFolderExists } from './utils';
import { createTemplateExamples } from './templateExamples';
import { registerIcons, ABCS_ICON_ID } from './icons';

export default class ABCsOfControlPlugin extends Plugin {
    settings: ABCsOfControlSettings;
	private highlightHandler: HighlightHandler;
	private quoteHandler: QuoteHandler;

	async onload() {
		await this.loadSettings();
		await this.ensureRequiredFolders();
		await this.saveSettings();
		
		// Initialize handlers
		this.highlightHandler = new HighlightHandler(this.app, this.settings);
		this.quoteHandler = new QuoteHandler(this.app);
		
		// Register custom icons (kept separate for cleanliness)
		registerIcons();

		// Add a ribbon icon
		this.addRibbonIcon(ABCS_ICON_ID, 'ABCs of control', (evt: MouseEvent) => {
			new ABCsModal(this.app, this).open();
		});

		// Add a command to open the ABCs modal
		this.addCommand({
			id: 'start-abcs-of-control',
			name: 'Open modal',
			callback: () => {
				new ABCsModal(this.app, this).open();
			}
		});

		// Register context menu event
		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu, editor, view) => {
				if (editor.getSelection().length > 0) {
					menu.addItem((item) => {
						item.setTitle('ABCs: Highlight')
							.setIcon('highlighter')
							.onClick(() => this.highlightHandler.handleHighlight(editor, view));
					});

					menu.addItem((item) => {
						item.setTitle('ABCs: Copy Highlight')
							.setIcon('copy')
							.onClick(() => this.highlightHandler.handleCopyHighlight(editor, view));
					});

					if (this.highlightHandler.getCopiedHighlight()) {
						menu.addItem((item) => {
							item.setTitle('ABCs: Paste Highlight')
								.setIcon('paste')
								.onClick(() => this.highlightHandler.handlePasteHighlight(editor, view));
						});
					}

					menu.addItem((item) => {
						item.setTitle('ABCs: Quote')
							.setIcon('quote')
							.onClick(() => this.quoteHandler.handleQuote(editor, view));
					});
				}
			})
		);

		// Add settings tab
		this.addSettingTab(new ABCsSettingTab(this.app, this));
	}

	onunload() {
		// Clean up when the plugin is disabled
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private ensurePhase0Defaults() {
		if (this.settings.abcsPhase0) return;

		const defaultProfileId = 'default';

		const defaultSettings: SettingsRoot = {
			activeProfile: defaultProfileId,
			version: 1,
			safety: { dryRun: false, confirmMoves: true },
			profiles: [
				{
					id: defaultProfileId,
					label: 'Default',
					roles: {
						A: ['A'],
						B: ['B'],
						D: ['D/Projects', 'D/Exams'],
						E: 'E/Archive',
					},
					classification: {
						useFrontmatter: true,
						useTags: true,
						frontmatterKey: 'abcs.letter',
						tagMap: {
							'#B': 'B',
							'#C': 'C',
							'#D': 'D',
							'#E': 'E',
						},
					},
					defaults: {
						search: {
							includeArchive: false,
						},
						insertion: {
							ordering: 'numeric',
							compare: 'numericFirst',
							normalizeDigits: true,
							stopAtAnyHeading: true,
						},
					},
					pipelines: [
						{
							id: 'content-to-d-projects',
							label: 'Content to D/Projects',
							templatePrefix: 'Content-to-',
							sources: { roles: ['A', 'B'] },
							targetPath: 'D/Projects/{project}/Content.md',
							search: { includeArchive: false },
							ui: { keepModalOpen: true, resetAfterInsert: true },
						},
						{
							id: 'tips-to-d-exams',
							label: 'Tips to D/Exams',
							templatePrefix: 'Tips-to-',
							sources: { roles: ['A', 'B'] },
							targetPath: 'D/Exams/{exam}/Tips.md',
							search: { includeArchive: false },
							ui: { keepModalOpen: true, resetAfterInsert: true },
						},
					],
				},
			],
			i18n: { language: (this.settings?.language as string) || undefined, rtl: false },
		};

		this.settings.abcsPhase0 = defaultSettings;
	}

	/**
	 * Ensure mandatory C/Templates folder exists (hardcoded location)
	 */
	private async ensureRequiredFolders() {
		// Always create C/Templates regardless of settings
		await ensureFolderExists(this.app, 'C/Templates');
		// Create Templates Examples folder and populate with example templates
		await createTemplateExamples(this.app);
	}
}
