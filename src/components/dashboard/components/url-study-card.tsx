import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { UilTimes } from '@iconscout/react-unicons';
import apiClient from '../../../utils/api-client';
import { triggerConfetti } from '../../../utils/confetti-utils';
import { playNoteSubmitSound } from '../../../utils/audio-feedback';
import { formatNoteText } from '../../../utils/note-logic';
import { getLdsLanguageCode } from '../../../config/languages';
import { safeStorage } from '../../../utils/storage';
import { parseStudyUrl, generateUrlStudyComment, ParsedStudyUrl } from '../../../utils/url-study-parser';
import { UserData } from '../../../types/user';
import { isStudyMilestone } from '../../../utils/milestone';
import { isLevelUpDay, calculateLevel } from '../../../utils/level-utils';
import { useMilestoneStore } from '../../../store/use-milestone-store';
import { useLevelUpStore } from '../../../store/use-level-up-store';
import './url-study-card.css';

interface UrlStudyCardProps {
    userData: UserData;
    language: string;
    t: (key: string, replacements?: Record<string, string | number>) => string;
    onSuccess?: () => void;
}

interface UrlMeta {
    title: string;
    speaker?: string;
}

const memoryCache: Record<string, UrlMeta> = {};

export const UrlStudyCard: React.FC<UrlStudyCardProps> = ({
    userData,
    language,
    t,
    onSuccess
}) => {
    const [url, setUrl] = useState('');
    const [comment, setComment] = useState('');
    const [isCommentDirty, setIsCommentDirty] = useState(false);
    const [parsedInfo, setParsedInfo] = useState<ParsedStudyUrl | null>(null);
    const [meta, setMeta] = useState<UrlMeta | null>(null);
    const [isLoadingMeta, setIsLoadingMeta] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isCommentDirtyRef = useRef(isCommentDirty);
    useEffect(() => {
        isCommentDirtyRef.current = isCommentDirty;
    }, [isCommentDirty]);

    const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleUrlChange = (val: string) => {
        setUrl(val);

        if (!val.trim()) {
            setParsedInfo(null);
            setMeta(null);
            setIsLoadingMeta(false);
            if (!isCommentDirtyRef.current) {
                setComment('');
            }
            if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
            return;
        }

        const parsed = parseStudyUrl(val, language);
        setParsedInfo(parsed);

        // Immediate initial comment generation
        if (!isCommentDirtyRef.current) {
            const initialComment = generateUrlStudyComment({
                type: parsed.type,
                categoryLabel: parsed.categoryLabel,
                category: parsed.category,
                bookName: parsed.bookName,
                chapter: parsed.chapter,
                verses: parsed.verses,
                sessionLabel: parsed.sessionLabel,
                language
            });
            setComment(initialComment);
        }

        // Debounced metadata fetch
        if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = setTimeout(async () => {
            let targetUrl = val.trim();
            if (!targetUrl.startsWith('http')) {
                targetUrl = `https://${targetUrl}`;
            }

            let parsedHost: string;
            try {
                parsedHost = new URL(targetUrl).hostname.toLowerCase();
            } catch {
                return;
            }

            const isChurchUrl = parsedHost === 'churchofjesuschrist.org' || 
                                parsedHost === 'www.churchofjesuschrist.org' || 
                                parsedHost.endsWith('.churchofjesuschrist.org');

            const apiLang = getLdsLanguageCode(language);
            const cacheKey = `url_meta_${apiLang}_${targetUrl}`;

            const cached = memoryCache[cacheKey] || safeStorage.get<UrlMeta>(cacheKey);
            if (cached) {
                memoryCache[cacheKey] = cached;
                setMeta(cached);
                setIsLoadingMeta(false);

                if (!isCommentDirtyRef.current) {
                    const commentWithMeta = generateUrlStudyComment({
                        type: parsed.type,
                        categoryLabel: parsed.categoryLabel,
                        category: parsed.category,
                        bookName: parsed.bookName,
                        chapter: parsed.chapter,
                        verses: parsed.verses,
                        sessionLabel: parsed.sessionLabel,
                        speaker: cached.speaker,
                        title: cached.title,
                        language
                    });
                    setComment(commentWithMeta);
                }
                return;
            }

            setIsLoadingMeta(true);
            try {
                const endpoint = isChurchUrl ? '/api/preview/fetch-church-metadata' : '/api/preview/url-preview';
                const res = await apiClient.get(endpoint, {
                    params: {
                        url: targetUrl,
                        lang: apiLang
                    }
                });

                if (res.data && (res.data.title || res.data.speaker)) {
                    const fetchedMeta: UrlMeta = {
                        title: res.data.title || '',
                        speaker: res.data.speaker || undefined
                    };
                    memoryCache[cacheKey] = fetchedMeta;
                    safeStorage.set(cacheKey, fetchedMeta);
                    setMeta(fetchedMeta);

                    if (!isCommentDirtyRef.current) {
                        const commentWithMeta = generateUrlStudyComment({
                            type: parsed.type,
                            categoryLabel: parsed.categoryLabel,
                            category: parsed.category,
                            bookName: parsed.bookName,
                            chapter: parsed.chapter,
                            verses: parsed.verses,
                            sessionLabel: parsed.sessionLabel,
                            speaker: fetchedMeta.speaker,
                            title: fetchedMeta.title,
                            language
                        });
                        setComment(commentWithMeta);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch metadata for URL:', err);
                // Non-blocking: continue with parsed URL data
            } finally {
                setIsLoadingMeta(false);
            }
        }, 350);
    };

    const handleClear = () => {
        setUrl('');
        setComment('');
        setIsCommentDirty(false);
        setParsedInfo(null);
        setMeta(null);
        setIsLoadingMeta(false);
        if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    };

    const handleCompleteStudy = async () => {
        if (isSubmitting) return;

        const trimmedUrl = url.trim();
        if (!trimmedUrl) {
            toast.error(t('urlStudy.urlRequired'));
            return;
        }

        const trimmedComment = comment.trim();
        if (!trimmedComment) {
            toast.error(t('urlStudy.commentRequired'));
            return;
        }

        setIsSubmitting(true);
        try {
            const scripture = parsedInfo?.category || 'Other';
            let chapter = '';
            if (parsedInfo?.type === 'scripture' && parsedInfo.bookName && parsedInfo.chapter) {
                chapter = `${parsedInfo.bookName} ${parsedInfo.chapter}${parsedInfo.verses ? `:${parsedInfo.verses}` : ''}`;
            } else {
                chapter = parsedInfo?.normalizedUrl || trimmedUrl;
            }

            const messageText = formatNoteText(scripture, chapter, trimmedComment);

            const response = await apiClient.post('/api/groups/post-note', {
                chapter,
                comment: trimmedComment,
                scripture,
                messageText,
                shareOption: 'all',
                selectedShareGroups: [],
                currentGroupId: null,
                language: language || 'ja',
                title: meta?.title || null,
                speaker: meta?.speaker || null,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                clientTimestamp: Date.now()
            });

            if (response.data && response.data.success) {
                const prevDays = userData?.daysStudiedCount || 0;
                const streakUpdated = response.data?.streakUpdated;
                const newDays = streakUpdated ? prevDays + 1 : prevDays;

                if (streakUpdated) {
                    const isLevelUp = isLevelUpDay(newDays);
                    const isMilestone = isStudyMilestone(newDays);

                    if (isLevelUp) {
                        const newLevel = calculateLevel(newDays);
                        const pendingMilestone = isMilestone ? {
                            days: newDays,
                            nickname: userData?.nickname || ''
                        } : null;

                        useLevelUpStore.getState().openLevelUp({
                            level: newLevel,
                            days: newDays,
                            nickname: userData?.nickname || ''
                        }, pendingMilestone);
                    } else if (isMilestone) {
                        useMilestoneStore.getState().openMilestone({
                            days: newDays,
                            nickname: userData?.nickname || ''
                        });
                    } else {
                        playNoteSubmitSound();
                        triggerConfetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                    }
                } else {
                    playNoteSubmitSound();
                    triggerConfetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
                }

                toast.success(t('urlStudy.successMessage'));

                // Clear input so user can submit another note if desired
                setUrl('');
                setComment('');
                setIsCommentDirty(false);
                setParsedInfo(null);
                setMeta(null);
                onSuccess?.();
            }
        } catch (err: unknown) {
            console.error('Failed to submit URL study:', err);
            toast.error(t('urlStudy.errorMessage'));
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        return () => {
            if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
        };
    }, []);

    return (
        <div className="url-study-card" data-testid="url-study-card">
            <p className="url-study-prompt">
                {t('urlStudy.prompt')}
            </p>

            <div className="url-input-wrapper">
                <input
                    type="url"
                    value={url}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder={t('urlStudy.urlInputPlaceholder')}
                    className="url-study-input"
                    data-testid="url-study-input"
                    aria-label={t('urlStudy.urlInputPlaceholder')}
                />
                {url && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="url-study-clear-btn"
                        aria-label="Clear URL"
                    >
                        <UilTimes size="16" />
                    </button>
                )}
            </div>

            {isLoadingMeta && (
                <div className="url-study-loading-row">
                    <div className="url-study-spinner" />
                    <span>{t('urlStudy.fetchingInfo')}</span>
                </div>
            )}

            {parsedInfo && !isLoadingMeta && (
                <div className="url-study-meta-preview" data-testid="url-study-preview">
                    <div className="url-study-badge-row">
                        <span className="url-study-category-badge">{parsedInfo.categoryLabel}</span>
                        {parsedInfo.type === 'scripture' && parsedInfo.bookName && (
                            <span className="url-study-passage-badge">
                                📖 {parsedInfo.bookName} {parsedInfo.chapter}{parsedInfo.verses ? `:${parsedInfo.verses}` : ''}
                            </span>
                        )}
                        {parsedInfo.sessionLabel && (
                            <span className="url-study-session-badge">
                                🏛️ {parsedInfo.sessionLabel}
                            </span>
                        )}
                        {meta?.speaker && (
                            <span className="url-study-speaker-badge">
                                👤 {meta.speaker}
                            </span>
                        )}
                    </div>
                    {meta?.title && parsedInfo.type !== 'scripture' && (
                        <div className="url-study-title-preview">
                            {language === 'ja' || language === 'zho' ? `「${meta.title}」` : `"${meta.title}"`}
                        </div>
                    )}
                </div>
            )}

            {url.trim().length > 0 && (
                <div className="url-study-comment-container">
                    <label htmlFor="url-study-comment-textarea" className="url-study-comment-label">
                        {t('urlStudy.commentLabel')}
                    </label>
                    <textarea
                        id="url-study-comment-textarea"
                        value={comment}
                        onChange={(e) => {
                            setComment(e.target.value);
                            setIsCommentDirty(true);
                        }}
                        placeholder={t('urlStudy.commentPlaceholder')}
                        className="url-study-comment-textarea"
                        data-testid="url-study-comment"
                        rows={3}
                        maxLength={2000}
                    />
                </div>
            )}

            <button
                type="button"
                onClick={handleCompleteStudy}
                disabled={isSubmitting || !url.trim() || !comment.trim()}
                className="url-study-submit-btn cta-btn"
                data-testid="url-study-submit"
            >
                {isSubmitting
                    ? t('urlStudy.submitting')
                    : t('urlStudy.completeButton')}
            </button>
        </div>
    );
};

export default UrlStudyCard;
