import { UilExclamationTriangle, UilTimes } from '@iconscout/react-unicons';

interface ReportModalProps {
    t: (key: string) => string;
    showReportModal: boolean;
    setShowReportModal: (show: boolean) => void;
    reportReason: string;
    setReportReason: (reason: string) => void;
    confirmReport: () => Promise<void>;
}

const ReportModal = ({
    t,
    showReportModal,
    setShowReportModal,
    reportReason,
    setReportReason,
    confirmReport,
}: ReportModalProps) => {
    if (!showReportModal) return null;

    return (
        <div className="leave-modal-overlay report-modal-overlay" onClick={() => setShowReportModal(false)}>
            <div className="leave-modal-content report-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <UilExclamationTriangle size="24" color="#E53E3E" />
                        {t('groupChat.reportUser')}
                    </h3>
                    <button className="close-menu-btn" onClick={() => setShowReportModal(false)}>
                        <UilTimes size="24" />
                    </button>
                </div>

                <div className="report-modal-body">
                    <p className="report-hint">{t('groupChat.reportReason')}:</p>

                    <div className="report-options">
                        <label className={`report-option-label ${reportReason === 'inappropriate' ? 'selected' : ''}`}>
                            <input
                                type="radio"
                                name="reportReason"
                                value="inappropriate"
                                checked={reportReason === 'inappropriate'}
                                onChange={(e) => setReportReason(e.target.value)}
                            />
                            <span>{t('groupChat.reportInappropriate')}</span>
                        </label>

                        <label className={`report-option-label ${reportReason === 'harassment' ? 'selected' : ''}`}>
                            <input
                                type="radio"
                                name="reportReason"
                                value="harassment"
                                checked={reportReason === 'harassment'}
                                onChange={(e) => setReportReason(e.target.value)}
                            />
                            <span>{t('groupChat.reportHarassment')}</span>
                        </label>

                        <label className={`report-option-label ${reportReason === 'spam' ? 'selected' : ''}`}>
                            <input
                                type="radio"
                                name="reportReason"
                                value="spam"
                                checked={reportReason === 'spam'}
                                onChange={(e) => setReportReason(e.target.value)}
                            />
                            <span>{t('groupChat.reportSpam')}</span>
                        </label>

                        <label className={`report-option-label ${reportReason === 'other' ? 'selected' : ''}`}>
                            <input
                                type="radio"
                                name="reportReason"
                                value="other"
                                checked={reportReason === 'other'}
                                onChange={(e) => setReportReason(e.target.value)}
                            />
                            <span>{t('groupChat.reportOther')}</span>
                        </label>
                    </div>

                    <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#FFF5F5', borderRadius: '8px', borderLeft: '4px solid #E53E3E' }}>
                        <h4 style={{ color: '#C53030', margin: '0 0 8px 0', fontSize: '0.95rem' }}>
                            {t('groupChat.reportConfirmTitle') || "Confirm Report"}
                        </h4>
                        <p style={{ color: '#742A2A', fontSize: '0.85rem', margin: 0, lineHeight: '1.4' }}>
                            {t('groupChat.reportConfirmMessage') || "Are you sure you want to report this message? This report will be sent directly to the Scripture Habit administrators."}
                        </p>
                    </div>
                </div>

                <div className="leave-modal-actions">
                    <button className="modal-btn cancel" onClick={() => setShowReportModal(false)}>
                        {t('groupChat.cancel')}
                    </button>
                    <button className="modal-btn leave report-submit" onClick={confirmReport}>
                        {t('groupChat.report')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReportModal;
