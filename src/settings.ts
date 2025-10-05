import { App, PluginSettingTab, Setting, Notice  } from 'obsidian';
import { MyPluginSettings } from './types';

export class ABCsSettingTab extends PluginSettingTab {
	plugin: any; // Will be properly typed when we refactor the main plugin

	constructor(app: App, plugin: any) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'ABCs of Control Settings' });

		new Setting(containerEl)
			.setName('Template Folder Path')
			.setDesc('Path to the folder containing your templates')
			.addText(text => text
				.setPlaceholder('C/Templates')
				.setValue(this.plugin.settings.templateFolderPath)
				.onChange(async (value) => {
					this.plugin.settings.templateFolderPath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Default Highlight Color')
			.setDesc('Default Color for text highlighting')
			.addDropdown(dropdown => dropdown
				.addOption('yellow', 'Yellow')
				.addOption('green', 'Green')
				.addOption('red', 'Red')
				.addOption('blue', 'Blue')
				.addOption('gray', 'Gray')
				.setValue(this.plugin.settings.defaultHighlightColor)
				.onChange(async (value) => {
					this.plugin.settings.defaultHighlightColor = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Default Language')
			.setDesc('Default language for section headers')
			.addDropdown(dropdown => dropdown
				.addOption('english', 'English')
				.addOption('arabic', 'Arabic')
				.setValue(this.plugin.settings.language || 'english')
				.onChange(async (value) => {
					this.plugin.settings.language = value;
					await this.plugin.saveSettings();
				}));

		// ---- Role Folder Configuration ----
		containerEl.createEl('h3', { text: 'Role Folder Mapping' });
		containerEl.createEl('p', { 
			text: 'Configure which folders in your vault correspond to each ABC role. C is fixed at C/Templates.',
			cls: 'setting-item-description'
		});

		const phase0 = this.plugin.settings?.abcsPhase0;
		if (phase0) {
			const prof = phase0.profiles.find((p: any) => p.id === phase0.activeProfile) || phase0.profiles[0];

			// Info: C/Templates is fixed
			new Setting(containerEl)
				.setDesc('Templates folder location (fixed, cannot be changed)')
				.addText(text => text
					.setValue('C/Templates')
					.setDisabled(true));

			// E (Archive) - Single folder (read-only, hardcoded in the plugin)
			new Setting(containerEl)
				.setName('E (Archive)')
				.setDesc('Archive folder location (fixed, cannot be changed)')
				.addText(text => text
					.setValue('E/Archive')
					.setDisabled(true));

			// A Folders - Multi-line textarea
			new Setting(containerEl)
				.setName('A Folders (Permanent Notes)')
				.setDesc('One folder path per line. Examples: A, Permanent, Reference')
				.addTextArea(text => {
					const currentA = prof?.roles?.A || ['A'];
					text
						.setPlaceholder('A\nPermanent\nReference')
						.setValue(currentA.join('\n'))
						.onChange(async (value) => {
							const lines = value.split('\n')
								.map(l => l.trim())
								.filter(l => l.length > 0);
							if (!phase0.profiles) return;
							const profEdit = phase0.profiles.find((x: any) => x.id === phase0.activeProfile) || phase0.profiles[0];
							if (profEdit) {
								profEdit.roles.A = lines.length > 0 ? lines : ['A'];
								await this.plugin.saveSettings();
								new Notice('A folders updated. Reload plugin to apply.');
							}
						});
					text.inputEl.rows = 4;
					text.inputEl.style.width = '100%';
				});

			// B Folders - Multi-line textarea
			new Setting(containerEl)
				.setName('B Folders (Literature Notes)')
				.setDesc('One folder path per line. Examples: B, Literature, Meetings')
				.addTextArea(text => {
					const currentB = prof?.roles?.B || ['B'];
					text
						.setPlaceholder('B\nLiterature\nMeetings')
						.setValue(currentB.join('\n'))
						.onChange(async (value) => {
							const lines = value.split('\n')
								.map(l => l.trim())
								.filter(l => l.length > 0);
							if (!phase0.profiles) return;
							const profEdit = phase0.profiles.find((x: any) => x.id === phase0.activeProfile) || phase0.profiles[0];
							if (profEdit) {
								profEdit.roles.B = lines.length > 0 ? lines : ['B'];
								await this.plugin.saveSettings();
								new Notice('B folders updated. Reload plugin to apply.');
							}
						});
					text.inputEl.rows = 4;
					text.inputEl.style.width = '100%';
				});

			// D Folder - Read-only root for active work
			new Setting(containerEl)
				.setName('D Folder (Projects/Active Work)')
				.setDesc('The root folder for active work. Sub-folders (e.g., Projects, Exams) are managed by the pipelines below.')
				.addText(text => {
					text
						.setValue('D/')
						.setDisabled(true);
				});
		}

		// ===== Pipeline Management Section =====
		if (phase0) {
			const prof = phase0.profiles.find((p: any) => p.id === phase0.activeProfile) || phase0.profiles[0];
			containerEl.createEl('h3', { text: 'Pipeline Configuration' });
			containerEl.createEl('p', { 
				text: 'Pipelines define how content flows from templates to target files. Configure template prefixes and target path patterns.',
				cls: 'setting-item-description'
			});

			const pipelines = prof?.pipelines || [];
			
			// Display each pipeline with edit/delete controls
			pipelines.forEach((p: any, index: number) => {
				const pipelineContainer = containerEl.createDiv({ cls: 'abcs-pipeline-container' });
				
				// Pipeline header with label and delete button
				const headerDiv = pipelineContainer.createDiv({ cls: 'abcs-pipeline-header' });
				headerDiv.createEl('h4', { text: `${p.label || p.id}`, cls: 'abcs-pipeline-title' });
				
				// Delete button (only for non-default pipelines or if user wants to remove defaults)
				const deleteBtn = headerDiv.createEl('button', { 
					text: '🗑️ Delete',
					cls: 'mod-warning'
				});
				deleteBtn.onclick = async () => {
					const { confirmModal } = await import('./utils');
					const confirmed = await confirmModal(
						this.app,
						'Delete Pipeline',
						`Delete pipeline "${p.label}"? This cannot be undone.`,
						'Delete',
						'Cancel'
					);
					
					if (!confirmed) return;
					
					const prof2 = phase0.profiles.find((p2: any) => p2.id === phase0.activeProfile) || phase0.profiles[0];
					if (prof2?.pipelines) {
						prof2.pipelines.splice(index, 1);
						await this.plugin.saveSettings();
						new Notice(`Pipeline "${p.label}" deleted. Reload plugin to apply.`);
						this.display(); // Refresh settings UI
					}
				};

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
						t.setPlaceholder('My Custom Pipeline');
						t.setValue(p.label || '');
						t.onChange(async (val) => {
							const prof2 = phase0.profiles.find((p2: any) => p2.id === phase0.activeProfile) || phase0.profiles[0];
							const pipe2 = (prof2?.pipelines || [])[index];
							if (pipe2) {
								pipe2.label = val.trim();
								await this.plugin.saveSettings();
							}
						});
					});

				// Template Prefix
				new Setting(pipelineContainer)
					.setName('Template Prefix')
					.setDesc('Template prefix for this pipeline. Path comes from template name. Example: "Content-to-" matches "Content-to-D-Projects-WebDev"')
					.addText(t => {
						t.setPlaceholder('Content-to-');
						t.setValue(p.templatePrefix || '');
						t.onChange(async (val) => {
							const prof2 = phase0.profiles.find((p2: any) => p2.id === phase0.activeProfile) || phase0.profiles[0];
							const pipe2 = (prof2?.pipelines || [])[index];
							if (pipe2) {
								pipe2.templatePrefix = val.trim();
								await this.plugin.saveSettings();
							}
						});
					});

							// Target Path Pattern (Read-Only)
			new Setting(pipelineContainer)
			.setName('Target Path Pattern (Not Used)')
			.setDesc('⚠️ This field is no longer used. File paths are now determined by template names in C/Templates. Format: "{prefix}-{folder}-{subfolder}-{filename}"')
			.addText(t => {
				t.setPlaceholder('Path from template name');
				t.setValue(p.targetPath || '');
				t.setDisabled(true);
			});

				// Include Archive Folder Notes
				new Setting(pipelineContainer)
					.setName('Include Archive Folder Notes')
					.setDesc('Default setting for including archived notes in search')
					.addToggle(t => {
						const current = Boolean(p.search?.includeArchive);
						t.setValue(current);
						t.onChange(async (val) => {
							const prof2 = phase0.profiles.find((p2: any) => p2.id === phase0.activeProfile) || phase0.profiles[0];
							const pipe2 = (prof2?.pipelines || [])[index];
							if (pipe2) {
								pipe2.search = pipe2.search || { includeArchive: false };
								pipe2.search.includeArchive = val;
								await this.plugin.saveSettings();
							}
						});
					});

				// Separator
				pipelineContainer.createEl('hr', { cls: 'abcs-pipeline-separator' });
			});

			// Add New Pipeline Button
			const addPipelineBtn = new Setting(containerEl)
				.setName('Add New Pipeline')
				.setDesc('Create a custom pipeline with your own prefix and target path')
				.addButton(btn => {
					btn.setButtonText('➕ Add Pipeline')
						.setCta()
						.onClick(async () => {
							const prof2 = phase0.profiles.find((p2: any) => p2.id === phase0.activeProfile) || phase0.profiles[0];
							if (!prof2) return;

							// Generate unique ID
							const timestamp = Date.now();
							const newId = `custom-pipeline-${timestamp}`;

							// Create new pipeline with defaults
							const newPipeline = {
								id: newId,
								label: 'New Pipeline',
								templatePrefix: 'My-Pipeline-',
								sources: { roles: ['A', 'B'] },
								targetPath: 'D/Projects/{project}/Notes.md',
								search: { includeArchive: false },
								ui: { keepModalOpen: true, resetAfterInsert: true },
							};

							prof2.pipelines = prof2.pipelines || [];
							prof2.pipelines.push(newPipeline);
							
							await this.plugin.saveSettings();
							new Notice('New pipeline added! Configure it below.');
							this.display(); // Refresh settings UI
						});
				});
			
			// Guidance: How to use template examples
			const help = containerEl.createEl('div', { cls: 'abcs-phase0-help' });
			help.createEl('h3', { text: 'How to Use Template Examples' });

			// Make a collapsible "details" section
			const details = help.createEl('details', { cls: 'abcs-help-details' });
			details.createEl('summary', { text: 'Template Examples Guide' });

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
			typesList.createEl('li').innerHTML = '<strong>Creation Templates:</strong> Create new notes and save them based on the template name. For example, "A-Inbox-Ideas" will create a new note in A/Inbox/Ideas/ folder (the plugin creates folders automatically if needed).';
			typesList.createEl('li').innerHTML = '<strong>Insertion Templates:</strong> Insert text and links to vault notes in specific places within target files. The template prefix (default "Content-to-") determines insertion templates. For example, "Content-to-D-YouTube Channel-Build Better Habits" inserts content into "Build Better Habits.md" in D/YouTube Channel/ (created automatically if needed).';

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
			support.createEl('h3', { text: 'Support' });
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
