import { App, Editor, MarkdownView, Plugin, MarkdownFileInfo, Notice } from 'obsidian';
import { ABCsOfControlSettings, SettingsRoot } from './types';
import { DEFAULT_SETTINGS } from './constants';
import { ABCsModal } from './modals/ABCsModal';
import { ABCsSettingTab } from './settings';
import { HighlightHandler } from './handlers/highlightHandler';
import { QuoteHandler } from './handlers/quoteHandler';
import { ensureFolderExists } from './utils';
import { createTemplateExamples, createArabicTemplateExamples } from './templateExamples';
import { registerIcons, ABCS_ICON_ID } from './icons';
export default class ABCsOfControlPlugin extends Plugin {
    settings: ABCsOfControlSettings;
	private highlightHandler: HighlightHandler;
	private quoteHandler: QuoteHandler;

	async onload() {
		await this.loadSettings();
		// Ensure default Phase 0 config exists (pipelines, roles)
		this.ensurePhase0Defaults();
		// Align pipeline prefixes with selected language
		this.adjustPipelinePrefixesForLanguage();
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
		const lang = this.settings?.language || 'english';

		const defaultSettings: SettingsRoot = {
			activeProfile: defaultProfileId,
			version: 1,
			safety: { dryRun: false, confirmMoves: true },
			profiles: [
				{
					id: defaultProfileId,
					label: 'Default',
					roles: {
						A: lang === 'arabic' ? ['أ'] : ['A'],
						B: lang === 'arabic' ? ['ب'] : ['B'],
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
	 * Keep default pipeline prefixes in sync with selected language.
	 * Does not override user-custom prefixes.
	 */
	private adjustPipelinePrefixesForLanguage() {
		const lang = this.settings?.language || 'english';
		const root = this.settings.abcsPhase0;
		if (!root) return;
		const prof = root.profiles.find((p: any) => p.id === root.activeProfile) || root.profiles[0];
		if (!prof || !prof.pipelines) return;

		const wantContent = (lang === 'arabic') ? 'محتوى-الى-' : 'Content-to-';
		const wantTips = (lang === 'arabic') ? 'نصائح-الى-' : 'Tips-to-';
		for (const pipe of prof.pipelines) {
			if (pipe.id === 'content-to-d-projects') {
				if (pipe.templatePrefix === 'Content-to-' || pipe.templatePrefix === 'محتوى-الى-') {
					pipe.templatePrefix = wantContent;
				}
			}
			if (pipe.id === 'tips-to-d-exams') {
				if (pipe.templatePrefix === 'Tips-to-' || pipe.templatePrefix === 'نصائح-الى-') {
					pipe.templatePrefix = wantTips;
				}
			}
		}
	}
	/**
	 * Ensure mandatory C/Templates folder exists (hardcoded location)
	 */
	private async ensureRequiredFolders() {
		const lang = this.settings?.language || 'english';
		if (lang === 'arabic') {
			await ensureFolderExists(this.app, 'ت/القوالب');
			await ensureFolderExists(this.app, 'ت/القوالب/أمثلة على القوالب');
			await createArabicTemplateExamples(this.app);
		} else {
			await ensureFolderExists(this.app, 'C/Templates');
			await createTemplateExamples(this.app);
		}
	}

	/**
	 * Public: Apply setup for the current language without requiring reload.
	 * - Sync pipeline prefixes for the selected language
	 * - Ensure templates folders exist and seed examples if missing
	 * - Persist settings
	 */
	public async applyLanguageSetup(): Promise<void> {
		try {
			this.adjustPipelinePrefixesForLanguage();
			await this.ensureRequiredFolders();
			await this.saveSettings();
			new Notice('Language setup applied');
		} catch (err) {
			console.error('Failed to apply language setup:', err);
			new Notice('Failed to apply language setup. Check console for details.');
		}
	}

}
