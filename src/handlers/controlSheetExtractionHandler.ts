import { App, TFile, normalizePath, Notice } from 'obsidian';
import { ensureFolderExists, ensureUnderRole, parseSection, compareSection } from '../utils';

interface ExtractionNotePlan {
	path: string;
	filename: string;
	fullPath: string;
	content: string;
}

interface ExtractionTemplatePlan {
	fullPath: string;
	content: string;
}

interface CSheetConfig {
	intentionsPath?: string;
	intentionName?: string;
	infoPath?: string;
	infoName?: string;
	conceptsBasePath?: string;
	projectsPath?: string;
}

export interface ControlSheetExtractionPlan {
	sheetFile: TFile;
	cNote: ExtractionNotePlan;
	bNote: ExtractionNotePlan;
	aNotes: ExtractionNotePlan[];
	dTemplates: ExtractionTemplatePlan[];
	dNotes: ExtractionNotePlan[];
}

export class ControlSheetExtractionHandler {
	private app: App;
	private dTocEntries: { projectIndex: number; section: string; conceptName: string }[] = [];

	constructor(app: App) {
		this.app = app;
	}

	async buildPlan(sheetFile: TFile): Promise<ControlSheetExtractionPlan> {
		const raw = await this.app.vault.read(sheetFile);
		const normalized = raw.replace(/\r\n/g, '\n');
		const tags = this.extractTagsFromFrontmatter(normalized);
		const cSheetConfig = this.extractCSheetConfig(normalized);
		const withoutFrontmatter = this.stripFrontmatter(normalized);
		const lines = withoutFrontmatter.split('\n');
		const sections = this.splitSections(lines);
		// Reset D table-of-contents entries for this run
		this.dTocEntries = [];
		if (sections.C.length === 0 || sections.B.length === 0 || sections.D.length === 0) {
			throw new Error('Control sheet is missing C, B, or D sections');
		}
		const cNoteBase = this.buildCNotePlan(sections.C, cSheetConfig);
		const bNoteBase = this.buildBNotePlan(sections.B, cSheetConfig);
		const aNotesBase = this.buildANotePlans(sections.B, cSheetConfig);
		if (aNotesBase.length === 0) {
			new Notice('No concepts were detected in the B/Concepts section; A notes will not be created');
		}
		const dPlansBase = this.buildDPlans(sections.D, cSheetConfig);
		// Apply tags from the control sheet frontmatter to all extracted notes/templates
		const cNote = this.applyTagsToNotePlan(cNoteBase, tags);
		const bNote = this.applyTagsToNotePlan(bNoteBase, tags);
		const aNotes = aNotesBase.map(a => this.applyTagsToNotePlan(a, tags));
		const dTemplates = dPlansBase.templates.map(t => this.applyTagsToTemplatePlan(t, tags));
		const dNotes = dPlansBase.notes.map(n => this.applyTagsToNotePlan(n, tags));
		return {
			sheetFile,
			cNote,
			bNote,
			aNotes,
			dTemplates,
			dNotes,
		};
	}

	async executePlan(plan: ControlSheetExtractionPlan): Promise<void> {
		ensureUnderRole(this.app, 'C', plan.cNote.path);
		ensureUnderRole(this.app, 'B', plan.bNote.path);
		for (const a of plan.aNotes) {
			ensureUnderRole(this.app, 'A', a.path);
		}
		// Ensure all D notes live under a D path
		const dPaths = new Set<string>();
		for (const d of plan.dNotes) {
			if (!dPaths.has(d.path)) {
				dPaths.add(d.path);
				ensureUnderRole(this.app, 'D', d.path);
			}
		}
		const created: string[] = [];
		const skipped: string[] = [];
		const createFile = async (p: ExtractionNotePlan | ExtractionTemplatePlan) => {
			const targetPath = 'path' in p ? p.fullPath : p.fullPath;
			const existing = this.app.vault.getAbstractFileByPath(targetPath);
			let finalPath = targetPath;
			if (existing) {
				finalPath = this.generateUniqueFilePath(targetPath);
				skipped.push(targetPath);
			}
			const folderPath = finalPath.split('/').slice(0, -1).join('/');
			if (folderPath) {
				await ensureFolderExists(this.app, folderPath);
			}
			await this.app.vault.create(finalPath, p.content);
			created.push(finalPath);
		};
		await createFile(plan.cNote);
		await createFile(plan.bNote);
		for (const a of plan.aNotes) {
			await createFile(a);
		}
		for (let idx = 0; idx < plan.dTemplates.length; idx++) {
			const t = plan.dTemplates[idx];
			const d = plan.dNotes[idx];
			const existingD = this.app.vault.getAbstractFileByPath(d.fullPath);
			if (existingD && existingD instanceof TFile) {
				// D project already exists: do not create a template in C/Templates for it
				continue;
			}
			await createFile(t);
		}
		for (let idx = 0; idx < plan.dNotes.length; idx++) {
			const d = plan.dNotes[idx];
			const targetPath = d.fullPath;
			const existing = this.app.vault.getAbstractFileByPath(targetPath);
			if (existing && existing instanceof TFile) {
				const updated = await this.updateExistingDProjectNote(existing, idx, d.content);
				if (updated) {
					created.push(targetPath);
				}
				continue;
			}
			await createFile(d);
		}
		const totalNotes = 2 + plan.aNotes.length + plan.dTemplates.length + plan.dNotes.length; // C note, B note, all A notes, all D templates, all D notes
		new Notice(`Extracted ${totalNotes} note(s) from control sheet`);
		if (skipped.length > 0) {
			console.warn('Some target files already existed and were duplicated with unique names:', skipped);
		}
	}

