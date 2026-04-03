import React from 'react';
import './Toggle.css';

interface ToggleProps {
    label?: string;
    id: string;
    checked: boolean;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    className?: string;
}

const Toggle: React.FC<ToggleProps> = ({ label, id, checked, onChange, className = '' }) => {
    return (
        <div className={`toggle-container ${className}`}>
            {label && <label className="toggle-label" htmlFor={id}>{label}</label>}
            <div className="toggle-switch">
                <input
                    type="checkbox"
                    id={id}
                    checked={checked}
                    onChange={onChange}
                    className="toggle-input"
                />
                <label className="toggle-slider" htmlFor={id}>
                    <span className="toggle-button" />
                </label>
            </div>
        </div>
    );
};

export default Toggle;
