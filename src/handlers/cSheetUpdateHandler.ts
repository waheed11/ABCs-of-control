import { App, TFile, Notice } from 'obsidian';
import { confirmModal } from '../utils';

type ConceptsJsonConcept = {
	name?: string;
	description?: string;
};

type ConceptsJsonGroup = {
	Part?: string;
	Chapter?: string | null;
	Concepts?: ConceptsJsonConcept[];
};

interface ExistingConceptInfo {
	name: string;
	bulletIndex: number;
	endIndex: number;
	bulletLine: string;
	descLines: string[];
	metaLines: string[];
}

export class CSheetUpdateHandler {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	async updateFromJson(sheetFile: TFile, jsonFile: TFile): Promise<void> {
		const rawJson = await this.app.vault.read(jsonFile);
		const groups = this.parseConceptsJsonFromMarkdown(rawJson);
		const totalConcepts = this.countConcepts(groups);
		if (!groups.length || totalConcepts === 0) {
			new Notice('No concepts found in selected JSON note');
			return;
		}

		const rawSheet = await this.app.vault.read(sheetFile);
		const normalized = rawSheet.replace(/\r\n/g, '\n');
		const { frontmatter, body } = this.splitFrontmatter(normalized);
		const bodyLines = body.split('\n');

		const conceptBulletRe = /^\s*-\s+==(.+)==\s*$/;
		let firstBulletIdx = -1;
		let firstBulletFullPath = '';
		for (let i = 0; i < bodyLines.length; i++) {
			const m = conceptBulletRe.exec(bodyLines[i].trim());
			if (m) {
				firstBulletIdx = i;
				firstBulletFullPath = m[1].trim();
				break;
			}
		}
		if (firstBulletIdx === -1 || !firstBulletFullPath) {
			new Notice('No concepts bullets found in selected C-Sheet');
			return;
		}
		const pathParts = firstBulletFullPath.split('/');
		const conceptsPathValue = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '';

		let conceptsHeaderIdx = -1;
		const headerText = conceptsPathValue ? `#### ${conceptsPathValue}` : '';
		if (headerText) {
			for (let i = 0; i < bodyLines.length; i++) {
				if (bodyLines[i].trim() === headerText) {
					conceptsHeaderIdx = i;
					break;
				}
			}
		}
		const conceptsStart = conceptsHeaderIdx >= 0 ? conceptsHeaderIdx + 1 : firstBulletIdx;
		let conceptsEnd = bodyLines.length;
		for (let i = conceptsStart; i < bodyLines.length; i++) {
			const trimmed = bodyLines[i].trim();
			if (trimmed.startsWith('#### ') && i > firstBulletIdx) {
				conceptsEnd = i;
				break;
			}
		}
		const conceptsSectionLines = bodyLines.slice(conceptsStart, conceptsEnd);
		const parsedExisting = this.parseExistingConcepts(conceptsSectionLines);
		const incomingByName = this.flattenConcepts(groups);
		const addedNames: string[] = [];
		const updatedNames: string[] = [];
		for (const [name, incoming] of incomingByName.entries()) {
			const info = parsedExisting.byName.get(name);
			const jsonDesc = (incoming.description || '').trim();
			if (!info) {
				if (jsonDesc !== '') {
					addedNames.push(name);
				}
				continue;
			}
			if (jsonDesc === '') {
				continue;
			}
			const oldDesc = info.descLines.join('\n').trim();
			if (jsonDesc !== '' && jsonDesc !== oldDesc) {
				updatedNames.push(name);
			}
		}

		const summaryLines: string[] = [];
		summaryLines.push(`C-Sheet: ${sheetFile.path}`);
		summaryLines.push(`JSON note: ${jsonFile.path}`);
		summaryLines.push(`Total JSON concepts: ${totalConcepts}`);
		summaryLines.push('Existing concepts not mentioned in JSON will be kept.');
		if (addedNames.length > 0) {
			summaryLines.push('');
			summaryLines.push(`Will add ${addedNames.length} new concept(s):`);
			const preview = addedNames.slice(0, 10).join(', ');
			summaryLines.push(preview);
			if (addedNames.length > 10) {
				summaryLines.push('...');
			}
		}
		if (updatedNames.length > 0) {
			summaryLines.push('');
			summaryLines.push(`Will update ${updatedNames.length} existing concept(s):`);
			const preview = updatedNames.slice(0, 10).join(', ');
			summaryLines.push(preview);
			if (updatedNames.length > 10) {
				summaryLines.push('...');
			}
		}
		if (addedNames.length === 0 && updatedNames.length === 0) {
			summaryLines.push('');
			summaryLines.push('No new or updated concepts detected.');
		}
		const confirmed = await confirmModal(
			this.app,
			'Update C-Sheet from JSON',
			summaryLines.join('\n'),
			'Update',
			'Cancel',
		);
		if (!confirmed) {
			return;
		}
		if (addedNames.length === 0 && updatedNames.length === 0) {
			new Notice('No changes applied to C-Sheet');
			return;
		}

