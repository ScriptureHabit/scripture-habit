import { useState } from 'react';
import './donate.css';
import { useLanguage } from '../../hooks/use-language';
import Mascot from '../mascot/mascot';
import { UserData } from '../../types/user';
import apiClient from '../../utils/api-client';
import { auth } from '../../firebase';
import { 
    UilGithub, 
    UilLightbulbAlt, 
    UilBug, 
    UilHeart, 
    UilEnvelope, 
    UilCheckCircle, 
    UilExclamationCircle 
} from '@iconscout/react-unicons';

interface DonateProps {
    userData: UserData | null;
}

type FeedbackCategory = 'idea' | 'bug' | 'cheer';

const Donate = ({ userData }: DonateProps) => {
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
        <div className="Donate DashboardContent">
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
                                src="/images/profile.jpg" 
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
                                href="https://github.com/ScriptureHabit/scripture-habit" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="github-btn"
                            >
                                <UilGithub size="20" />
                                <span>{t('story.githubRepo')}</span>
                            </a>
                            <div className="sponsors-badge">
                                <span>{t('story.githubSponsorsComingSoon')}</span>
                            </div>
                        </div>
                    </div>

                    <div className="donate-separator"></div>

                    {/* 3. Feedback Form Section */}
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

export default Donate;