	async executeUpdatePlan(plan: ControlSheetExtractionPlan): Promise<void> {
		ensureUnderRole(this.app, 'C', plan.cNote.path);
		ensureUnderRole(this.app, 'B', plan.bNote.path);
		for (const a of plan.aNotes) {
			ensureUnderRole(this.app, 'A', a.path);
		}
		const dPaths = new Set<string>();
		for (const d of plan.dNotes) {
			if (!dPaths.has(d.path)) {
				dPaths.add(d.path);
				ensureUnderRole(this.app, 'D', d.path);
			}
		}
		const created: string[] = [];
		const updated: string[] = [];
		const upsertNote = async (p: ExtractionNotePlan): Promise<void> => {
			const targetPath = p.fullPath;
			const existing = this.app.vault.getAbstractFileByPath(targetPath);
			const folderPath = targetPath.split('/').slice(0, -1).join('/');
			if (folderPath) {
				await ensureFolderExists(this.app, folderPath);
			}
			if (existing && existing instanceof TFile) {
				await this.app.vault.modify(existing, p.content);
				updated.push(targetPath);
			} else {
				await this.app.vault.create(targetPath, p.content);
				created.push(targetPath);
			}
		};
		const upsertTemplate = async (p: ExtractionTemplatePlan): Promise<void> => {
			const targetPath = p.fullPath;
			const existing = this.app.vault.getAbstractFileByPath(targetPath);
			const folderPath = targetPath.split('/').slice(0, -1).join('/');
			if (folderPath) {
				await ensureFolderExists(this.app, folderPath);
			}
			if (existing && existing instanceof TFile) {
				await this.app.vault.modify(existing, p.content);
				updated.push(targetPath);
			} else {
				await this.app.vault.create(targetPath, p.content);
				created.push(targetPath);
			}
		};
		await upsertNote(plan.cNote);
		await upsertNote(plan.bNote);
		for (const a of plan.aNotes) {
			await upsertNote(a);
		}
		for (let idx = 0; idx < plan.dTemplates.length; idx++) {
			const t = plan.dTemplates[idx];
			await upsertTemplate(t);
		}
		for (let idx = 0; idx < plan.dNotes.length; idx++) {
			const d = plan.dNotes[idx];
			const targetPath = d.fullPath;
			const existing = this.app.vault.getAbstractFileByPath(targetPath);
			if (existing && existing instanceof TFile) {
				const changed = await this.updateExistingDProjectNote(existing, idx, d.content);
				if (changed) {
					updated.push(targetPath);
				}
				continue;
			}
			await upsertNote(d);
		}
		const totalAffected = created.length + updated.length;
		new Notice(
			`Updated ${totalAffected} note(s) from control sheet (${created.length} created, ${updated.length} modified)`,
		);
	}

	buildSummary(plan: ControlSheetExtractionPlan): string {
		const lines: string[] = [];
		lines.push('We are going to create or update the following:');
		lines.push('');
		lines.push(`1 Note to ${plan.cNote.path}`);
		lines.push(`1 Note to ${plan.bNote.path}`);
		if (plan.aNotes.length > 0) {
			const counts = new Map<string, number>();
			for (const a of plan.aNotes) {
				counts.set(a.path, (counts.get(a.path) ?? 0) + 1);
			}
			for (const [path, count] of counts.entries()) {
				lines.push(`${count} Note${count !== 1 ? 's' : ''} to ${path}`);
			}
		}
		if (plan.dTemplates.length > 0) {
			const tCount = plan.dTemplates.length;
			lines.push(`${tCount} Note${tCount !== 1 ? 's' : ''} to C/Templates`);
		}
		if (plan.dNotes.length > 0) {
			const dCounts = new Map<string, number>();
			for (const d of plan.dNotes) {
				dCounts.set(d.path, (dCounts.get(d.path) ?? 0) + 1);
			}
			for (const [path, count] of dCounts.entries()) {
				lines.push(`${count} Note${count !== 1 ? 's' : ''} to ${path}`);
			}
		}
		return lines.join('\n');
	}

	buildUpdateSummary(plan: ControlSheetExtractionPlan): string {
		const lines: string[] = [];
		lines.push('This will re-sync all notes previously extracted from this control sheet.');
		lines.push('');
		lines.push('Notes in A, B, and C (and C/Templates) will be regenerated from the latest version of the control sheet.');
		lines.push('Existing D project notes will only receive new concept references based on Dn No. metadata (D1, D2, D3, ...); their other content is preserved.');
		return lines.join('\n');
	}

