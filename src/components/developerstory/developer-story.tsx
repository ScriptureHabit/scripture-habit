import { useState } from 'react';
import './developer-story.css';
import { useLanguage } from '../../hooks/use-language';
import Mascot from '../mascot/mascot';
import { UserData } from '../../types/user';
import apiClient from '../../utils/api-client';
import { auth } from '../../firebase';
import { GITHUB_REPO_URL, REDDIT_COMMUNITY_URL, ISAIAH_REPO_URL } from '../../config';
import { 
    UilGithub, 
    UilLightbulbAlt, 
    UilBug, 
    UilHeart, 
    UilEnvelope, 
    UilCheckCircle, 
    UilExclamationCircle 
} from '@iconscout/react-unicons';

interface DeveloperStoryProps {
    userData: UserData | null;
}

type FeedbackCategory = 'idea' | 'bug' | 'cheer';

const DeveloperStory = ({ userData }: DeveloperStoryProps) => {
    const { t } = useLanguage();

    const [category, setCategory] = useState<FeedbackCategory>('idea');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || isSubmitting) return;

        setIsSubmitting(true);
        setSubmitStatus('idle');
        setErrorMessage('');

        try {
            await apiClient.post('/api/feedback', {
                category,
                message: message.trim(),
                userNickname: userData?.nickname || 'Anonymous',
                userEmail: auth?.currentUser?.email || null
            });

            setSubmitStatus('success');
            setMessage('');
        } catch (err: unknown) {
            const error = err as Error;
            setSubmitStatus('error');
            setErrorMessage(error.message || t('story.feedbackError'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="DeveloperStory Donate">
            <div className="dashboard-header">
                <h1>{t('story.title')}</h1>
                <div className="donate-mascot-wrapper">
                    <Mascot
                        userData={userData}
                        customMessage={t('story.description')}
                    />
                </div>
            </div>

            <div className="donate-container">
                <div className="donate-card story-card">
                    {/* 1. Developer Profile Section */}
                    <div className="developer-profile-section">
                        <div className="developer-avatar-container">
                            <img 
                                src="/images/profile.webp" 
                                alt="Developer Profile" 
                                className="developer-avatar" 
                            />
                        </div>
                        <div className="developer-info-container">
                            <h3 className="developer-name">{t('story.developerName')}</h3>
                            <p className="developer-role">{t('story.developerRole')}</p>
                        </div>
                    </div>

                    <div className="story-content">
                        <h2 className="story-title">{t('story.appBackground')}</h2>
                        <div className="story-text">
                            {t('story.backgroundStory')}
                        </div>
                    </div>

                    <div className="donate-separator"></div>

                    {/* 2. Open Source Section */}
                    <div className="opensource-section">
                        <h2 className="section-heading">{t('story.openSourceTitle')}</h2>
                        <p className="section-description">{t('story.openSourceDesc')}</p>
                        <div className="opensource-links">
                            <a 
                                href={GITHUB_REPO_URL} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="github-btn"
                            >
                                <UilGithub size="20" />
                                <span>{t('story.githubRepo')}</span>
                            </a>
                            <a 
                                href={REDDIT_COMMUNITY_URL} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="reddit-btn"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="#FF4500" style={{ flexShrink: 0 }}>
                                    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.56 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.702zM9.25 12C8.56 12 8 12.56 8 13.25c0 .688.56 1.25 1.25 1.25.69 0 1.25-.56 1.25-1.25C10.5 12.56 9.94 12 9.25 12zm5.5 0c-.69 0-1.25.56-1.25 1.25 0 .688.56 1.25 1.25 1.25.688 0 1.25-.56 1.25-1.25 0-.69-.56-1.25-1.25-1.25zm-5.465 4.412a.458.458 0 0 0-.03.645c.42.476 1.48 1.05 2.745 1.05 1.266 0 2.324-.574 2.745-1.05a.457.457 0 0 0-.03-.645.457.457 0 0 0-.645.03c-.27.306-1.07.728-2.07.728-1 0-1.8-.422-2.07-.728a.457.457 0 0 0-.645-.03z"/>
                                </svg>
                                <span>{t('story.redditCommunity')}</span>
                            </a>
                        </div>
                    </div>

                    <div className="donate-separator"></div>

                    {/* 3. Personal Study Section */}
                    <div className="isaiah-section">
                        <h2 className="section-heading">{t('story.isaiahTitle')}</h2>
                        <p className="section-description">{t('story.isaiahDesc')}</p>
                        <div className="isaiah-links">
                            <a 
                                href={ISAIAH_REPO_URL} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="github-btn"
                            >
                                <UilGithub size="20" />
                                <span>{t('story.isaiahBtn')}</span>
                            </a>
                        </div>
                    </div>

                    <div className="donate-separator"></div>

                    {/* 4. Feedback Form Section */}
                    <div className="feedback-section">
                        <h2 className="section-heading">{t('story.feedbackTitle')}</h2>
                        <p className="section-description">{t('story.feedbackDesc')}</p>

                        <form onSubmit={handleSubmit} className="feedback-form">
                            <div className="feedback-category-tabs">
                                <button
                                    type="button"
                                    className={`category-tab ${category === 'idea' ? 'active' : ''}`}
                                    onClick={() => setCategory('idea')}
                                >
                                    <UilLightbulbAlt size="18" />
                                    <span>{t('story.feedbackCategoryIdea')}</span>
                                </button>
                                <button
                                    type="button"
                                    className={`category-tab ${category === 'bug' ? 'active' : ''}`}
                                    onClick={() => setCategory('bug')}
                                >
                                    <UilBug size="18" />
                                    <span>{t('story.feedbackCategoryBug')}</span>
                                </button>
                                <button
                                    type="button"
                                    className={`category-tab ${category === 'cheer' ? 'active' : ''}`}
                                    onClick={() => setCategory('cheer')}
                                >
                                    <UilHeart size="18" />
                                    <span>{t('story.feedbackCategoryCheer')}</span>
                                </button>
                            </div>

                            <div className="feedback-input-group">
                                <textarea
                                    id="feedback-message-input"
                                    name="feedbackMessage"
                                    className="feedback-textarea"
                                    rows={5}
                                    placeholder={t('story.feedbackPlaceholder')}
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    maxLength={2000}
                                    required
                                />
                                <div className="feedback-char-count">
                                    {message.length} / 2000
                                </div>
                            </div>

                            <div className="feedback-meta">
                                <span className="feedback-sender">
                                    {t('story.feedbackSender', { nickname: userData?.nickname || 'Anonymous' })}
                                </span>
                                <p className="feedback-reply-note">
                                    {t('story.feedbackReplyNote')}
                                </p>
                            </div>

                            {submitStatus === 'success' && (
                                <div className="feedback-alert success">
                                    <UilCheckCircle size="20" />
                                    <span>{t('story.feedbackSuccess')}</span>
                                </div>
                            )}

                            {submitStatus === 'error' && (
                                <div className="feedback-alert error">
                                    <UilExclamationCircle size="20" />
                                    <span>{errorMessage || t('story.feedbackError')}</span>
                                </div>
                            )}

                            <button 
                                type="submit" 
                                className="feedback-submit-btn"
                                disabled={isSubmitting || !message.trim()}
                            >
                                {isSubmitting ? t('story.feedbackSubmitting') : t('story.feedbackSubmit')}
                            </button>
                        </form>
                    </div>

                    <div className="donate-separator"></div>

                    {/* 4. Direct Contact */}
                    <div className="direct-contact-section">
                        <div className="direct-contact-item">
                            <UilEnvelope size="20" className="contact-icon" />
                            <span>{t('story.directContact')}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeveloperStory;
