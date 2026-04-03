import React from 'react';
import './Checkbox.css';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

const Checkbox: React.FC<CheckboxProps> = ({
    label,
    type = 'checkbox',
    id,
    checked,
    onChange,
    ...props
}) => {
  return (
          <div className="Checkbox">
            <input
                type={type}
                id={id}
                checked={checked}
                onChange={onChange}
                {...props}
            />
             {label && <label htmlFor={id}>{label}</label>}
          </div>
  );
};

export default Checkbox;