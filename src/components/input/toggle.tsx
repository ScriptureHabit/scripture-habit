import React from 'react';
import './toggle.css';

interface ToggleProps {
    label?: string;
    id: string;
    name?: string;
    checked: boolean;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    className?: string;
}

const Toggle = ({ label, id, name, checked, onChange, className = '' }: ToggleProps) => {
    return (
        <div className={`toggle-container ${className}`}>
            {label && <label className="toggle-label" htmlFor={id}>{label}</label>}
            <div className="toggle-switch">
                <input
                    type="checkbox"
                    id={id}
                    name={name || id}
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
