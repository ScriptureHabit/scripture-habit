import { FC } from 'react';
import { useLanguage } from '../../Context/LanguageContext';
import { UilArrowLeft } from '@iconscout/react-unicons';
import { useNavigate } from 'react-router-dom';
import './LegalDisclosure.css';

interface LegalInfoItem {
    label: string;
    value: string;
}

const LegalDisclosure: FC = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();

    const legalInfo: LegalInfoItem[] = [
        { label: t('legalDisclosure.provider'), value: 'Scripture Habit' },
        { label: t('legalDisclosure.representative'), value: '相根 大治郎' },
        { label: t('legalDisclosure.address'), value: t('legalDisclosure.requestDisclosure') },
        { label: t('legalDisclosure.phone'), value: t('legalDisclosure.requestDisclosure') },
        { label: t('legalDisclosure.email'), value: 'dazhilangxianggen@gmail.com' },
        { label: t('legalDisclosure.environment'), value: t('legalDisclosure.environmentDetail') },
    ];

    return (
        <div className="LegalDisclosure">
            <div className="legal-header">
                <button className="back-btn" onClick={() => navigate(-1)} aria-label="Go back">
                    <UilArrowLeft size="24" />
                </button>
                <h1>{t('legalDisclosure.title')}</h1>
            </div>

            <div className="legal-content">
                <div className="legal-table">
                    {legalInfo.map((item, index) => (
                        <div key={index} className="legal-row">
                            <div className="legal-label">{item.label}</div>
                            <div className="legal-value">{item.value}</div>
                        </div>
                    ))}
                </div>

                <div className="legal-footer-note">
                    <p>
                        {t('legalDisclosure.personalDisclaimer')}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LegalDisclosure;
