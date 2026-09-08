export type FamilyThemeId =
    | 'faith'
    | 'hope'
    | 'charity'
    | 'gratitude'
    | 'prayer'
    | 'patience'
    | 'repentance'
    | 'guidance';

export interface FamilyThemeOption {
    id: FamilyThemeId;
    icon: string;
    translationKey: string;
}

export const FAMILY_THEMES: FamilyThemeOption[] = [
    { id: 'faith', icon: '🌟', translationKey: 'familyTheme.themes.faith' },
    { id: 'hope', icon: '🕊️', translationKey: 'familyTheme.themes.hope' },
    { id: 'charity', icon: '❤️', translationKey: 'familyTheme.themes.charity' },
    { id: 'gratitude', icon: '🙏', translationKey: 'familyTheme.themes.gratitude' },
    { id: 'prayer', icon: '🕯️', translationKey: 'familyTheme.themes.prayer' },
    { id: 'patience', icon: '⚓', translationKey: 'familyTheme.themes.patience' },
    { id: 'repentance', icon: '🌱', translationKey: 'familyTheme.themes.repentance' },
    { id: 'guidance', icon: '🧭', translationKey: 'familyTheme.themes.guidance' }
];
