import { MyPluginSettings, SectionHeaders } from './types';

export const DEFAULT_SETTINGS: MyPluginSettings = {
	templateFolderPath: 'C/Templates',
	defaultHighlightColor: 'yellow',
	language: 'english' // Default language
};

export const SECTION_HEADERS: SectionHeaders = {
	english: {
		highlights: '## 📝 Highlights & Comments',
		quotes: '# 🗨 Quotes'
	},
	arabic: {
		highlights: '## 📝 التحديدات والتعليقات',
		quotes: '# 🗨 اقتباسات'
	}
};

export const HIGHLIGHT_COLORS = ['yellow', 'green', 'red', 'blue', 'gray'];

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const WHEN_TO_USE_OPTIONS = [
	'now',
	'today', 
	'within a week',
	'within a month',
	'within a year'
];
