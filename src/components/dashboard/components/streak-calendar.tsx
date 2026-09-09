import { useState, useMemo, useContext } from 'react';
import { UilAngleLeft, UilAngleRight } from '@iconscout/react-unicons';
import { LanguageContext } from '../../../context/language-context';
import { Language } from '../../../config/languages';
import './streak-calendar.css';

interface StreakCalendarProps {
  studiedDates?: string[]; // Array of 'YYYY-MM-DD'
  kickDate?: string | null; // 'YYYY-MM-DD'
  t: (key: string) => string;
  language?: Language | string;
}

const LANGUAGE_LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  ja: 'ja-JP',
  pt: 'pt-BR',
  zho: 'zh-TW',
  es: 'es-ES',
  vi: 'vi-VN',
  th: 'th-TH',
  ko: 'ko-KR',
  tl: 'fil-PH',
  sw: 'sw-KE',
  it: 'it-IT'
};

const StreakCalendar = ({ studiedDates = [], kickDate, t, language }: StreakCalendarProps) => {
  const languageContext = useContext(LanguageContext);
  const currentLang = language || languageContext?.language || 'en';
  const locale = LANGUAGE_LOCALE_MAP[currentLang] || currentLang;

  const [currentMonth, setCurrentMonth] = useState(new Date());

  const calendarData = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // First day of month
    const firstDay = new Date(year, month, 1);
    // Last day of month
    const lastDay = new Date(year, month + 1, 0);
    
    // Day of week for the first day (0-6, Sunday is 0)
    const startingDay = firstDay.getDay();
    
    const daysInMonth = lastDay.getDate();
    
    const days = [];
    
    // Padding for the start of the month
    for (let i = 0; i < startingDay; i++) {
      days.push({ type: 'padding', key: `pad-${i}` });
    }
    
    // Days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        type: 'day',
        day: i,
        dateStr,
        isStudied: studiedDates.includes(dateStr),
        isKickDate: kickDate === dateStr,
        isToday: new Date().toLocaleDateString('sv-SE') === dateStr,
        key: dateStr
      });
    }
    
    return days;
  }, [currentMonth, studiedDates, kickDate]);

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const monthYearLabel = useMemo(() => {
    try {
      return currentMonth.toLocaleString(locale, { month: 'long', year: 'numeric' });
    } catch {
      return currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    }
  }, [currentMonth, locale]);

  const weekDays = useMemo(() => {
    try {
      const weekdayFormat = ['th', 'sw', 'vi', 'zho'].includes(currentLang) ? 'narrow' : 'short';
      const formatter = new Intl.DateTimeFormat(locale, { weekday: weekdayFormat, timeZone: 'UTC' });
      // 2021-08-01 was Sunday (0) through 2021-08-07 Saturday (6)
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(Date.UTC(2021, 7, 1 + i, 12, 0, 0));
        return formatter.format(d);
      });
    } catch {
      return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    }
  }, [locale, currentLang]);

  return (
    <div className="streak-calendar-container">
      <div className="calendar-header">
        <div className="calendar-nav">
          <button onClick={prevMonth} className="nav-btn" aria-label="Previous month"><UilAngleLeft /></button>
          <span className="current-month-label">{monthYearLabel}</span>
          <button onClick={nextMonth} className="nav-btn" aria-label="Next month"><UilAngleRight /></button>
        </div>
      </div>
      
      <div className="calendar-grid">
        {weekDays.map(day => (
          <div key={day} className="weekday-label">{day}</div>
        ))}
        {calendarData.map((item) => (
          <div 
            key={item.key} 
            className={`calendar-cell ${item.type === 'padding' ? 'padding' : ''} ${item.type === 'day' && item.isStudied ? 'studied' : ''} ${item.type === 'day' && item.isKickDate ? 'kick-deadline' : ''} ${item.type === 'day' && item.isToday ? 'today' : ''}`}
          >
            {item.type === 'day' && (
              <span className="day-number">{item.day}</span>
            )}
            {item.type === 'day' && item.isStudied && (
              <div className="studied-indicator" />
            )}
            {item.type === 'day' && item.isKickDate && (
              <div className="kick-indicator" />
            )}
          </div>
        ))}
      </div>
      
      <div className="calendar-footer">
        <div className="legend-item">
          <div className="cell-preview studied" />
          <span>{t('dashboard.studied')}</span>
        </div>
        <div className="legend-item">
          <div className="cell-preview" />
          <span>{t('dashboard.notStudied')}</span>
        </div>
        <div className="legend-item">
          <div className="cell-preview kick-deadline" />
          <span>{t('dashboard.kickLimit')}</span>
        </div>
      </div>
    </div>
  );
};

export default StreakCalendar;
