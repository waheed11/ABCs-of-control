export interface MyPluginSettings {
	templateFolderPath: string;
	defaultHighlightColor: string;
	language: string;
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
	link: string;
}

export interface HeadingInfo {
	level: number;
	section: number[];
	idx: number;
	text: string;
}
