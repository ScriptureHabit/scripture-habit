import { useState } from 'react';

export interface NoteState {
    note: string;
    title: string;
    studyTime: string;
    visibility: 'public' | 'private' | 'group';
    scriptureReference: string;
    selectedGroups: string[];
    tags: string[];
}

export const useNoteState = (initialNoteData: Partial<NoteState> | null, currentGroupId: string | null) => {
    const [note, setNote] = useState<string>(() => initialNoteData?.note || '');
    const [title, setTitle] = useState<string>(() => initialNoteData?.title || '');
    const [studyTime, setStudyTime] = useState<string>(() => initialNoteData?.studyTime || '15');
    const [visibility, setVisibility] = useState<'public' | 'private' | 'group'>(() => {
        if (initialNoteData?.visibility) return initialNoteData.visibility;
        if (currentGroupId) return 'group';
        return 'public';
    });
    const [scriptureReference, setScriptureReference] = useState<string>(() => initialNoteData?.scriptureReference || '');
    const [selectedGroups, setSelectedGroups] = useState<string[]>(() => {
        if (initialNoteData?.selectedGroups) return initialNoteData.selectedGroups;
        if (currentGroupId) return [currentGroupId];
        return [];
    });
    const [tags, setTags] = useState<string[]>(() => initialNoteData?.tags || []);

    const [prevInitialData, setPrevInitialData] = useState(initialNoteData);
    if (initialNoteData !== prevInitialData) {
        setPrevInitialData(initialNoteData);
        if (initialNoteData) {
            setNote(initialNoteData.note || '');
            setTitle(initialNoteData.title || '');
            setStudyTime(initialNoteData.studyTime || '15');
            setVisibility(initialNoteData.visibility || 'public');
            setScriptureReference(initialNoteData.scriptureReference || '');
            setSelectedGroups(initialNoteData.selectedGroups || []);
            setTags(initialNoteData.tags || []);
        }
    }

    const resetState = () => {
        setNote('');
        setTitle('');
        setStudyTime('15');
        setVisibility('public');
        setScriptureReference('');
        setSelectedGroups(currentGroupId ? [currentGroupId] : []);
        setTags([]);
    };

    return {
        note, setNote,
        title, setTitle,
        studyTime, setStudyTime,
        visibility, setVisibility,
        scriptureReference, setScriptureReference,
        selectedGroups, setSelectedGroups,
        tags, setTags,
        resetState
    };
};
