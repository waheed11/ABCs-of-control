import { App, PluginSettingTab, Setting, Notice, Plugin  } from 'obsidian';
import { ABCsOfControlPluginAPI, Profile, PipelineConfig, RoleLetter } from './types';

export class ABCsSettingTab extends PluginSettingTab {
	plugin: Plugin & ABCsOfControlPluginAPI;

	constructor(app: App, plugin: Plugin & ABCsOfControlPluginAPI) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		new Setting(containerEl)
			.setName('General')
			.setHeading();

		new Setting(containerEl)
			.setName('Template folder path')
			.setDesc('Path to the folder containing your templates')
			.addText(text => text
				.setPlaceholder('C/Templates')
				.setValue(this.plugin.settings.templateFolderPath)
				.onChange((value) => {
					this.plugin.settings.templateFolderPath = value;
					void this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Default highlight color')
			.setDesc('Default color for text highlighting')
			.addDropdown(dropdown => dropdown
				.addOption('yellow', 'Yellow')
				.addOption('green', 'Green')
				.addOption('red', 'Red')
				.addOption('blue', 'Blue')
				.addOption('gray', 'Gray')
				.setValue(this.plugin.settings.defaultHighlightColor)
				.onChange((value) => {
					this.plugin.settings.defaultHighlightColor = value;
					void this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Default language')
			.setDesc('Default language for section headers')
			.addDropdown(dropdown => dropdown
				.addOption('english', 'English')
				.addOption('arabic', 'Arabic')
				.setValue(this.plugin.settings.language || 'english')
				.onChange((value) => {
					this.plugin.settings.language = value;
					void this.plugin.saveSettings();
				}));

		// ---- Role Folder Configuration ----
		new Setting(containerEl)
			.setName('Role folder mapping')
			.setHeading();
		containerEl.createEl('p', { 
			text: 'Configure which folders in your vault correspond to each ABC role. C is fixed at C/Templates.',
			cls: 'setting-item-description'
		});

		const phase0 = this.plugin.settings?.abcsPhase0;
		if (phase0) {
			const prof = phase0.profiles.find((p: Profile) => p.id === phase0.activeProfile) || phase0.profiles[0];

			// Info: C/Templates is fixed
			new Setting(containerEl)
				.setDesc('Templates folder location (fixed, cannot be changed)')
				.addText(text => text
					.setValue('C/Templates')
					.setDisabled(true));

			// E (Archive) - Single folder (read-only, hardcoded in the plugin)
			new Setting(containerEl)
				.setName('E (archive)')
				.setDesc('Archive folder location (fixed, cannot be changed)')
				.addText(text => text
					.setValue('E/Archive')
					.setDisabled(true));

			// A Folders - Multi-line textarea
			new Setting(containerEl)
				.setName('A folders (permanent notes)')
				.setDesc('One folder path per line. Examples: A, Permanent, Reference')
				.addTextArea(text => {
					const currentA = prof?.roles?.A || ['A'];
					text
						.setPlaceholder('A\nPermanent\nReference')
						.setValue(currentA.join('\n'))
						.onChange((value) => {
							const lines = value.split('\n')
								.map(l => l.trim())
								.filter(l => l.length > 0);
							if (!phase0.profiles) return;
							const profEdit = phase0.profiles.find((x: Profile) => x.id === phase0.activeProfile) || phase0.profiles[0];
							if (profEdit) {
								profEdit.roles.A = lines.length > 0 ? lines : ['A'];
								void this.plugin.saveSettings();
								new Notice('A folders updated. Reload plugin to apply.');
							}
						});
					text.inputEl.rows = 4;
					text.inputEl.classList.add('abcs-full-width');
				});

			new Setting(containerEl)
				.setName('B folders (literature notes)')
				.setDesc('One folder path per line. Examples: B, Literature, Meetings')
				.addTextArea(text => {
					const currentB = prof?.roles?.B || ['B'];
					text
						.setPlaceholder('B\nLiterature\nMeetings')
						.setValue(currentB.join('\n'))
						.onChange((value) => {
							const lines = value.split('\n')
								.map(l => l.trim())
								.filter(l => l.length > 0);
							if (!phase0.profiles) return;
							const profEdit = phase0.profiles.find((x: Profile) => x.id === phase0.activeProfile) || phase0.profiles[0];
							if (profEdit) {
								profEdit.roles.B = lines.length > 0 ? lines : ['B'];
								void this.plugin.saveSettings();
								new Notice('B folders updated. Reload plugin to apply.');
							}
						});
					text.inputEl.rows = 4;
					text.inputEl.classList.add('abcs-full-width');
				});

			// D Folder - Read-only root for active work
			new Setting(containerEl)
				.setName('D folder (projects/active work)')
				.setDesc('The root folder for active work. Sub-folders (e.g., Projects, Exams) are managed by the pipelines below.')
				.addText(text => {
					text
						.setValue('D/')
						.setDisabled(true);
				});
		}

		// ===== Pipeline Management Section =====
		if (phase0) {
			const prof = phase0.profiles.find((p: Profile) => p.id === phase0.activeProfile) || phase0.profiles[0];
			new Setting(containerEl)
				.setName('Pipeline configuration')
				.setHeading();
			containerEl.createEl('p', { 
				text: 'Pipelines define how content flows from templates to target files. Configure template prefixes and target path patterns.',
				cls: 'setting-item-description'
			});

			const pipelines: PipelineConfig[] = prof?.pipelines || [];
			
			// Display each pipeline with edit/delete controls
				pipelines.forEach((p: PipelineConfig, index: number) => {
					const pipelineContainer = containerEl.createDiv({ cls: 'abcs-pipeline-container' });
					
					// Pipeline header with label and delete button
					const headerSetting = new Setting(pipelineContainer)
						.setName(`${p.label || p.id}`)
						.setHeading();
					headerSetting.addButton((btn) => {
						btn.setButtonText('🗑️ Delete pipeline');
						btn.buttonEl.classList.add('mod-warning');
						btn.onClick(() => { void (async () => {
							const { confirmModal } = await import('./utils');
							const confirmed = await confirmModal(
								this.app,
								'Delete pipeline',
								`Delete pipeline "${p.label}"? This cannot be undone.`,
								'Delete',
								'Cancel'
							);
							if (!confirmed) return;
							const prof2 = phase0.profiles.find((p2: Profile) => p2.id === phase0.activeProfile) || phase0.profiles[0];
							if (prof2?.pipelines) {
								prof2.pipelines.splice(index, 1);
								await this.plugin.saveSettings();
								new Notice(`Pipeline "${p.label}" deleted. Reload plugin to apply.`);
								this.display(); // Refresh settings UI
							}
						})(); });
					});

				// Pipeline ID (read-only for reference)
				new Setting(pipelineContainer)
					.setName('Pipeline ID')
					.setDesc('Unique identifier (auto-generated for new pipelines)')
					.addText(t => {
						t.setValue(p.id);
						t.setDisabled(true);
					});

				// Label
				new Setting(pipelineContainer)
					.setName('Label')
					.setDesc('Display name for this pipeline')
					.addText(t => {
						t.setPlaceholder('My custom pipeline');
						t.setValue(p.label || '');
						t.onChange((val) => {
							const prof2 = phase0.profiles.find((p2: Profile) => p2.id === phase0.activeProfile) || phase0.profiles[0];
							const pipe2 = (prof2?.pipelines || [])[index];
							if (pipe2) {
								pipe2.label = val.trim();
								void this.plugin.saveSettings();
							}
						});
					});

				// Template Prefix
				new Setting(pipelineContainer)
					.setName('Template prefix')
					.setDesc('Template prefix for this pipeline. Path comes from template name. Example: "Content-to-" matches "Content-to-D-Projects-WebDev"')
					.addText(t => {
						t.setPlaceholder('Content-to-');
						t.setValue(p.templatePrefix || '');
						t.onChange((val) => {
							const prof2 = phase0.profiles.find((p2: Profile) => p2.id === phase0.activeProfile) || phase0.profiles[0];
							const pipe2 = (prof2?.pipelines || [])[index];
							if (pipe2) {
								pipe2.templatePrefix = val.trim();
								void this.plugin.saveSettings();
							}
						});
					});

				// Target Path Pattern (Read-Only)
				new Setting(pipelineContainer)
					.setName('Target path pattern (not used)')
					.setDesc('⚠️ This field is no longer used. File paths are now determined by template names in C/Templates. Format: "{prefix}-{folder}-{subfolder}-{filename}"')
					.addText(t => {
						t.setPlaceholder('Path from template name');
						t.setValue(p.targetPath || '');
						t.setDisabled(true);
					});

				// Include Archive Folder Notes
				new Setting(pipelineContainer)
					.setName('Include archive folder notes')
					.setDesc('Default setting for including archived notes in search')
					.addToggle(t => {
						const current = Boolean(p.search?.includeArchive);
						t.setValue(current);
						t.onChange((val) => {
							const prof2: Profile = phase0.profiles.find((p2: Profile) => p2.id === phase0.activeProfile) || phase0.profiles[0];
							const pipe2: PipelineConfig = (prof2?.pipelines || [])[index];
							if (pipe2) {
								pipe2.search = pipe2.search || { includeArchive: false };
								pipe2.search.includeArchive = val;
								void this.plugin.saveSettings();
							}
						});
					});

				// Separator
				pipelineContainer.createEl('hr', { cls: 'abcs-pipeline-separator' });
			});

			// Add New Pipeline Button
			new Setting(containerEl)
				.setName('Add new pipeline')
				.setDesc('Create a custom pipeline with your own prefix and target path')
				.addButton(btn => {
					btn.setButtonText('➕ Add pipeline')
						.setCta()
						.onClick(() => { void (async () => {
							const prof2: Profile = phase0.profiles.find((p2: Profile) => p2.id === phase0.activeProfile) || phase0.profiles[0];
							if (!prof2) return;

							// Generate unique ID
							const timestamp = Date.now();
							const newId = `custom-pipeline-${timestamp}`;

							// Create new pipeline
							const newPipeline: PipelineConfig = {
								id: newId,
								label: 'New Pipeline',
								templatePrefix: 'My-Pipeline-',
								sources: { roles: ['A', 'B'] as RoleLetter[] },
								targetPath: 'D/Projects/{project}/Notes.md',
								search: { includeArchive: false },
								ui: { keepModalOpen: true, resetAfterInsert: true },
							};

							prof2.pipelines = prof2.pipelines || [];
							prof2.pipelines.push(newPipeline);
							
							await this.plugin.saveSettings();
							new Notice('New pipeline added! Configure it below.');
							this.display(); // Refresh settings UI
						})(); });
				});
			
			// Guidance: How to use template examples
			const help = containerEl.createEl('div', { cls: 'abcs-phase0-help' });
			new Setting(help)
				.setName('How to use template examples')
				.setHeading();

			// Make a collapsible "details" section
			const details = help.createEl('details', { cls: 'abcs-help-details' });
			details.createEl('summary', { text: 'Template examples guide' });

			const body = details.createEl('div', { cls: 'abcs-help-body' });
			
			// Introduction
			body.createEl('p', { 
				text: 'The plugin automatically creates example templates in C/Templates/Templates Examples/ to help you get started. Follow these steps to use them:',
				cls: 'abcs-help-intro'
			});

			// Step 1
			const step1 = body.createEl('div', { cls: 'abcs-help-step' });
			step1.createEl('strong', { text: '1. Copy templates from examples folder' });
			step1.createEl('p', { text: 'Copy any template from C/Templates/Templates Examples/ and place it in C/Templates/ to activate it.' });

			// Step 2
			const step2 = body.createEl('div', { cls: 'abcs-help-step' });
			step2.createEl('strong', { text: '2. Understand the two types of templates' });
			const typesList = step2.createEl('ul');
			{
				const li = typesList.createEl('li');
				li.createEl('strong', { text: 'Creation templates: ' });
				li.appendText('Create new notes and save them based on the template name. For example, "A-Inbox-Ideas" will create a new note in A/Inbox/Ideas/ folder (the plugin creates folders automatically if needed).');
			}
			{
				const li = typesList.createEl('li');
				li.createEl('strong', { text: 'Insertion templates: ' });
				li.appendText('Insert text and links to vault notes in specific places within target files. The template prefix (default "Content-to-") determines insertion templates. For example, "Content-to-D-YouTube Channel-Build Better Habits" inserts content into "Build Better Habits.md" in D/YouTube Channel/ (created automatically if needed).');
			}

			// Step 3
			const step3 = body.createEl('div', { cls: 'abcs-help-step' });
			step3.createEl('strong', { text: '3. Creation template structure' });
			step3.createEl('p', { text: 'Open a creation template example to see how to structure it. Values like {{VALUE:The permanent note}} prompt the user to enter information. Any phrase after "VALUE:" will be displayed as the prompt.' });

			// Step 4
			const step4 = body.createEl('div', { cls: 'abcs-help-step' });
			step4.createEl('strong', { text: '4. Insertion template structure' });
			step4.createEl('p', { text: 'Open an insertion template example to see how to structure it. Use numbered headings to define project phases and sub-phases. During work, your notes will be inserted under the selected heading in the target file.' });
			
			const exampleCode = step4.createEl('pre');
			exampleCode.setText('# 1 Choosing a channel name\n## 1.1 Search for similar channels\n# 2 Choosing topics for the channel\n## 2.1 Identify target audience');

			// Step 5
			const step5 = body.createEl('div', { cls: 'abcs-help-step' });
			step5.createEl('strong', { text: '5. Template naming conventions' });
			const namingList = step5.createEl('ul');
			namingList.createEl('li', { text: 'Creation templates: [Letter]-[Folder]-[Subfolder] (e.g., "A-Inbox-Ideas")' });
			namingList.createEl('li', { text: 'Insertion templates: [Prefix]-[Folder]-[Subfolder]-[Filename] (e.g., "Content-to-D-Projects-MyProject")' });

			// Final tip
			const tip = body.createEl('p');
			tip.createEl('em', { text: 'Tip: You can customize pipelines and their prefixes in the Pipeline Configuration section above. Each pipeline can have its own prefix and target path pattern.' });

			// ===== Support links =====
			const support = containerEl.createDiv({ cls: 'abcs-support-settings' });
			new Setting(support)
				.setName('Support')
				.setHeading();
			const supportP = support.createEl('p');
			supportP.appendText('If this plugin helps you, you can support development via ');
			const sponsorLink = supportP.createEl('a', { text: 'GitHub Sponsors' });
			sponsorLink.setAttr('href', 'https://github.com/sponsors/waheed11');
			sponsorLink.setAttr('target', '_blank');
			sponsorLink.setAttr('rel', 'noopener');
			supportP.appendText(' or ');
			const coffeeLink = supportP.createEl('a', { text: 'Buy Me a Coffee' });
			coffeeLink.setAttr('href', 'https://buymeacoffee.com/waheed11');
			coffeeLink.setAttr('target', '_blank');
			coffeeLink.setAttr('rel', 'noopener');
			supportP.appendText('.');

		}

	}

}
