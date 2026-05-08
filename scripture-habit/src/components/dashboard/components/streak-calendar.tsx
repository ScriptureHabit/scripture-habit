import React, { useState, useMemo } from 'react';
import { UilAngleLeft, UilAngleRight } from '@iconscout/react-unicons';
import './streak-calendar.css';

interface StreakCalendarProps {
  studiedDates?: string[]; // Array of 'YYYY-MM-DD'
  t: (key: string) => string;
}

const StreakCalendar: React.FC<StreakCalendarProps> = ({ studiedDates = [], t }) => {
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
        isToday: new Date().toLocaleDateString('sv-SE') === dateStr,
        key: dateStr
      });
    }
    
    return days;
  }, [currentMonth, studiedDates]);

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const monthYearLabel = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="streak-calendar-container">
      <div className="calendar-header">
        <h3 className="calendar-title">{t('dashboard.streakStatus')}</h3>
        <div className="calendar-nav">
          <button onClick={prevMonth} className="nav-btn"><UilAngleLeft /></button>
          <span className="current-month-label">{monthYearLabel}</span>
          <button onClick={nextMonth} className="nav-btn"><UilAngleRight /></button>
        </div>
      </div>
      
      <div className="calendar-grid">
        {weekDays.map(day => (
          <div key={day} className="weekday-label">{day}</div>
        ))}
        {calendarData.map((item) => (
          <div 
            key={item.key} 
            className={`calendar-cell ${item.type === 'padding' ? 'padding' : ''} ${item.type === 'day' && item.isStudied ? 'studied' : ''} ${item.type === 'day' && item.isToday ? 'today' : ''}`}
          >
            {item.type === 'day' && (
              <span className="day-number">{item.day}</span>
            )}
            {item.type === 'day' && item.isStudied && (
              <div className="studied-indicator" />
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
      </div>
    </div>
  );
};

export default StreakCalendar;