		const updatedSection = this.rebuildConceptsSection(
			conceptsSectionLines,
			parsedExisting,
			incomingByName,
			new Set(updatedNames),
		);
		const addedSet = new Set(addedNames);
		const filteredGroups: ConceptsJsonGroup[] = [];
		for (const group of groups) {
			const concepts = Array.isArray(group.Concepts) ? group.Concepts : [];
			const kept = concepts.filter(c => {
				const n = c && typeof c.name === 'string' ? c.name.trim() : '';
				return n && addedSet.has(n);
			});
			if (kept.length === 0) continue;
			filteredGroups.push({ Part: group.Part, Chapter: group.Chapter, Concepts: kept });
		}
		if (filteredGroups.length > 0) {
			let initialLastPart: string | undefined;
			for (let i = conceptsSectionLines.length - 1; i >= 0; i--) {
				const t = conceptsSectionLines[i].trim();
				if (!t.startsWith('##### ')) continue;
				initialLastPart = t.slice(5).trim();
				break;
			}
			const appended = this.buildConceptsMarkdown(conceptsPathValue, filteredGroups, initialLastPart);
			if (appended.trim() !== '') {
				if (updatedSection.length > 0 && updatedSection[updatedSection.length - 1].trim() !== '') {
					updatedSection.push('');
				}
				for (const line of appended.split('\n')) {
					updatedSection.push(line);
				}
			}
		}
		const newBodyLines = [
			...bodyLines.slice(0, conceptsStart),
			...updatedSection,
			...bodyLines.slice(conceptsEnd),
		];
		const newBody = newBodyLines.join('\n');
		const newContent = frontmatter ? frontmatter + newBody : newBody;
		await this.app.vault.modify(sheetFile, newContent);
		new Notice('C-Sheet concepts updated from JSON');
	}

	private splitFrontmatter(src: string): { frontmatter: string; body: string } {
		if (!src.startsWith('---')) return { frontmatter: '', body: src };
		const end = src.indexOf('\n---');
		if (end === -1) return { frontmatter: '', body: src };
		const after = src.indexOf('\n', end + 4);
		if (after === -1) {
			return { frontmatter: src.slice(0, end + 4) + '\n', body: src.slice(end + 4) };
		}
		return { frontmatter: src.slice(0, after + 1), body: src.slice(after + 1) };
	}

	private parseExistingConcepts(lines: string[]): { byName: Map<string, ExistingConceptInfo>; ordered: ExistingConceptInfo[] } {
		const byName = new Map<string, ExistingConceptInfo>();
		const ordered: ExistingConceptInfo[] = [];
		const conceptLineRe = /^(\s*)(?:-\s+)?==(.+)==\s*$/;
		const isMetaLine = (trimmed: string): boolean => {
			if (!trimmed) return false;
			if (/^D\d+\s+No\.:/.test(trimmed)) return true;
			if (trimmed.startsWith('Optional:')) return true;
			if (trimmed.startsWith('Is verified?(Y or N):')) return true;
			if (trimmed.startsWith('Degree of importance (1-5):')) return true;
			if (trimmed.startsWith('Complexity (1-5):')) return true;
			return false;
		};
		let i = 0;
		while (i < lines.length) {
			const line = lines[i];
			const trimmed = line.trim();
			const m = conceptLineRe.exec(trimmed);
			if (!m) {
				i++;
				continue;
			}
			const fullPath = m[2].trim();
			const parts = fullPath.split('/');
			const name = (parts[parts.length - 1] || '').trim();
			if (!name) {
				i++;
				continue;
			}
			const bulletIndex = i;
			let j = i + 1;
			const descLines: string[] = [];
			const metaLines: string[] = [];
			while (j < lines.length) {
				const raw = lines[j];
				const t2 = raw.trim();
				if (conceptLineRe.test(t2) || t2.startsWith('#')) break;
				if (isMetaLine(t2)) {
					metaLines.push(raw);
				} else {
					if (metaLines.length === 0) {
						descLines.push(raw);
					} else {
						metaLines.push(raw);
					}
				}
				j++;
			}
			const endIndex = j - 1;
			const info: ExistingConceptInfo = {
				name,
				bulletIndex,
				endIndex,
				bulletLine: line,
				descLines,
				metaLines,
			};
			byName.set(name, info);
			ordered.push(info);
			i = j;
		}
		return { byName, ordered };
	}

