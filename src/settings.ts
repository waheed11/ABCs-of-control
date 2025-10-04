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

		// ---- Read-only Phase 0 info (verification aid) ----
		containerEl.createEl('h3', { text: 'Diagnostics (Read-Only)' });
		if (phase0) {
			const prof = phase0.profiles.find((p: any) => p.id === phase0.activeProfile) || phase0.profiles[0];
			const box = containerEl.createDiv({ cls: 'abcs-phase0-box' });

			box.createEl('div', { text: `Active Profile: ${phase0.activeProfile}${prof?.label ? ` (${prof.label})` : ''}` });
			box.createEl('div', { text: `Safety: dryRun=${String(phase0.safety?.dryRun)}, confirmMoves=${String(phase0.safety?.confirmMoves)}` });

			// Roles mapping
			const rolesDetails = box.createEl('details', { attr: { open: '' } });
			rolesDetails.createEl('summary', { text: 'Roles mapping' });
			const rolesList = rolesDetails.createEl('ul');
			// Display role mappings
			const roleA = prof?.roles?.A || [];
			rolesList.createEl('li').setText(`A: ${roleA.length ? roleA.join(', ') : '—'}`);
			
			const roleB = prof?.roles?.B || [];
			rolesList.createEl('li').setText(`B: ${roleB.length ? roleB.join(', ') : '—'}`);
			
			// C is hardcoded
			rolesList.createEl('li').setText('C: C/Templates (fixed)');
			
			const roleD = prof?.roles?.D || [];
			rolesList.createEl('li').setText(`D: ${roleD.length ? roleD.join(', ') : '—'}`);
			
			const roleE = prof?.roles?.E || '';
			// Handle backward compatibility for E
			if (Array.isArray(roleE)) {
				rolesList.createEl('li').setText(`E: ${roleE.length ? roleE.join(', ') : '—'}`);
			} else {
				rolesList.createEl('li').setText(`E: ${roleE || '—'}`);
			}

			// ===== Pipeline Management Section =====
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
					.setDesc('Template files must start with this prefix (e.g., "Content-to-D-Projects-")')
					.addText(t => {
						t.setPlaceholder('Content-to-D-Projects-');
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
			
			// Guidance: how to prepare blueprint templates so insertion works properly
			const help = containerEl.createEl('div', { cls: 'abcs-phase0-help' });
			help.createEl('h3', { text: 'How to prepare your blueprint templates' });

			// Make a collapsible "details" section
			const details = help.createEl('details', { cls: 'abcs-help-details' });
			details.createEl('summary', { text: 'Blueprint template instructions' });

			const body = details.createEl('div', { cls: 'abcs-help-body' });
			body.createEl('p', { text: 'For each pipeline, create a template note that acts as the project blueprint. Use numbered headings to define the project phases and sub-phases. During work, your notes will be inserted under the selected heading in the target file (e.g., D/Projects/{project}/Content.md).' });

			const exampleTitle = body.createEl('p');
			exampleTitle.createEl('strong', { text: 'Example structure:' });

			const pre = body.createEl('pre');
			const raw = `
			# 1. Choosing a channel name
			## 1.1 Search for similar channels to suggest a name
			# 2. Choosing topics for the channel
			## 2.1 Identify the target audience
			## 2.2 Identify the interests of the target audience
			## 2.3 Identify a list of suggested names
			# 3. Preparing Programs and Hardware
			## 3.1 Researching the software and hardware used in the broadcast
			## 3.2 Purchasing equipment
			`;
			pre.setText(raw.split('\n').map(l => l.trimStart()).join('\n').trim());

			const rulesTitle = body.createEl('p');
			rulesTitle.createEl('strong', { text: 'Rules to follow:' });

			const ul = body.createEl('ul');
			ul.createEl('li', { text: 'Use numbered headings (e.g., 1, 1.1, 2, 2.1). This defines the order.' });
			ul.createEl('li', { text: 'Heading text must match exactly when selecting where to insert.' });
			ul.createEl('li', { text: 'If a selected heading does not exist yet, it will be created in the correct numeric position.' });
			ul.createEl('li', { text: 'Insertions go directly under the selected heading, stopping before the next heading.' });
			ul.createEl('li', { text: 'Keep your numbering consistent (use the same digit style throughout the template).' });

			const tip = body.createEl('p');
			tip.setText('You can adjust target file paths per pipeline in Phase 0 settings (read-only shown above). The modals use those configured paths when inserting.');
			}		
	}
}
