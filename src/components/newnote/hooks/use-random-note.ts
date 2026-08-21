import { useState, useCallback, useMemo } from 'react';
import { getTodayReadingPlan } from '../../../data/daily-reading-plan';
import { AdversityScriptures } from '../../../data/adversity-scriptures';
import { JoyScriptures } from '../../../data/joy-scriptures';
import { RelationshipScriptures } from '../../../data/relationship-scriptures';
import { MasteryScriptures } from '../../../data/mastery-scriptures';
import { PeaceScriptures } from '../../../data/peace-scriptures';
import { getCategoryFromScripture } from '../../../utils/gospel-library-mapper';
import { localizeLdsUrl } from '../../../utils/url-localizer';
import { ScriptureQuote } from '../../../types/scriptures';

interface RandomScripture {
    scripture: string;
    chapter: string;
}

export const useRandomNote = (
    language: string | null,
    translateChapterField: (field: string) => string,
    onFill: (scripture: string, chapter: string) => void
) => {
    const [showRandomMenu, setShowRandomMenu] = useState(false);
    const [showSelectionModal, setShowSelectionModal] = useState(false);

    const availableReadingPlanScripts = useMemo(() => getTodayReadingPlan()?.scripts || [], []);

    const pickAndFill = useCallback((random: RandomScripture) => {
        let finalChapter = random.chapter;
        if (finalChapter.startsWith('http')) {
            finalChapter = localizeLdsUrl(finalChapter, language || 'en') || finalChapter;
        } else {
            finalChapter = translateChapterField(finalChapter);
        }
        onFill(random.scripture, finalChapter);
        setShowRandomMenu(false);
        setShowSelectionModal(false);
    }, [language, translateChapterField, onFill]);

    const handlePickRandomReadingPlan = useCallback(() => {
        if (availableReadingPlanScripts.length === 1) {
            const script = availableReadingPlanScripts[0];
            const detectedCategory = getCategoryFromScripture(script);
            pickAndFill({ 
                scripture: detectedCategory !== 'Other' ? detectedCategory : 'Book of Mormon', 
                chapter: script || '' 
            });
        } else {
            setShowSelectionModal(true);
            setShowRandomMenu(false);
        }
    }, [availableReadingPlanScripts, pickAndFill]);

    const pickRandomFromSet = useCallback((set: ScriptureQuote[]) => {
        const item = set[Math.floor(Math.random() * set.length)];
        pickAndFill(item);
    }, [pickAndFill]);

    return {
        showRandomMenu,
        setShowRandomMenu,
        showSelectionModal,
        setShowSelectionModal,
        availableReadingPlanScripts,
        handlePickRandomReadingPlan,
        handlePickRandomMastery: () => pickRandomFromSet(MasteryScriptures),
        handlePickRandomPeace: () => pickRandomFromSet(PeaceScriptures),
        handlePickRandomAdversity: () => pickRandomFromSet(AdversityScriptures),
        handlePickRandomRelationship: () => pickRandomFromSet(RelationshipScriptures),
        handlePickRandomJoy: () => pickRandomFromSet(JoyScriptures),
    };
};
