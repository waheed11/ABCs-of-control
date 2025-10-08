export interface ArchiveSettings {
	enabled: boolean;
	archiveAfterDays: number;
	excludeFolders: string[];
}

export interface ABCsOfControlSettings {
	templateFolderPath: string;
	whenToUse: string;
	archiveSettings: ArchiveSettings;
	defaultHighlightColor: string;
	language: string;
	abcsPhase0?: SettingsRoot; // Phase 0: optional to keep backward compatibility
}

export interface HighlightData {
	text: string;
	comment: string;
	color: string;
}

export interface SectionHeaders {
	english: {
		highlights: string;
		quotes: string;
	};
	arabic: {
		highlights: string;
		quotes: string;
	};
}

export interface HeadingMeta {
	level: number;
	section: number[];
}

export interface Selection {
	heading: string;
	link?: string;
	text?: string;
	type: 'note' | 'text';
}

export interface HeadingInfo {
	level: number;
	section: number[];
	idx: number;
	text: string;
}

// ===== Phase 0 configuration schema (optional) =====
export type RoleLetter = 'A' | 'B' | 'C' | 'D' | 'E';

export interface SearchConfig {
	includeFolders?: string[];
	excludeFolders?: string[];
	includeArchive: boolean;
	tagsAny?: string[];
	tagsAll?: string[];
	frontmatter?: Record<string, any>;
	maxResults?: number;
}

export interface InsertionConfig {
	ordering: 'numeric' | 'text' | 'none';
	compare: 'numericFirst' | 'textFirst' | 'natural';
	normalizeDigits: boolean;
	stopAtAnyHeading: boolean;
}

export interface PipelineConfig {
	id: string;
	label: string;
	templatePrefix: string;
	sources: {
		roles: RoleLetter[]; // typically ['A','B']
		includeFolders?: string[];
		excludeFolders?: string[];
	};
	targetPath: string; // supports placeholders e.g. D/Projects/{project}/Content.md
	search?: SearchConfig;
	insertion?: InsertionConfig;
	ui?: { keepModalOpen: boolean; resetAfterInsert: boolean };
	operation?: 'insert'; // default: insert for pipeline templates
}

export interface Profile {
	id: string;
	label: string;
	roles: {
		A: string[]; // multi-folder support
		B: string[]; // multi-folder support
		// C is hardcoded to 'C/Templates' - not configurable
		D: string[]; // multi-folder support, e.g., ['D/Projects','D/Exams']
		E: string;   // single root folder for archive
	};
	classification: {
		useFrontmatter: boolean;
		useTags: boolean;
		frontmatterKey: string; // e.g., 'abcs.letter'
		tagMap: { [tag: string]: RoleLetter };
	};
	defaults: {
		search: SearchConfig;
		insertion: InsertionConfig;
	};
	pipelines: PipelineConfig[];
}

export interface SettingsRoot {
	activeProfile: string;
	profiles: Profile[];
	version: number;
	safety: { dryRun: boolean; confirmMoves: boolean };
	i18n?: { language?: string; rtl?: boolean };
}