	private rebuildConceptsSection(
		originalLines: string[],
		parsedExisting: { byName: Map<string, ExistingConceptInfo>; ordered: ExistingConceptInfo[] },
		incomingByName: Map<string, { description: string; group: ConceptsJsonGroup | null }>,
		updatedNames: Set<string>,
	): string[] {
		const result: string[] = [];
		const ordered = parsedExisting.ordered.slice().sort((a, b) => a.bulletIndex - b.bulletIndex);
		let i = 0;
		let idx = 0;
		while (i < originalLines.length) {
			const next = idx < ordered.length ? ordered[idx] : null;
			if (next && i === next.bulletIndex) {
				const name = next.name;
				const isUpdated = updatedNames.has(name);
				if (!isUpdated) {
					for (let k = next.bulletIndex; k <= next.endIndex; k++) {
						result.push(originalLines[k]);
					}
				} else {
					const incoming = incomingByName.get(name);
					const desc = (incoming?.description || '').trim();
					result.push(originalLines[next.bulletIndex]);
					if (desc) {
						const parts = desc.split('\n');
						for (const p of parts) {
							const t = p.trim();
							if (!t) continue;
							result.push(`  ${t}`);
						}
					}
					for (const ml of next.metaLines) {
						result.push(ml);
					}
				}
				i = next.endIndex + 1;
				idx++;
			} else {
				result.push(originalLines[i]);
				i++;
			}
		}
		return result;
	}

	private flattenConcepts(groups: ConceptsJsonGroup[]): Map<string, { description: string; group: ConceptsJsonGroup | null }> {
		const map = new Map<string, { description: string; group: ConceptsJsonGroup | null }>();
		for (const group of groups) {
			const concepts = Array.isArray(group.Concepts) ? group.Concepts : [];
			for (const concept of concepts) {
				if (!concept || typeof concept.name !== 'string') continue;
				const name = concept.name.trim();
				if (!name) continue;
				const description = typeof concept.description === 'string' ? concept.description : '';
				map.set(name, { description, group });
			}
		}
		return map;
	}

	private parseConceptsJsonFromMarkdown(raw: string): ConceptsJsonGroup[] {
		const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
		const match = codeBlockRegex.exec(raw);
		if (!match) return [];
		const jsonText = match[1].trim();
		if (jsonText === '') return [];
		try {
			const parsed = JSON.parse(jsonText);
			if (Array.isArray(parsed) && parsed.every(v => this.isConceptsJsonGroupShape(v))) {
				return parsed as ConceptsJsonGroup[];
			}
			return this.normalizeConceptGroups(parsed);
		} catch (e) {
			console.error('Failed to parse concepts JSON:', e);
			return [];
		}
	}

	private isConceptsJsonGroupShape(value: unknown): value is ConceptsJsonGroup {
		if (!value || typeof value !== 'object') return false;
		const obj = value as { [key: string]: unknown };
		if (!('Concepts' in obj)) return false;
		if ('Part' in obj && typeof obj.Part !== 'string') return false;
		if ('Chapter' in obj && obj.Chapter !== null && typeof obj.Chapter !== 'string') return false;
		const concepts = obj.Concepts;
		if (!Array.isArray(concepts)) return false;
		for (const c of concepts) {
			if (!c || typeof c !== 'object') return false;
			const cc = c as { [key: string]: unknown };
			if ('name' in cc && typeof cc.name !== 'string') return false;
			if ('description' in cc && typeof cc.description !== 'string') return false;
		}
		return true;
	}

	private normalizeConceptGroups(parsed: unknown): ConceptsJsonGroup[] {
		const collected: { headings: string[]; concept: ConceptsJsonConcept }[] = [];
		this.collectConceptsWithHeadings(parsed, [], collected);
		if (collected.length === 0) return [];
		const groupMap = new Map<string, ConceptsJsonGroup>();
		for (const item of collected) {
			const cleanHeadings = item.headings.map(h => h.trim()).filter(h => h.length > 0);
			const part = cleanHeadings[0] || '';
			const chapterSegments = cleanHeadings.slice(1);
			const chapter = chapterSegments.join('\n');
			const key = `${part}||${chapter}`;
			let group = groupMap.get(key);
			if (!group) {
				group = {
					Part: part || undefined,
					Chapter: chapter || undefined,
					Concepts: [],
				};
				groupMap.set(key, group);
			}
			(group.Concepts ?? (group.Concepts = [])).push(item.concept);
		}
		return Array.from(groupMap.values());
	}

	private collectConceptsWithHeadings(
		value: unknown,
		headings: string[],
		out: { headings: string[]; concept: ConceptsJsonConcept }[],
	): void {
		if (Array.isArray(value)) {
			for (const item of value) {
				this.collectConceptsWithHeadings(item, headings, out);
			}
			return;
		}
		if (!value || typeof value !== 'object') return;
		const obj = value as Record<string, unknown>;
		const concept = this.conceptFromObject(obj);
		if (concept) {
			out.push({ headings, concept });
			return;
		}
		const localHeadings: string[] = [];
		for (const [, rawVal] of Object.entries(obj)) {
			if (typeof rawVal !== 'string') continue;
			const text = rawVal.trim();
			if (!text) continue;
			if (!headings.includes(text) && !localHeadings.includes(text)) {
				localHeadings.push(text);
			}
		}
		const newHeadings = headings.concat(localHeadings);
		for (const child of Object.values(obj)) {
			if (child && typeof child === 'object') {
				this.collectConceptsWithHeadings(child, newHeadings, out);
			}
		}
	}

