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
		const withoutFrontmatter = this.stripFrontmatter(normalized);
		const lines = withoutFrontmatter.split('\n');
		const sections = this.splitSections(lines);
		// Reset D table-of-contents entries for this run
		this.dTocEntries = [];
		if (sections.C.length === 0 || sections.B.length === 0 || sections.D.length === 0) {
			throw new Error('Control sheet is missing C, B, or D sections');
		}
		const cNoteBase = this.buildCNotePlan(sections.C);
		const bNoteBase = this.buildBNotePlan(sections.B);
		const aNotesBase = this.buildANotePlans(sections.B);
		if (aNotesBase.length === 0) {
			new Notice('No concepts were detected in the B/Concepts section; A notes will not be created');
		}
		const dPlansBase = this.buildDPlans(sections.D);
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
		for (const t of plan.dTemplates) {
			await createFile(t);
		}
		for (const d of plan.dNotes) {
			await createFile(d);
		}
		const totalNotes = 2 + plan.aNotes.length + plan.dTemplates.length + plan.dNotes.length; // C note, B note, all A notes, all D templates, all D notes
		new Notice(`Extracted ${totalNotes} note(s) from control sheet`);
		if (skipped.length > 0) {
			console.warn('Some target files already existed and were duplicated with unique names:', skipped);
		}
	}

	buildSummary(plan: ControlSheetExtractionPlan): string {
		const lines: string[] = [];
		lines.push('We are going to extract the following:');
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

	private buildCNotePlan(lines: string[]): ExtractionNotePlan {
		const heading = lines.find(l => l.trim().startsWith('## '));
		if (!heading) {
			throw new Error('Could not find C section main heading');
		}
		const { path, name } = this.parsePathAndNameFromHeading(heading, '##');
		const bodyLines = this.removeFirstHeadingLine(lines);
		const content = bodyLines.join('\n').trim();
		const fullPath = this.buildNoteFullPath(path, name);
		return { path, filename: name, fullPath, content };
	}

	private buildBNotePlan(lines: string[]): ExtractionNotePlan {
		const heading = lines.find(l => l.trim().startsWith('## '));
		if (!heading) {
			throw new Error('Could not find B section main heading');
		}
		const { path, name } = this.parsePathAndNameFromHeading(heading, '##');
		// Enhance B note by turning each extracted concept bullet into a wikilink
		// so that Obsidian links the B note to the corresponding A note.
		// Input bullets in the control sheet look like:
		//   - ==A/Permanent Notes/Some Concept==
		// We rewrite them in the B note as:
		//   - ==A/Permanent Notes/[[Some Concept]]==
		// leaving the original C-Sheet content untouched for parsing.
		const transformedLines = lines.map(line => {
			const m = /^(\s*)-\s+==(.+)==\s*$/.exec(line);
			if (!m) return line;
			const indent = m[1] ?? '';
			const fullPathText = m[2].trim();
			if (!fullPathText) return line;
			const parts = fullPathText.split('/');
			const noteName = (parts[parts.length - 1] || fullPathText).trim();
			if (!noteName) return line;
			const basePath = parts.slice(0, -1).join('/');
			const linked = basePath ? `${basePath}/[[${noteName}]]` : `[[${noteName}]]`;
			return `${indent}- ==${linked}==`;
		});
		const content = transformedLines.join('\n').trim();
		const fullPath = this.buildNoteFullPath(path, name);
		return { path, filename: name, fullPath, content };
	}

	private buildANotePlans(lines: string[]): ExtractionNotePlan[] {
		const result: ExtractionNotePlan[] = [];
		let i = 0;
		while (i < lines.length) {
			const line = lines[i];
			const trimmed = line.trim();
			const m = /^-\s+==(.+)==\s*$/.exec(trimmed);
			if (!m) {
				i++;
				continue;
			}
			const fullPathText = m[1].trim();
			const parts = fullPathText.split('/');
			if (parts.length < 2) {
				i++;
				continue;
			}
			const name = parts[parts.length - 1];
			const basePath = parts.slice(0, -1).join('/');
			const descLines: string[] = [];
			i++;
			while (i < lines.length) {
				const l2 = lines[i];
				const t2 = l2.trim();
				if (/^-\s+==(.+)==\s*$/.test(t2)) break;
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

	private buildDPlans(lines: string[]): { templates: ExtractionTemplatePlan[]; notes: ExtractionNotePlan[] } {
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

	private insertTocIntoBodyLines(
		bodyLines: string[],
		projectToc: { projectIndex: number; section: string; conceptName: string }[],
	): string[] {
		// 1) Collect all headings with numeric prefixes
		const headingInfos: { lineIndex: number; parts: number[]; prefix: string }[] = [];
		for (let i = 0; i < bodyLines.length; i++) {
			const trimmed = bodyLines[i].trim();
			if (!trimmed.startsWith('#')) continue;
			const headingText = trimmed.replace(/^#+\s*/, '');
			const parts = parseSection(headingText);
			if (parts.length === 0) continue;
			headingInfos.push({ lineIndex: i, parts, prefix: parts.join('.') });
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
			let best: { lineIndex: number; parts: number[] } | null = null;
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
					best = { lineIndex: h.lineIndex, parts: h.parts };
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
		// 3) Rebuild body lines, inserting assigned entries after each heading
		const result: string[] = [];
		for (let i = 0; i < bodyLines.length; i++) {
			result.push(bodyLines[i]);
			const assigned = entriesByHeading.get(i);
			if (assigned && assigned.length > 0) {
				if (result.length > 0 && result[result.length - 1].trim() !== '') {
					result.push('');
				}
				for (const entry of assigned) {
					result.push(`${entry.section} [[${entry.conceptName}]]`);
				}
			}
		}
		// 4) Any remaining entries go at the end
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