	private extractTagsFromFrontmatter(src: string): string[] {
		const result: string[] = [];
		if (!src.startsWith('---')) return result;
		const end = src.indexOf('\n---', 3);
		if (end === -1) return result;
		const fm = src.slice(3, end); // skip initial '---'
		const lines = fm.replace(/\r\n/g, '\n').split('\n');
		let inBlock = false;
		for (const rawLine of lines) {
			const line = rawLine.trim();
			if (!inBlock) {
				if (!line.toLowerCase().startsWith('tags:')) continue;
				const after = line.slice('tags:'.length).trim();
				if (after.startsWith('[') && after.endsWith(']')) {
					const inner = after.slice(1, -1);
					inner.split(',').forEach(part => {
						const tag = part.trim();
						if (tag) result.push(tag);
					});
					break;
				}
				if (after) {
					result.push(after);
					break;
				}
				// Multi-line block starting on following lines ("tags:" then "- tag")
				inBlock = true;
				continue;
			}
			if (!line.startsWith('- ')) break;
			const tag = line.slice(2).trim();
			if (tag) result.push(tag);
		}
		return result;
	}

	private extractCSheetConfig(src: string): CSheetConfig | undefined {
		const result: CSheetConfig = {};
		if (!src.startsWith('---')) return result;
		const end = src.indexOf('\n---', 3);
		if (end === -1) return result;
		const fm = src.slice(3, end); // skip initial '---'
		const lines = fm.replace(/\r\n/g, '\n').split('\n');
		let inBlock = false;
		for (const rawLine of lines) {
			const trimmed = rawLine.trimEnd();
			if (!inBlock) {
				if (/^abcs_csheet\s*:/i.test(trimmed)) {
					inBlock = true;
				}
				continue;
			}
			// Once inside abcs_csheet, consume indented key/value pairs until we
			// hit a non-indented line (next top-level field) or blank line.
			if (!/^\s+/.test(rawLine)) break;
			const m = /^\s+([A-Za-z0-9_]+)\s*:\s*(.*)$/.exec(rawLine);
			if (!m) continue;
			const key = m[1].trim() as keyof CSheetConfig;
			let value = (m[2] ?? '').trim();
			if (!value) continue;
			if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
				value = value.slice(1, -1);
			}
			(result as any)[key] = value;
		}
		return result;
	}

	private async updateExistingDProjectNote(
		file: TFile,
		projectIndex: number,
		latestProjectBody?: string,
	): Promise<boolean> {
		const projectToc = this.dTocEntries.filter(e => e.projectIndex === projectIndex);
		if (projectToc.length === 0) {
			return false;
		}
		const raw = await this.app.vault.read(file);
		const normalized = raw.replace(/\r\n/g, '\n');
		const splitFrontmatter = (src: string): { frontmatter: string; body: string } => {
			if (!src.startsWith('---')) return { frontmatter: '', body: src };
			const end = src.indexOf('\n---');
			if (end === -1) return { frontmatter: '', body: src };
			const after = src.indexOf('\n', end + 4);
			if (after === -1) {
				return { frontmatter: src.slice(0, end + 4) + '\n', body: src.slice(end + 4) };
			}
			return { frontmatter: src.slice(0, after + 1), body: src.slice(after + 1) };
		};
		const { frontmatter, body } = splitFrontmatter(normalized);
		const newEntries = projectToc.filter(entry => !this.bodyHasTocLine(body, entry.section, entry.conceptName));
		if (newEntries.length === 0) {
			return false;
		}
		newEntries.sort((a, b) => compareSection(parseSection(a.section), parseSection(b.section)));
		let bodyLines = body.replace(/^\n/, '').split('\n');
		if (latestProjectBody) {
			bodyLines = this.ensureHeadingsFromTemplate(bodyLines, latestProjectBody);
		}
		const updatedBodyLines = this.insertTocIntoBodyLines(bodyLines, newEntries);
		const updatedBody = updatedBodyLines.join('\n').trim();
		const newContent = frontmatter ? frontmatter + updatedBody : updatedBody;
		await this.app.vault.modify(file, newContent);
		return true;
	}

	private applyTagsToNotePlan(plan: ExtractionNotePlan, tags: string[]): ExtractionNotePlan {
		if (!tags.length) return plan;
		return {
			...plan,
			content: this.applyTagsToContent(plan.content, tags),
		};
	}

	private applyTagsToTemplatePlan(plan: ExtractionTemplatePlan, tags: string[]): ExtractionTemplatePlan {
		if (!tags.length) return plan;
		return {
			...plan,
			content: this.applyTagsToContent(plan.content, tags),
		};
	}

	private applyTagsToContent(content: string, tags: string[]): string {
		if (!tags.length) return content;
		const normalized = content.replace(/\r\n/g, '\n');
		const tagsBlock = ['tags:', ...tags.map(t => `  - ${t}`)].join('\n');
		if (!normalized.startsWith('---\n')) {
			// No frontmatter: create a simple frontmatter block with tags only
			return `---\n${tagsBlock}\n---\n${normalized.trimStart()}`;
		}
		// Has frontmatter: insert tags if not already present
		const end = normalized.indexOf('\n---', 4);
		if (end === -1) {
			// Malformed frontmatter; fallback to prepending
			return `---\n${tagsBlock}\n---\n${normalized.trimStart()}`;
		}
		const frontmatter = normalized.slice(0, end + 4); // includes closing \n---
		const body = normalized.slice(end + 4);
		if (/^tags\s*:/m.test(frontmatter)) {
			// Tags already present; do not override
			return normalized;
		}
		const beforeClosing = normalized.slice(0, end);
		const closing = normalized.slice(end, end + 4); // "\n---"
		const fmWithTags = `${beforeClosing}\n${tagsBlock}${closing}`;
		return fmWithTags + body;
	}

	private stripFrontmatter(src: string): string {
		if (!src.startsWith('---')) return src;
		const end = src.indexOf('\n---');
		if (end === -1) return src;
		const after = src.indexOf('\n', end + 4);
		if (after === -1) return src.slice(end + 4);
		return src.slice(after + 1);
	}

	private splitSections(lines: string[]): { C: string[]; B: string[]; D: string[] } {
		const sections = { C: [] as string[], B: [] as string[], D: [] as string[] };
		let current: keyof typeof sections | null = null;
		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed.startsWith('# C')) {
				current = 'C';
				continue;
			}
			if (trimmed.startsWith('# B')) {
				current = 'B';
				continue;
			}
			if (trimmed.startsWith('# D')) {
				current = 'D';
				continue;
			}
			if (current) {
				sections[current].push(line);
			}
		}
		return sections;
	}

	private buildCNotePlan(lines: string[], cfg?: CSheetConfig): ExtractionNotePlan {
		let path: string | undefined;
		let name: string | undefined;
		if (cfg?.intentionsPath && cfg?.intentionName) {
			path = cfg.intentionsPath;
			name = cfg.intentionName;
		}
		if (!path || !name) {
			const heading = lines.find(l => l.trim().startsWith('## '));
			if (!heading) {
				throw new Error('Could not find C section main heading');
			}
			const parsed = this.parsePathAndNameFromHeading(heading, '##');
			path = parsed.path;
			name = parsed.name;
		}
		const bodyLines = this.removeFirstHeadingLine(lines);
		const content = bodyLines.join('\n').trim();
		const fullPath = this.buildNoteFullPath(path, name);
		return { path, filename: name, fullPath, content };
	}

	private buildBNotePlan(lines: string[], cfg?: CSheetConfig): ExtractionNotePlan {
		let path: string | undefined;
		let name: string | undefined;
		if (cfg?.infoPath && cfg?.infoName) {
			path = cfg.infoPath;
			name = cfg.infoName;
		}
		if (!path || !name) {
			const heading = lines.find(l => l.trim().startsWith('## '));
			if (!heading) {
				throw new Error('Could not find B section main heading');
			}
			const parsed = this.parsePathAndNameFromHeading(heading, '##');
			path = parsed.path;
			name = parsed.name;
		}
		// Enhance B note by turning each extracted concept bullet into a wikilink
		// so that Obsidian links the B note to the corresponding A note.
		// Input bullets in the control sheet look like:
		//   - ==A/Permanent Notes/Some Concept==
		// We rewrite them in the B note as:
		//   - ==A/Permanent Notes/[[Some Concept]]==
		// leaving the original C-Sheet content untouched for parsing.
		const transformedLines = lines.map(line => {
			const detected = this.detectConceptPathFromLine(line, cfg?.conceptsBasePath);
			if (!detected) return line;
			const { indent, fullPathText } = detected;
			const resolved = this.resolveConceptBaseAndName(fullPathText, cfg?.conceptsBasePath);
			if (!resolved) return line;
			const { basePath, name: noteName } = resolved;
			if (!noteName) return line;
			// Anchor B-note links to the configured concepts base path when available,
			// so that they always point to the same folder as A notes.
			const cfgBase = cfg?.conceptsBasePath?.trim().replace(/\/+$/, '');
			const finalBase = cfgBase || basePath;
			const linked = finalBase ? `${finalBase}/[[${noteName}]]` : `[[${noteName}]]`;
			return `${indent}- ==${linked}==`;
		});
		const content = transformedLines.join('\n').trim();
		const fullPath = this.buildNoteFullPath(path, name);
		return { path, filename: name, fullPath, content };
	}

	private buildANotePlans(lines: string[], cfg?: CSheetConfig): ExtractionNotePlan[] {
		const result: ExtractionNotePlan[] = [];
		let i = 0;
		while (i < lines.length) {
			const line = lines[i];
			const detected = this.detectConceptPathFromLine(line, cfg?.conceptsBasePath);
			if (!detected) {
				i++;
				continue;
			}
			const fullPathText = detected.fullPathText.trim();
			const resolved = this.resolveConceptBaseAndName(fullPathText, cfg?.conceptsBasePath);
			if (!resolved || !resolved.basePath || !resolved.name) {
				i++;
				continue;
			}
			// If a conceptsBasePath is configured, always use it (plus any subfolders
			// under it) as the folder for A notes. This ensures A notes are created
			// under paths like A/Permanent Notes/Tests instead of collapsing to just
			// "A" or other roots.
			const cfgBase = cfg?.conceptsBasePath?.trim().replace(/\/+$/, '');
			let basePath = resolved.basePath;
			const name = resolved.name;
			if (cfgBase) {
				// If the resolved basePath is already under cfgBase, keep it; otherwise
				// anchor it directly to cfgBase.
				if (!basePath || !basePath.startsWith(cfgBase)) {
					basePath = cfgBase;
				}
			}
			const descLines: string[] = [];
			i++;
			while (i < lines.length) {
				const l2 = lines[i];
				const t2 = l2.trim();
				if (this.detectConceptPathFromLine(l2, cfg?.conceptsBasePath)) break;
				if (t2.startsWith('#')) break;
				if (t2 === '' && descLines.length === 0) {
					i++;
					continue;
				}
				if (l2.startsWith('  ')) {
					descLines.push(l2.slice(2));
				} else {
					descLines.push(l2);
				}
				i++;
			}
			const meta = this.extractConceptMetadata(descLines);
			const bodyLines = descLines.filter(l => !this.isConceptMetadataLine(l));
			const body = bodyLines.join('\n').trim();
			let content = body;
			const fmLines: string[] = [];
			if (meta.verified) {
				const v = meta.verified.trim().toLowerCase();
				let yamlValue = meta.verified.trim();
				if (v === 'y' || v === 'yes') yamlValue = 'Yes';
				else if (v === 'n' || v === 'no') yamlValue = 'No';
				fmLines.push(`verified: ${yamlValue}`);
			}
			if (meta.importance) {
				fmLines.push(`importance: "${meta.importance.trim()}"`);
			}
			if (meta.complexity) {
				fmLines.push(`complexity: "${meta.complexity.trim()}"`);
			}
			if (fmLines.length > 0) {
				const fm = fmLines.join('\n');
				content = `---\n${fm}\n---\n${body}`;
			}
			// Record D project table-of-contents entries if any Dn No. metadata is present
			if (meta.dRefs && meta.dRefs.length > 0 && name) {
				for (const ref of meta.dRefs) {
					this.dTocEntries.push({
						projectIndex: ref.projectIndex,
						section: ref.section,
						conceptName: name.trim(),
					});
				}
			}
			const fullPath = this.buildNoteFullPath(basePath, name);
			result.push({ path: basePath, filename: name, fullPath, content });
		}
		return result;
	}

	private extractConceptMetadata(lines: string[]): { verified?: string; importance?: string; complexity?: string; dRefs: { projectIndex: number; section: string }[] } {
		let verified: string | undefined;
		let importance: string | undefined;
		let complexity: string | undefined;
		const dRefs: { projectIndex: number; section: string }[] = [];
		for (const raw of lines) {
			const line = raw.trim();
			if (!verified) {
				const m = /^Is verified\?\(Y or N\)\s*:\s*(.+)\s*$/i.exec(line);
				if (m && m[1].trim()) {
					verified = m[1].trim();
					continue;
				}
			}
			if (!importance) {
				const m = /^Degree of importance\s*\(1-5\)\s*:\s*(.+)\s*$/i.exec(line);
				if (m && m[1].trim()) {
					importance = m[1].trim();
					continue;
				}
			}
			if (!complexity) {
				const m = /^Complexity\s*\(1-5\)\s*:\s*(.+)\s*$/i.exec(line);
				if (m && m[1].trim()) {
					complexity = m[1].trim();
					continue;
				}
			}
			const md = /^D(\d+)\s+No\.\s*:\s*(.+)\s*$/i.exec(line);
			if (md) {
				const proj = parseInt(md[1], 10);
				const sectionRaw = md[2].trim();
				if (!Number.isNaN(proj) && proj > 0 && sectionRaw) {
					// Take the first token as the section number (e.g. 4.4.2 from '4.4.2 something')
					const section = sectionRaw.split(/\s+/)[0];
					dRefs.push({ projectIndex: proj - 1, section });
				}
				continue;
			}
		}
		return { verified, importance, complexity, dRefs };
	}

	private isConceptMetadataLine(line: string): boolean {
		const trimmed = line.trim();
		if (trimmed === '') return false;
		if (/^Is verified\?\(Y or N\)\s*:/i.test(trimmed)) return true;
		if (/^Degree of importance\s*\(1-5\)\s*:/i.test(trimmed)) return true;
		if (/^Complexity\s*\(1-5\)\s*:/i.test(trimmed)) return true;
		if (/^D\d+\s+No\.\s*:/i.test(trimmed)) return true;
		if (/^Optional\s*:/i.test(trimmed)) return true;
		return false;
	}

	private detectConceptPathFromLine(
		line: string,
		conceptsBasePath?: string,
	): { indent: string; fullPathText: string } | null {
		// Capture leading indent and optional bullet, but not the bullet itself.
		const indentMatch = /^(\s*)(?:[-*]\s+)?(.*)$/.exec(line);
		const indent = indentMatch ? indentMatch[1] : '';
		let rest = indentMatch ? indentMatch[2] : line.trim();
		rest = rest.trim();
		// 1) Prefer the original ==A/...== highlight pattern when present. This
		// reliably captures the full concept path including the final name, and
		// avoids any truncation bugs from the config-based path scanning below.
		const legacyMatch = /^(?:-\s+)?==(.+)==\s*$/.exec(line.trim());
		if (legacyMatch) {
			const fullPathText = legacyMatch[1].trim();
			if (!fullPathText) return null;
			return { indent, fullPathText };
		}
		// 2) Otherwise, strip simple highlight wrappers like ==...== from the tail
		// and try to locate the configured concepts base path inside the line.
		if (/^==.+==\s*$/.test(rest)) {
			rest = rest.replace(/^==/, '').replace(/==\s*$/, '').trim();
		}
		// If we have a configured concepts base path, prefer a path-based match
		// that is resilient to formatting changes (extra markup, etc.).
		const base = conceptsBasePath ? conceptsBasePath.trim().replace(/\/+$/, '') : '';
		if (base) {
			const idx = rest.indexOf(base + '/');
			if (idx >= 0) {
				let pathPart = rest.slice(idx);
				const wsIdx = pathPart.search(/\s/);
				if (wsIdx >= 0) {
					pathPart = pathPart.slice(0, wsIdx);
				}
				const fullPathText = pathPart.trim();
				if (fullPathText) {
					return { indent, fullPathText };
				}
			}
		}
		return null;
	}

	private resolveConceptBaseAndName(
		fullPathText: string,
		conceptsBasePath?: string,
	): { basePath: string; name: string } | null {
		const text = fullPathText.trim();
		if (!text) return null;
		const cfgBase = conceptsBasePath ? conceptsBasePath.trim().replace(/\/+$/, '') : '';
		// If we have a configured concepts base path and the detected path is under it,
		// always anchor concepts to that base path so they don't accidentally end up
		// under plain "A" or some other folder.
		if (cfgBase && text.startsWith(cfgBase + '/')) {
			const suffix = text.slice(cfgBase.length + 1).trim();
			if (!suffix) return null;
			const parts = suffix.split('/');
			const name = (parts[parts.length - 1] || '').trim();
			if (!name) return null;
			const extra = parts.slice(0, -1).filter(s => s.trim().length > 0).join('/');
			const basePath = extra ? `${cfgBase}/${extra}` : cfgBase;
			return { basePath, name };
		}
		// Backward-compatible fallback when there is no config or the text does not
		// start with the configured base path: derive base + name purely from the
		// detected path text.
		const parts = text.split('/');
		if (parts.length < 2) {
			// No clear base path; we cannot safely place this concept.
			return null;
		}
		const name = (parts[parts.length - 1] || '').trim();
		const basePath = parts.slice(0, -1).join('/').trim();
		if (!name || !basePath) return null;
		return { basePath, name };
	}

	private buildDPlans(lines: string[], _cfg?: CSheetConfig): { templates: ExtractionTemplatePlan[]; notes: ExtractionNotePlan[] } {
		// Remove instructional helper lines from the D section
		const cleaned = lines.filter(l => !this.isDInstructionLine(l));
		// Treat every level-2 heading as the start of a project block.
		const projectIndices: number[] = [];
		for (let i = 0; i < cleaned.length; i++) {
			const trimmed = cleaned[i].trim();
			if (trimmed.startsWith('## ')) {
				projectIndices.push(i);
			}
		}
		if (projectIndices.length === 0) {
			throw new Error('Could not find D section main heading');
		}
		const templates: ExtractionTemplatePlan[] = [];
		const notes: ExtractionNotePlan[] = [];
		for (let idx = 0; idx < projectIndices.length; idx++) {
			const start = projectIndices[idx];
			const end = idx + 1 < projectIndices.length ? projectIndices[idx + 1] : cleaned.length;
			const block = cleaned.slice(start, end);
			const heading = block[0];
			const { path, name } = this.parsePathAndNameFromHeading(heading, '##');
			const projectsPath = this.normalizeProjectsPath(path);
			const projectName = name;
			const templateBase = this.buildContentToTemplateName(projectsPath, projectName);
			const templateFullPath = normalizePath(`C/Templates/${templateBase}.md`);
			const bodyLines = this.removeFirstHeadingLine(block);
			const headingLines = bodyLines.filter(l => l.trim().startsWith('#'));
			const headingsBlock = headingLines.join('\n').trim();
			const templateContent = `---\ntype: project\n---\n${headingsBlock ? headingsBlock + '\n' : ''}`;
			let noteLines = bodyLines.slice();
			// Insert table of contents entries (e.g. "4.4.2 [[Concept name]]") under their matching headings
			const projectToc = this.dTocEntries.filter(e => e.projectIndex === idx);
			if (projectToc.length > 0) {
				projectToc.sort((a, b) => compareSection(parseSection(a.section), parseSection(b.section)));
				noteLines = this.insertTocIntoBodyLines(bodyLines, projectToc);
			}
			const noteContent = noteLines.join('\n').trim();
			const noteFullPath = this.buildNoteFullPath(projectsPath, projectName);
			templates.push({ fullPath: templateFullPath, content: templateContent });
			notes.push({ path: projectsPath, filename: projectName, fullPath: noteFullPath, content: noteContent });
		}
		return { templates, notes };
	}

	private isDInstructionLine(line: string): boolean {
		const trimmed = line.trim();
		if (trimmed === '=========' || trimmed === '=========') return true;
		const lower = trimmed.toLowerCase();
		if (lower.startsWith('to add more project template')) return true;
		return false;
	}

	private bodyHasTocLine(body: string, section: string, conceptName: string): boolean {
		const target = `${section} [[${conceptName}]]`;
		const lines = body.replace(/\r\n/g, '\n').split('\n');
		for (const raw of lines) {
			if (raw.trim() === target) return true;
		}
		return false;
	}

	private insertTocIntoBodyLines(
		bodyLines: string[],
		projectToc: { projectIndex: number; section: string; conceptName: string }[],
	): string[] {
		// 1) Collect all headings with numeric prefixes and their depths
		const headingInfos: { lineIndex: number; parts: number[]; depth: number }[] = [];
		for (let i = 0; i < bodyLines.length; i++) {
			const trimmed = bodyLines[i].trim();
			if (!trimmed.startsWith('#')) continue;
			const m = /^#+/.exec(trimmed);
			if (!m) continue;
			const depth = m[0].length;
			const headingText = trimmed.slice(depth).trim();
			const parts = parseSection(headingText);
			if (parts.length === 0) continue;
			headingInfos.push({ lineIndex: i, parts, depth });
		}
		// 2) Assign each TOC entry to the most specific matching heading (longest numeric prefix)
		const entriesByHeading = new Map<number, { section: string; conceptName: string }[]>();
		const leftover: { section: string; conceptName: string }[] = [];
		for (const entry of projectToc) {
			const entryParts = parseSection(entry.section);
			if (entryParts.length === 0) {
				leftover.push({ section: entry.section, conceptName: entry.conceptName });
				continue;
			}
			let best: { lineIndex: number; parts: number[]; depth: number } | null = null;
			for (const h of headingInfos) {
				if (h.parts.length > entryParts.length) continue;
				let matches = true;
				for (let j = 0; j < h.parts.length; j++) {
					if (h.parts[j] !== entryParts[j]) {
						matches = false;
						break;
					}
				}
				if (!matches) continue;
				if (!best || h.parts.length > best.parts.length || (h.parts.length === best.parts.length && h.lineIndex > best.lineIndex)) {
					best = { lineIndex: h.lineIndex, parts: h.parts, depth: h.depth };
				}
			}
			if (best) {
				const arr = entriesByHeading.get(best.lineIndex) ?? [];
				arr.push({ section: entry.section, conceptName: entry.conceptName });
				entriesByHeading.set(best.lineIndex, arr);
			} else {
				leftover.push({ section: entry.section, conceptName: entry.conceptName });
			}
		}
		// 3) Compute insertion index (bottom of block) for each heading
		const insertMap = new Map<number, { section: string; conceptName: string }[]>();
		for (const h of headingInfos) {
			const assigned = entriesByHeading.get(h.lineIndex);
			if (!assigned || assigned.length === 0) continue;
			let insertAfter: number;
			const lastPart = h.parts[h.parts.length - 1];
			if (lastPart === 0) {
				// For headings like "8.0" or "1.0", place their TOC entries immediately
				// under the heading (before any subheadings like 8.1, 8.2, ...), so that
				// lines such as "8.0.1 [[...]]" stay with the 8.0 heading instead of being
				// pushed to the bottom of the entire 8.x block.
				let j = h.lineIndex + 1;
				while (j < bodyLines.length) {
					const t = bodyLines[j].trim();
					if (t.startsWith('#')) break; // stop before the first subheading
					j++;
				}
				insertAfter = Math.max(h.lineIndex, j - 1);
			} else {
				let j = h.lineIndex + 1;
				while (j < bodyLines.length) {
					const t = bodyLines[j].trim();
					if (t.startsWith('#')) {
						const m2 = /^#+/.exec(t);
						const depth2 = m2 ? m2[0].length : 0;
						if (depth2 <= h.depth) break; // next heading at same or higher level ends this block
					}
					j++;
				}
				insertAfter = Math.max(h.lineIndex, j - 1);
			}
			const existing = insertMap.get(insertAfter) ?? [];
			existing.push(...assigned);
			insertMap.set(insertAfter, existing);
		}
		// 4) Rebuild body lines, inserting assigned entries at the bottom of each heading block
		const result: string[] = [];
		for (let i = 0; i < bodyLines.length; i++) {
			result.push(bodyLines[i]);
			const assignedAtThisLine = insertMap.get(i);
			if (assignedAtThisLine && assignedAtThisLine.length > 0) {
				if (result.length > 0 && result[result.length - 1].trim() !== '') {
					result.push('');
				}
				for (const entry of assignedAtThisLine) {
					result.push(`${entry.section} [[${entry.conceptName}]]`);
				}
			}
		}
		// 5) Any remaining entries go at the very end of the note
		if (leftover.length > 0) {
			if (result.length > 0 && result[result.length - 1].trim() !== '') {
				result.push('');
			}
			for (const entry of leftover) {
				result.push(`${entry.section} [[${entry.conceptName}]]`);
			}
		}
		return result;
	}

	/**
	 * Ensure that all numeric headings present in the latest project body (from the
	 * control sheet D section) also exist in the current D project note. This lets
	 * us introduce new sections such as "8.12 ..." into an existing note while
	 * preserving any manual content the user has added.
	 */
	private ensureHeadingsFromTemplate(existingBodyLines: string[], latestProjectBody: string): string[] {
		const headingRegex = /^(#+)\s+(.+?)\s*$/;
		const result = existingBodyLines.slice();
		const hasHeading = new Set<string>();
		for (const line of result) {
			const m = headingRegex.exec(line.trim());
			if (!m) continue;
			const level = m[1].length;
			const text = m[2].trim();
			hasHeading.add(`${level}|${text}`);
		}
		const templateHeadings: { level: number; text: string; section: number[] }[] = [];
		for (const raw of latestProjectBody.replace(/\r\n/g, '\n').split('\n')) {
			const m = headingRegex.exec(raw.trim());
			if (!m) continue;
			const level = m[1].length;
			const text = m[2].trim();
			const section = parseSection(text);
			if (section.length === 0) continue;
			templateHeadings.push({ level, text, section });
		}
		// Process headings in the order they appear in the template; insertion
		// positions are still determined numerically using compareSection.
		for (const h of templateHeadings) {
			const key = `${h.level}|${h.text}`;
			if (hasHeading.has(key)) continue;
			const targetSection = h.section;
			let insertAt = result.length;
			if (targetSection.length > 0) {
				for (let i = 0; i < result.length; i++) {
					const line = result[i];
					const m = headingRegex.exec(line.trim());
					if (!m) continue;
					const text = m[2].trim();
					const section = parseSection(text);
					if (section.length === 0) continue;
					if (compareSection(targetSection, section) < 0) {
						insertAt = i;
						break;
					}
				}
			}
			const hashes = '#'.repeat(h.level);
			const headingLine = `${hashes} ${h.text}`;
			if (insertAt >= result.length) {
				if (result.length > 0 && result[result.length - 1].trim() !== '') {
					result.push('');
				}
				result.push(headingLine, '');
			} else {
				const toInsert: string[] = [];
				if (insertAt > 0 && result[insertAt - 1].trim() !== '') {
					toInsert.push('');
				}
				toInsert.push(headingLine, '');
				result.splice(insertAt, 0, ...toInsert);
			}
			hasHeading.add(key);
		}
		return result;
	}

	/**
	 * Normalize the projects path for D so that we get a clean D/... path.
	 * This avoids creating folders like Content/to/D/... when the heading contains
	 * implementation-specific prefixes.
	 */
	private normalizeProjectsPath(rawPath: string): string {
		let p = rawPath.replace(/\\/g, '/').trim();
		p = p.replace(/^\/+/, '').replace(/\/+$/, '');
		// If there is an explicit D/... segment anywhere, use that tail
		const dIndex = p.indexOf('D/');
		if (dIndex >= 0) {
			p = p.slice(dIndex);
		}
		return p || rawPath;
	}

	private buildContentToTemplateName(projectsPath: string, projectName: string): string {
		const safeProjectName = this.sanitizeName(projectName);
		const normalizedPath = projectsPath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
		const segments = normalizedPath.split('/').filter(s => s.length > 0);
		// Example: ['D', 'Projects'] -> 'D-Projects'
		const pathPart = segments.join('-');
		// Final template name e.g. 'Content-to-D-Projects-My Project'
		return ['Content-to', pathPart, safeProjectName].filter(s => s && s.length > 0).join('-');
	}

	private parsePathAndNameFromHeading(line: string, prefix: string): { path: string; name: string } {
		const text = line.trim().slice(prefix.length).trim();
		const parts = text.split('/');
		if (parts.length < 2) {
			const name = text.trim();
			return { path: text.trim(), name: name || 'Untitled' };
		}
		const name = parts[parts.length - 1].trim() || 'Untitled';
		const path = parts.slice(0, -1).join('/').trim();
		return { path, name };
	}

	/**
	 * Remove the first level-2 heading line (## ...) from a section's lines,
	 * so that note contents and templates don't repeat the path heading.
	 */
	private removeFirstHeadingLine(lines: string[]): string[] {
		let removed = false;
		const result: string[] = [];
		for (const line of lines) {
			const trimmed = line.trim();
			if (!removed && trimmed.startsWith('## ')) {
				removed = true;
				continue;
			}
			result.push(line);
		}
		return result;
	}

	private buildNoteFullPath(basePath: string, filename: string): string {
		const safeBase = basePath.replace(/\/+$/, '');
		const safeName = this.sanitizeName(filename);
		return normalizePath(`${safeBase}/${safeName}.md`);
	}

	private sanitizeName(name: string): string {
		const cleaned = name.replace(/[\\\/:*?"<>|]/g, '').trim();
		return cleaned || 'Untitled';
	}

	private generateUniqueFilePath(basePath: string): string {
		const withoutExt = basePath.replace(/\.md$/, '');
		let counter = 1;
		let candidate = basePath;
		while (this.app.vault.getAbstractFileByPath(candidate)) {
			candidate = `${withoutExt} (${counter}).md`;
			counter++;
		}
		return normalizePath(candidate);
	}
}
