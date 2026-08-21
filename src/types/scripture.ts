export const SCRIPTURE_CATEGORIES = [
  'Old Testament',
  'New Testament',
  'Book of Mormon',
  'Doctrine and Covenants',
  'Pearl of Great Price',
  'Ordinances and Proclamations',
  'General Conference',
  'BYU Speeches',
  'Other'
] as const;

export type ScriptureCategory = (typeof SCRIPTURE_CATEGORIES)[number];
export type NoteCategory = ScriptureCategory | 'All';

export const CATEGORY_TRANSLATION_MAP = {
  'Old Testament': 'scriptures.oldTestament',
  'New Testament': 'scriptures.newTestament',
  'Book of Mormon': 'scriptures.bookOfMormon',
  'Doctrine and Covenants': 'scriptures.doctrineAndCovenants',
  'Pearl of Great Price': 'scriptures.pearlOfGreatPrice',
  'Ordinances and Proclamations': 'scriptures.ordinancesAndProclamations',
  'General Conference': 'scriptures.generalConference',
  'BYU Speeches': 'scriptures.byuSpeeches',
  'Other': 'scriptures.other'
} as const satisfies Record<ScriptureCategory, string>;
