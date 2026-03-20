import { useState, useEffect } from 'react';

export interface NoteState {
    note: string;
    title: string;
    studyTime: string;
    visibility: 'public' | 'private' | 'group';
    scriptureReference: string;
    selectedGroups: string[];
    tags: string[];
}

export const useNoteState = (initialNoteData: any, currentGroupId: string | null) => {
    const [note, setNote] = useState<string>('');
    const [title, setTitle] = useState<string>('');
    const [studyTime, setStudyTime] = useState<string>('15');
    const [visibility, setVisibility] = useState<'public' | 'private' | 'group'>('public');
    const [scriptureReference, setScriptureReference] = useState<string>('');
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [tags, setTags] = useState<string[]>([]);

    useEffect(() => {
        if (initialNoteData) {
            setNote(initialNoteData.note || '');
            setTitle(initialNoteData.title || '');
            setStudyTime(initialNoteData.studyTime || '15');
            setVisibility(initialNoteData.visibility || 'public');
            setScriptureReference(initialNoteData.scriptureReference || '');
            setSelectedGroups(initialNoteData.selectedGroups || []);
            setTags(initialNoteData.tags || []);
        } else if (currentGroupId) {
            setSelectedGroups([currentGroupId]);
            setVisibility('group');
        }
    }, [initialNoteData, currentGroupId]);

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
