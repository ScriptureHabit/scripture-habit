import { FC } from 'react';
import { useLanguage } from '../../Context/LanguageContext';
import './Maintenance.css';

interface MaintenanceProps {
    isQuota: boolean;
}

const Maintenance: FC<MaintenanceProps> = ({ isQuota }) => {
    const { t } = useLanguage();

    return (
        <div className="maintenance-container">
            <div className="maintenance-glass">
                <div className="maintenance-icon">{isQuota ? '🛠️' : '⚙️'}</div>
                <h1>{isQuota ? t('systemErrors.quotaExceededTitle') : t('systemErrors.underMaintenanceTitle')}</h1>
                <p>{isQuota ? t('systemErrors.quotaExceededMessage') : t('systemErrors.underMaintenanceMessage')}</p>

                {isQuota && (
                    <div style={{
                        marginBottom: '1.5rem',
                        padding: '1rem',
                        background: 'rgba(107, 70, 193, 0.1)',
                        borderRadius: '12px',
                        fontSize: '0.9rem',
                        color: '#6b46c1',
                        fontWeight: '600'
                    }}>
                        Expected Reset: 17:00 JST / 8:00 AM UTC
                    </div>
                )}

                <button
                    onClick={() => window.location.reload()}
                    style={{
                        padding: '0.8rem 1.5rem',
                        background: 'linear-gradient(135deg, #6b46c1 0%, #4a90e2 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'transform 0.2s',
                        marginBottom: '1rem'
                    }}
                >
                    Retry
                </button>

                <div className="maintenance-footer">
                    Scripture Habit
                </div>
            </div>
        </div>
    );
};

export default Maintenance;
