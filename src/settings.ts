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
		// ---- Read-only Phase 0 info (verification aid) ----
			const phase0 = this.plugin.settings?.abcsPhase0;
			if (phase0) {
			
			const prof = phase0.profiles.find((p: any) => p.id === phase0.activeProfile) || phase0.profiles[0];
			const box = containerEl.createDiv({ cls: 'abcs-phase0-box' });

			box.createEl('div', { text: `Active Profile: ${phase0.activeProfile}${prof?.label ? ` (${prof.label})` : ''}` });
			box.createEl('div', { text: `Safety: dryRun=${String(phase0.safety?.dryRun)}, confirmMoves=${String(phase0.safety?.confirmMoves)}` });

			// Roles mapping
			const rolesDetails = box.createEl('details', { attr: { open: '' } });
			rolesDetails.createEl('summary', { text: 'Roles mapping' });
			const rolesList = rolesDetails.createEl('ul');
			(['A','B','C','D','E'] as const).forEach((r) => {
				const li = rolesList.createEl('li');
				const arr = (prof?.roles?.[r] || []);
				li.setText(`${r}: ${arr.length ? arr.join(', ') : '—'}`);
			});

			// Pipelines
			const pipesDetails = box.createEl('details', { attr: { open: '' } });
			pipesDetails.createEl('summary', { text: 'Pipelines' });
			(prof?.pipelines || []).forEach((p: any) => {
				const card = pipesDetails.createEl('div', { cls: 'abcs-pipeline-card' });
				card.createEl('div', { text: `• ${p.label} (id=${p.id})` });
				card.createEl('div', { text: `  templatePrefix: ${p.templatePrefix}` });
				card.createEl('div', { text: `  targetPath: ${p.targetPath}` });
				card.createEl('div', { text: `  sources.roles: ${(p.sources?.roles || []).join(', ')}` });
				const s = p.search || prof?.defaults?.search;
				if (s) card.createEl('div', { text: `  includeArchive: ${String(s.includeArchive)}` });
				// Editable toggle: Include Archive Folder Notes (default for this pipeline)
				new Setting(card)
				.setName('Include Archive Folder Notes')
				.setDesc('Default for this pipeline. The modal checkbox will start with this value.')
				.addToggle(t => {
				const prof2 = phase0.profiles.find((p2: any) => p2.id === phase0.activeProfile) || phase0.profiles[0];
				const pipe2 = (prof2?.pipelines || []).find((x: any) => x.id === p.id);
				const current = Boolean(pipe2?.search?.includeArchive);
				t.setValue(current);
				t.onChange(async (val) => {
					const pPlugin = (this.app as any).plugins?.plugins?.['ABCs-of-control'];
					if (!pPlugin?.settings?.abcsPhase0) return;
					const s0 = pPlugin.settings.abcsPhase0;
					const profEdit = s0.profiles.find((x: any) => x.id === s0.activeProfile) || s0.profiles[0];
					const pipeEdit = (profEdit?.pipelines || []).find((x: any) => x.id === p.id);
					if (!pipeEdit) return;
					pipeEdit.search = pipeEdit.search || { includeArchive: false };
					pipeEdit.search.includeArchive = val;
					await pPlugin.saveSettings?.();
				});
			});
					// Editable: templatePrefix
					new Setting(card)
					.setName('Template Prefix')
					.setDesc('Must match the start of template file names for this pipeline')
					.addText(t => {
					const prof2 = phase0.profiles.find((p2:any)=>p2.id===phase0.activeProfile) || phase0.profiles[0];
					const pipe2 = (prof2?.pipelines||[]).find((x:any)=>x.id===p.id);
					t.setPlaceholder('Content-to-D-Projects-');
					t.setValue(pipe2?.templatePrefix ?? '');
					t.onChange(async (val) => {
						const plug = (this.app as any).plugins?.plugins?.['ABCs-of-control'];
						const root = plug?.settings?.abcsPhase0; if (!root) return;
						const profEdit = root.profiles.find((x:any)=>x.id===root.activeProfile) || root.profiles[0];
						const pipeEdit = (profEdit?.pipelines||[]).find((x:any)=>x.id===p.id);
						if (!pipeEdit) return;
						pipeEdit.templatePrefix = val.trim();
						await plug.saveSettings?.();
					});
					});

					// Editable: targetPath
					new Setting(card)
					.setName('Target Path Pattern')
					.setDesc('Use placeholders like {project} or {exam}, e.g., D/Projects/{project}/Content.md')
					.addText(t => {
					const prof2 = phase0.profiles.find((p2:any)=>p2.id===phase0.activeProfile) || phase0.profiles[0];
					const pipe2 = (prof2?.pipelines||[]).find((x:any)=>x.id===p.id);
					t.setPlaceholder('D/Projects/{project}/Content.md');
					t.setValue(pipe2?.targetPath ?? '');
					t.onChange(async (val) => {
						// basic validation
						const trimmed = val.trim();
						if (!trimmed) return;

						// Optional: validate placeholder presence based on pipeline id
						const needs = p.id === 'content-to-d-projects' ? '{project}' :
									p.id === 'tips-to-d-exams' ? '{exam}' : null;
						if (needs && !trimmed.includes(needs)) {
						new Notice(`Target path should include ${needs} for this pipeline.`);
						// do not block save, but warn
						}

						const plug = (this.app as any).plugins?.plugins?.['ABCs-of-control'];
						const root = plug?.settings?.abcsPhase0; if (!root) return;
						const profEdit = root.profiles.find((x:any)=>x.id===root.activeProfile) || root.profiles[0];
						const pipeEdit = (profEdit?.pipelines||[]).find((x:any)=>x.id===p.id);
						if (!pipeEdit) return;
						pipeEdit.targetPath = trimmed;
						await plug.saveSettings?.();
					});
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
