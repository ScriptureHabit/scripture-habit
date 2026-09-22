import { useRef } from 'react';
import { UilExclamationTriangle, UilTimes } from '@iconscout/react-unicons';
import { useModalA11y } from '../../../hooks/use-modal-a11y';

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
    const modalRef = useRef<HTMLDivElement>(null);
    const cancelBtnRef = useRef<HTMLButtonElement>(null);

    const handleClose = () => setShowReportModal(false);

    useModalA11y({
        isOpen: showReportModal,
        onClose: handleClose,
        containerRef: modalRef,
        initialFocusRef: cancelBtnRef,
    });

    if (!showReportModal) return null;

    return (
        <div className="leave-modal-overlay report-modal-overlay" onClick={handleClose}>
            <div
                ref={modalRef}
                className="leave-modal-content report-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="report-modal-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-header">
                    <h3 id="report-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <UilExclamationTriangle size="24" color="#E53E3E" />
                        {t('groupChat.reportUser')}
                    </h3>
                    <button className="close-menu-btn" onClick={handleClose} aria-label={t('common.close') || 'Close'}>
                        <UilTimes size="24" />
                    </button>
                </div>

                <div className="report-modal-body">
                    <p id="report-reason-hint" className="report-hint">{t('groupChat.reportReason')}:</p>

                    <div className="report-options" role="radiogroup" aria-labelledby="report-reason-hint">
                        <label className={`report-option-label ${reportReason === 'inappropriate' ? 'selected' : ''}`} htmlFor="report-reason-inappropriate">
                            <input
                                id="report-reason-inappropriate"
                                type="radio"
                                name="reportReason"
                                value="inappropriate"
                                checked={reportReason === 'inappropriate'}
                                onChange={(e) => setReportReason(e.target.value)}
                            />
                            <span>{t('groupChat.reportInappropriate')}</span>
                        </label>

                        <label className={`report-option-label ${reportReason === 'harassment' ? 'selected' : ''}`} htmlFor="report-reason-harassment">
                            <input
                                id="report-reason-harassment"
                                type="radio"
                                name="reportReason"
                                value="harassment"
                                checked={reportReason === 'harassment'}
                                onChange={(e) => setReportReason(e.target.value)}
                            />
                            <span>{t('groupChat.reportHarassment')}</span>
                        </label>

                        <label className={`report-option-label ${reportReason === 'spam' ? 'selected' : ''}`} htmlFor="report-reason-spam">
                            <input
                                id="report-reason-spam"
                                type="radio"
                                name="reportReason"
                                value="spam"
                                checked={reportReason === 'spam'}
                                onChange={(e) => setReportReason(e.target.value)}
                            />
                            <span>{t('groupChat.reportSpam')}</span>
                        </label>

                        <label className={`report-option-label ${reportReason === 'other' ? 'selected' : ''}`} htmlFor="report-reason-other">
                            <input
                                id="report-reason-other"
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
                    <button ref={cancelBtnRef} className="modal-btn cancel" onClick={handleClose}>
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
