import { App, PluginSettingTab, Setting, Notice  } from 'obsidian';

export class ABCsSettingTab extends PluginSettingTab {
	plugin: any; // Will be properly typed when we refactor the main plugin
	constructor(app: App, plugin: any) {
		super(app, plugin);
		this.plugin = plugin;
	}

		display(): void {
			const { containerEl } = this;
			containerEl.empty();
			// RTL + i18n
			const isArabic = (() => {
				try { const p = (this.app as any).plugins?.plugins?.['abcs-of-control']; return p?.settings?.language === 'arabic'; } catch { return false; }
			})();
			const t = (en: string, ar: string) => isArabic ? ar : en;
			containerEl.setAttr('dir', isArabic ? 'rtl' : 'ltr');
			containerEl.createEl('h2', { text: t('ABCs of Control Settings', 'إعدادات أبجديات التحكم') });

		new Setting(containerEl)
			.setName(t('Template Folder Path', 'مسار مجلد القوالب'))
			.setDesc(t('Path to the folder containing your templates', 'المسار إلى المجلد الذي يحتوي على قوالبك'))
			.addText(text => text
				.setPlaceholder(t('C/Templates', 'ت/القوالب'))
				.setValue(isArabic ? 'ت/القوالب' : 'C/Templates')
				.setDisabled(true));

		new Setting(containerEl)
			.setName(t('Default Highlight Color', 'لون التحديد الافتراضي'))
			.setDesc(t('Default Color for text highlighting', 'اللون الافتراضي لتحديد النص'))
			.addDropdown(dropdown => dropdown
				.addOption('yellow', t('Yellow', 'أصفر'))
				.addOption('green', t('Green', 'أخضر'))
				.addOption('red', t('Red', 'أحمر'))
				.addOption('blue', t('Blue', 'أزرق'))
				.addOption('gray', t('Gray', 'رمادي'))
				.setValue(this.plugin.settings.defaultHighlightColor)
				.onChange(async (value) => {
					this.plugin.settings.defaultHighlightColor = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t('Default Language', 'اللغة الافتراضية'))
			.setDesc(t('Default language for section headers', 'اللغة الافتراضية لعناوين الأقسام'))
			.addDropdown(dropdown => dropdown
				.addOption('english', t('English', 'الإنجليزية'))
				.addOption('arabic', t('Arabic', 'العربية'))
				.setValue(this.plugin.settings.language || 'english')
				.onChange(async (value) => {
					this.plugin.settings.language = value;
					await this.plugin.saveSettings();
					// Apply setup immediately (seed templates, adjust prefixes) without reload
					await this.plugin.applyLanguageSetup();
					// Refresh UI to reflect any language-specific labels (if added later)
					this.display();
				}));

		// Quick action: Apply Arabic Setup explicitly without manual dropdown change
		new Setting(containerEl)
			.setName(t('Apply Arabic Setup', 'تطبيق الإعداد العربي'))
			.setDesc(t('Set language to Arabic, ensure Arabic folders, seed templates if missing, and sync prefixes. No reload needed.', 'تعيين اللغة إلى العربية، وإنشاء المجلدات العربية، وأمثلة القوالب، ومزامنة البادئات. بدون إعادة التحميل.'))
			.addButton(btn => {
				btn.setButtonText(t('Apply Arabic Setup', 'تطبيق الإعداد العربي'))
					.setCta()
					.onClick(async () => {
						this.plugin.settings.language = 'arabic';
						await this.plugin.saveSettings();
						await this.plugin.applyLanguageSetup();
						this.display();
					});
			});

		// ---- Role Folder Configuration ----
		containerEl.createEl('h3', { text: t('Role Folder Mapping', 'تعيين مجلدات الأدوار') });
		containerEl.createEl('p', { 
			text: t('Configure which folders in your vault correspond to each ABC role. C is fixed at C/Templates.', 'اضبط المجلدات التي تطابق كل دور من أدوار ABC. مجلد C ثابت عند ت/القوالب.'),
			cls: 'setting-item-description'
		});

		const phase0 = this.plugin.settings?.abcsPhase0;
		if (phase0) {
			const prof = phase0.profiles.find((p: any) => p.id === phase0.activeProfile) || phase0.profiles[0];

			// Info: C/Templates is fixed
			new Setting(containerEl)
				.setDesc(t('Templates folder location (fixed, cannot be changed)', 'موقع مجلد القوالب (ثابت وغير قابل للتغيير)'))
				.addText(text => text
					.setValue(isArabic ? 'ت/القوالب' : 'C/Templates')
					.setDisabled(true));

			// E (Archive) - Single folder (read-only, hardcoded in the plugin)
			new Setting(containerEl)
				.setName(t('E (Archive)', 'ج (الأرشيف)'))
				.setDesc(t('Archive folder location (fixed, cannot be changed)', 'موقع مجلد الأرشيف (ثابت وغير قابل للتغيير)'))
				.addText(text => text
					.setValue(isArabic ? 'ج/الارشيف' : 'E/Archive')
					.setDisabled(true));

			// A Folders - Multi-line textarea
			new Setting(containerEl)
				.setName(t('A Folders (Permanent Notes)', 'مجلدات أ (ملاحظات دائمة)'))
				.setDesc(t('One folder path per line. Examples: A, Permanent, Reference', 'مسار مجلد واحد في كل سطر. أمثلة: أ، دائم، مرجع'))
				.addTextArea(text => {
					const currentA = prof?.roles?.A || ['A'];
					const displayA = isArabic ? currentA.map((v: string) => (v === 'A' ? 'أ' : v)) : currentA;
					text
						.setPlaceholder(isArabic ? 'أ\nدائم\nمرجع' : 'A\nPermanent\nReference')
						.setValue(displayA.join('\n'))
						.onChange(async (value) => {
							const lines = value.split('\n')
								.map(l => l.trim())
								.filter(l => l.length > 0);
							if (!phase0.profiles) return;
							const profEdit = phase0.profiles.find((x: any) => x.id === phase0.activeProfile) || phase0.profiles[0];
							if (profEdit) {
								profEdit.roles.A = lines.length > 0 ? lines : ['A'];
								await this.plugin.saveSettings();
								new Notice(t('A folders updated. Reload plugin to apply.', 'تم تحديث مجلدات أ. أعد تحميل الإضافة للتطبيق.'));
							}
						});
					(text.inputEl as HTMLTextAreaElement).rows = 4;
					text.inputEl.classList.add('abcs-full-width');
				});

			new Setting(containerEl)
				.setName(t('B Folders (Literature Notes)', 'مجلدات ب (ملاحظات أدبية)'))
				.setDesc(t('One folder path per line. Examples: B, Literature, Meetings', 'مسار مجلد واحد في كل سطر. أمثلة: ب، أدب، اجتماعات'))
				.addTextArea(text => {
					const currentB = prof?.roles?.B || ['B'];
					const displayB = isArabic ? currentB.map((v: string) => (v === 'B' ? 'ب' : v)) : currentB;
					text
						.setPlaceholder(isArabic ? 'ب\nأدب\nاجتماعات' : 'B\nLiterature\nMeetings')
						.setValue(displayB.join('\n'))
						.onChange(async (value) => {
							const lines = value.split('\n')
								.map(l => l.trim())
								.filter(l => l.length > 0);
							if (!phase0.profiles) return;
							const profEdit = phase0.profiles.find((x: any) => x.id === phase0.activeProfile) || phase0.profiles[0];
							if (profEdit) {
								profEdit.roles.B = lines.length > 0 ? lines : ['B'];
								await this.plugin.saveSettings();
								new Notice(t('B folders updated. Reload plugin to apply.', 'تم تحديث مجلدات ب. أعد تحميل الإضافة للتطبيق.'));
							}
						});
					(text.inputEl as HTMLTextAreaElement).rows = 4;
					text.inputEl.classList.add('abcs-full-width');
				});

			// D Folder - Read-only root for active work
			new Setting(containerEl)
				.setName(t('D Folder (Projects/Active Work)', 'مجلد ث (مشاريع/عمل نشط)'))
				.setDesc(t('The root folder for active work. Sub-folders (e.g., Projects, Exams) are managed by the pipelines below.', 'المجلد الجذر للعمل النشط. تُدار المجلدات الفرعية (مثل المشاريع والامتحانات) عبر خطوط التدفق أدناه.'))
				.addText(text => {
					text
						.setValue(isArabic ? 'ث' : 'D')
						.setDisabled(true);
				});
		}

		// ===== Pipeline Management Section =====
		if (phase0) {
			const prof = phase0.profiles.find((p: any) => p.id === phase0.activeProfile) || phase0.profiles[0];
			containerEl.createEl('h3', { text: t('Pipeline Configuration', 'إعدادات خطوط التدفق') });
			containerEl.createEl('p', { 
				text: t('Pipelines define how content flows from templates to target files. Configure template prefixes.', 'تحدد خطوط التدفق كيفية انتقال المحتوى من القوالب إلى الملفات الهدف. قم بإعداد بادئات القوالب.'),
				cls: 'setting-item-description'
			});

			const pipelines = prof?.pipelines || [];
			
			// Display each pipeline with edit/delete controls
			pipelines.forEach((p: any, index: number) => {
				const pipelineContainer = containerEl.createDiv({ cls: 'abcs-pipeline-container' });
				
				// Pipeline header with label and delete button
				const headerDiv = pipelineContainer.createDiv({ cls: 'abcs-pipeline-header' });
				const localizedTitle = (() => {
					if (!isArabic) return p.label || p.id;
					if (p.label === 'Content to D/Projects') return 'محتوى إلى ث/المشاريع';
					if (p.label === 'Tips to D/Exams') return 'نصائح إلى ث/الامتحانات';
					return p.label || p.id;
				})();
				headerDiv.createEl('h4', { text: localizedTitle, cls: 'abcs-pipeline-title' });
				
				// Delete button (only for non-default pipelines or if user wants to remove defaults)
				const deleteBtn = headerDiv.createEl('button', { 
					text: t('🗑️ Delete', '🗑️ حذف'),
					cls: 'mod-warning'
				});
				deleteBtn.onclick = async () => {
					const { confirmModal } = await import('./utils');
					const confirmed = await confirmModal(
						this.app,
						isArabic ? 'حذف خط التدفق' : 'Delete Pipeline',
						isArabic ? `حذف خط التدفق "${p.label}"؟ لا يمكن التراجع عن ذلك.` : `Delete pipeline "${p.label}"? This cannot be undone.`,
						isArabic ? 'حذف' : 'Delete',
						isArabic ? 'إلغاء' : 'Cancel'
					);
					
					if (!confirmed) return;
					
					const prof2 = phase0.profiles.find((p2: any) => p2.id === phase0.activeProfile) || phase0.profiles[0];
					if (prof2?.pipelines) {
						prof2.pipelines.splice(index, 1);
						await this.plugin.saveSettings();
						new Notice(isArabic ? `تم حذف خط التدفق "${p.label}". أعد تحميل الإضافة للتطبيق.` : `Pipeline "${p.label}" deleted. Reload plugin to apply.`);
						this.display(); // Refresh settings UI
					}
				};

				// Pipeline ID (read-only for reference)
				new Setting(pipelineContainer)
					.setName(t('Pipeline ID', 'معرف خط التدفق'))
					.setDesc(t('Unique identifier (auto-generated for new pipelines)', 'معرف فريد (يتم إنشاؤه تلقائيًا لخطوط التدفق الجديدة)'))
					.addText(t => {
						t.setValue(p.id);
						t.setDisabled(true);
					});

				// Label
				new Setting(pipelineContainer)
					.setName(t('Label', 'التسمية'))
					.setDesc(t('Display name for this pipeline', 'اسم العرض لهذا الخط'))
					.addText(t => {
						const defaultLabelEn = (p.id === 'content-to-d-projects') ? 'Content to D/Projects' : (p.id === 'tips-to-d-exams' ? 'Tips to D/Exams' : 'My Custom Pipeline');
						const defaultLabelAr = (p.id === 'content-to-d-projects') ? 'محتوى إلى ث/المشاريع' : (p.id === 'tips-to-d-exams' ? 'نصائح إلى ث/الامتحانات' : 'اسم العرض');
						t.setPlaceholder(isArabic ? defaultLabelAr : defaultLabelEn);
						// Show localized defaults if the label is one of our known defaults
						const localizedValue = (() => {
							if (!isArabic) return p.label || '';
							if (p.label === 'Content to D/Projects') return 'محتوى إلى ث/المشاريع';
							if (p.label === 'Tips to D/Exams') return 'نصائح إلى ث/الامتحانات';
							return p.label || '';
						})();
						t.setValue(localizedValue);
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
					.setName(t('Template Prefix', 'بادئة القالب'))
					.setDesc(isArabic
						? (p.id === 'tips-to-d-exams'
							? 'بادئة القالب لهذا الخط. المسار يأتي من اسم القالب. مثال: "نصائح-الى-" يطابق "نصائح-الى-ث-الامتحانات-WebDev"'
							: 'بادئة القالب لهذا الخط. المسار يأتي من اسم القالب. مثال: "محتوى-الى-" يطابق "محتوى-الى-ث-المشاريع-WebDev"')
						: (p.id === 'tips-to-d-exams'
							? 'Template prefix for this pipeline. Path comes from template name. Example: "Tips-to-" matches "Tips-to-D-Exams-WebDev"'
							: 'Template prefix for this pipeline. Path comes from template name. Example: "Content-to-" matches "Content-to-D-Projects-WebDev"'))
					.addText(t => {
						const placeholder = isArabic
							? (p.id === 'tips-to-d-exams' ? 'نصائح-الى-' : 'محتوى-الى-')
							: (p.id === 'tips-to-d-exams' ? 'Tips-to-' : 'Content-to-');
						t.setPlaceholder(placeholder);
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

			// Include Archive Folder Notes
				new Setting(pipelineContainer)
					.setName(t('Include Archive Folder Notes', 'تضمين ملاحظات مجلد الأرشيف'))
					.setDesc(t('Default setting for including archived notes in search', 'الإعداد الافتراضي لتضمين ملاحظات الأرشيف في البحث'))
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
				.setName(t('Add New Pipeline', 'إضافة خط تدفق جديد'))
				.setDesc(t('Create a custom pipeline with your own prefix and target path', 'أنشئ خط تدفق مخصصًا مع بادئة ومسار هدف خاصين بك'))
				.addButton(btn => {
					btn.setButtonText(t('➕ Add Pipeline', '➕ إضافة خط تدفق'))
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
							new Notice(t('New pipeline added! Configure it below.', 'تمت إضافة خط تدفق جديد! قم بإعداده أدناه.'));
							this.display(); // Refresh settings UI
						});
				});
			
			// Guidance: How to use template examples
			const help = containerEl.createEl('div', { cls: 'abcs-phase0-help' });
			help.createEl('h3', { text: t('How to Use Template Examples', 'كيفية استخدام أمثلة القوالب') });

			// Make a collapsible "details" section
			const details = help.createEl('details', { cls: 'abcs-help-details' });
			details.createEl('summary', { text: t('Template Examples Guide', 'دليل أمثلة القوالب') });

			const body = details.createEl('div', { cls: 'abcs-help-body' });
			
			// Introduction
			body.createEl('p', { 
				text: t('The plugin automatically creates example templates in C/Templates/Templates Examples/ to help you get started. Follow these steps to use them:', 'يقوم المكون الإضافي تلقائيًا بإنشاء أمثلة للقوالب في C/Templates/Templates Examples/ لمساعدتك على البدء. اتبع هذه الخطوات لاستخدامها:'),
				cls: 'abcs-help-intro'
			});

			// Step 1
			const step1 = body.createEl('div', { cls: 'abcs-help-step' });
			step1.createEl('strong', { text: t('1. Copy templates from examples folder', '1. انسخ القوالب من مجلد الأمثلة') });
			step1.createEl('p', { text: t('Copy any template from C/Templates/Templates Examples/ and place it in C/Templates/ to activate it.', 'انسخ أي قالب من C/Templates/Templates Examples/ وضعه في C/Templates/ لتفعيله.') });

			// Step 2
			const step2 = body.createEl('div', { cls: 'abcs-help-step' });
			step2.createEl('strong', { text: t('2. Understand the two types of templates', '2. افهم نوعي القوالب') });
			const typesList = step2.createEl('ul');
			{
				const li = typesList.createEl('li');
				li.createEl('strong', { text: t('Creation Templates: ', 'قوالب الإنشاء: ') });
				li.appendText(t('Create new notes and save them based on the template name. For example, "A-Inbox-Ideas" will create a new note in A/Inbox/Ideas/ folder (the plugin creates folders automatically if needed).', 'أنشئ ملاحظات جديدة واحفظها بناءً على اسم القالب. على سبيل المثال، "A-Inbox-Ideas" سيُنشئ ملاحظة جديدة في مجلد A/Inbox/Ideas/ (يقوم المكون الإضافي بإنشاء المجلدات تلقائيًا عند الحاجة).'));
			}
			{
				const li = typesList.createEl('li');
				li.createEl('strong', { text: t('Insertion Templates: ', 'قوالب الإدراج: ') });
				li.appendText(t('Insert text and links to vault notes in specific places within target files. The template prefix (default "Content-to-") determines insertion templates. For example, "Content-to-D-YouTube Channel-Build Better Habits" inserts content into "Build Better Habits.md" in D/YouTube Channel/ (created automatically if needed).', 'أدرج نصوصًا وروابط إلى ملاحظات الخزانة في أماكن محددة داخل الملفات الهدف. تحدد بادئة القالب (الافتراضية "Content-to-") قوالب الإدراج. مثال: "Content-to-D-YouTube Channel-Build Better Habits" يُدرج المحتوى في "Build Better Habits.md" ضمن D/YouTube Channel/ (يُنشأ تلقائيًا عند الحاجة).'));
			}

			// Step 3
			const step3 = body.createEl('div', { cls: 'abcs-help-step' });
			step3.createEl('strong', { text: t('3. Creation template structure', '3. بنية قالب الإنشاء') });
			step3.createEl('p', { text: t('Open a creation template example to see how to structure it. Values like {{VALUE:The permanent note}} prompt the user to enter information. Any phrase after "VALUE:" will be displayed as the prompt.', 'افتح مثالًا لقالب الإنشاء لمعرفة كيفية بنائه. القيم مثل {{VALUE:The permanent note}} تطلب من المستخدم إدخال المعلومات. أي عبارة بعد "VALUE:" ستظهر كرسالة الطلب.') });

			// Step 4
			const step4 = body.createEl('div', { cls: 'abcs-help-step' });
			step4.createEl('strong', { text: t('4. Insertion template structure', '4. بنية قالب الإدراج') });
			step4.createEl('p', { text: t('Open an insertion template example to see how to structure it. Use numbered headings to define project phases and sub-phases. During work, your notes will be inserted under the selected heading in the target file.', 'افتح مثالًا لقالب الإدراج لمعرفة كيفية بنائه. استخدم عناوين مرقمة لتعريف مراحل المشروع ومراحله الفرعية. أثناء العمل، سيتم إدراج ملاحظاتك تحت العنوان المحدد في الملف الهدف.') });
			
			const exampleCode = step4.createEl('pre');
			exampleCode.setText('# 1 Choosing a channel name\n## 1.1 Search for similar channels\n# 2 Choosing topics for the channel\n## 2.1 Identify target audience');

			// Step 5
			const step5 = body.createEl('div', { cls: 'abcs-help-step' });
			step5.createEl('strong', { text: t('5. Template naming conventions', '5. قواعد تسمية القوالب') });
			const namingList = step5.createEl('ul');
			namingList.createEl('li', { text: t('Creation templates: [Letter]-[Folder]-[Subfolder] (e.g., "A-Inbox-Ideas")', 'قوالب الإنشاء: [حرف]-[مجلد]-[مجلد فرعي] (مثال: "A-Inbox-Ideas")') });
			namingList.createEl('li', { text: t('Insertion templates: [Prefix]-[Folder]-[Subfolder]-[Filename] (e.g., "Content-to-D-Projects-MyProject")', 'قوالب الإدراج: [بادئة]-[مجلد]-[مجلد فرعي]-[اسم الملف] (مثال: "Content-to-D-Projects-MyProject")') });

			// Final tip
			const tip = body.createEl('p');
			tip.createEl('em', { text: t('Tip: You can customize pipelines and their prefixes in the Pipeline Configuration section above. Each pipeline can have its own prefix and target path pattern.', 'نصيحة: يمكنك تخصيص خطوط التدفق وبوادئها في قسم إعدادات خطوط التدفق أعلاه. يمكن لكل خط أن يكون له بادئة ونمط مسار هدف خاص.') });

			// ===== Support links =====
			const support = containerEl.createDiv({ cls: 'abcs-support-settings' });
			support.createEl('h3', { text: t('Support', 'الدعم') });
			const supportP = support.createEl('p');
			supportP.appendText(t('If this plugin helps you, you can support development via ', 'إذا كان هذا المكون الإضافي مفيدًا لك، يمكنك دعم التطوير عبر '));
			const sponsorLink = supportP.createEl('a', { text: 'GitHub Sponsors' });
			sponsorLink.setAttr('href', 'https://github.com/sponsors/waheed11');
			sponsorLink.setAttr('target', '_blank');
			sponsorLink.setAttr('rel', 'noopener');
			supportP.appendText(isArabic ? ' أو ' : ' or ');
			const coffeeLink = supportP.createEl('a', { text: 'Buy Me a Coffee' });
			coffeeLink.setAttr('href', 'https://buymeacoffee.com/waheed11');
			coffeeLink.setAttr('target', '_blank');
			coffeeLink.setAttr('rel', 'noopener');
			supportP.appendText(' .');

		}

	}

}