	private conceptFromObject(obj: Record<string, unknown>): ConceptsJsonConcept | null {
		const keys = Object.keys(obj);
		if (keys.length === 0) return null;
		const stringKeys = keys.filter(k => typeof obj[k] === 'string');
		if (stringKeys.length === 0) return null;
		const normalizeKey = (k: string) => k.toLowerCase().replace(/[\s_]+/g, '');
		const isNameKey = (nk: string) =>
			nk.includes('name') ||
			nk.includes('title') ||
			nk.includes('concept') ||
			nk.includes('topic') ||
			nk.includes('اسم') ||
			nk.includes('العنوان') ||
			nk.includes('الموضوع');
		const isDescriptionKey = (nk: string) =>
			nk.includes('description') ||
			nk.includes('desc') ||
			nk.includes('details') ||
			nk.includes('summary') ||
			nk.includes('شرح') ||
			nk.includes('الوصف') ||
			nk.includes('تفاصيل') ||
			nk.includes('ملخص');
		let nameKey: string | undefined;
		let descKey: string | undefined;
		for (const key of stringKeys) {
			const nk = normalizeKey(key);
			if (!nameKey && isNameKey(nk)) nameKey = key;
			if (!descKey && isDescriptionKey(nk)) descKey = key;
		}
		if (!nameKey || !descKey) return null;
		const nameValue = obj[nameKey];
		const descValue = obj[descKey];
		if (typeof nameValue !== 'string' || typeof descValue !== 'string') return null;
		const name = nameValue.trim();
		const description = descValue.trim();
		if (!name && !description) return null;
		return { name, description };
	}

	private buildConceptsMarkdown(conceptsPathValue: string, groups: ConceptsJsonGroup[], initialLastPart?: string): string {
		const lines: string[] = [];
		const baseConceptPath = (conceptsPathValue || '').trim().replace(/\/+$/, '');
		let lastPart: string | undefined = initialLastPart;
		let lastChapterSegments: string[] = [];
		for (const group of groups) {
			const part = typeof group.Part === 'string' ? group.Part.trim() : '';
			const rawChapter = typeof group.Chapter === 'string' ? group.Chapter : '';
			const concepts = Array.isArray(group.Concepts) ? group.Concepts : [];
			if (!part && !rawChapter && concepts.length === 0) continue;
			if (part && part !== lastPart) {
				if (lines.length > 0) {
					lines.push('');
				}
				lines.push(`##### ${part}`);
				lastPart = part;
				lastChapterSegments = [];
			}
			const chapterSegments = rawChapter
				.split('\n')
				.map(s => s.trim())
				.filter(s => s.length > 0);
			if (chapterSegments.length > 0) {
				let divergenceIndex = 0;
				const maxCommon = Math.min(chapterSegments.length, lastChapterSegments.length);
				while (
					divergenceIndex < maxCommon &&
					chapterSegments[divergenceIndex] === lastChapterSegments[divergenceIndex]
				) {
					divergenceIndex++;
				}
				for (let i = divergenceIndex; i < chapterSegments.length; i++) {
					const chapter = chapterSegments[i];
					if (!chapter) continue;
					lines.push('');
					lines.push(`###### ${chapter}`);
				}
				lastChapterSegments = chapterSegments;
			} else {
				lastChapterSegments = [];
			}
			for (const concept of concepts) {
				const name = concept && typeof concept.name === 'string' ? concept.name.trim() : '';
				const description = concept && typeof concept.description === 'string' ? concept.description.trim() : '';
				if (!name && !description) continue;
				lines.push('');
				if (name) {
					const fullPath = baseConceptPath ? `${baseConceptPath}/${name}` : name;
					lines.push(`- ==${fullPath}==`);
				} else if (description) {
					lines.push(`- ${description}`);
				}
				if (name && description) {
					lines.push(`  ${description}`);
				}
				lines.push('  D1 No.: ');
				lines.push('  Optional:');
				lines.push('  Is verified?(Y or N):');
				lines.push('  Degree of importance (1-5):');
				lines.push('  Complexity (1-5):');
			}
		}
		return lines.join('\n');
	}

	private countConcepts(groups: ConceptsJsonGroup[]): number {
		let count = 0;
		for (const group of groups) {
			if (Array.isArray(group.Concepts)) {
				count += group.Concepts.length;
			}
		}
		return count;
	}
}
