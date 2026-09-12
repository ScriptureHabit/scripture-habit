import { describe, it, expect } from 'vitest';
import { loadTranslations } from '../i18n';

describe('i18n loadTranslations', () => {
  it('loads ja translations with oneTapStudy and no familyTheme', async () => {
    const ja = await loadTranslations('ja');
    expect(ja.dashboard).toBeDefined();
    expect((ja.dashboard as any).modeNote).toBe('ノート作成');
    expect(ja.oneTapStudy).toBeDefined();
    expect((ja.oneTapStudy as any).themeLabel).toBe('テーマ');
    expect((ja.oneTapStudy as any).categoryOneTap).toBe('ワンタップ');
    expect((ja.oneTapStudy as any).noteBody).toBe('今日は{theme}について学びを深めることができました。');
    expect((ja as any).familyTheme).toBeUndefined();
  });

  it('loads en translations with oneTapStudy and no familyTheme', async () => {
    const en = await loadTranslations('en');
    expect(en.dashboard).toBeDefined();
    expect((en.dashboard as any).modeNote).toBe('Note Mode');
    expect(en.oneTapStudy).toBeDefined();
    expect((en.oneTapStudy as any).themeLabel).toBe('Theme');
    expect((en.oneTapStudy as any).categoryOneTap).toBe('One-Tap');
    expect((en.oneTapStudy as any).noteBody).toBe('Today I was able to deepen my learning about {theme}.');
    expect((en as any).familyTheme).toBeUndefined();
  });
});

