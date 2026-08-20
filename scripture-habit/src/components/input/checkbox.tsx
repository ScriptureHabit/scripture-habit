import React from 'react';
import './checkbox.css';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

const Checkbox = ({
    label,
    type = 'checkbox',
    id,
    name,
    checked,
    onChange,
    ...props
}: CheckboxProps) => {
  const generatedId = React.useId();
  const inputId = id || generatedId;
  const inputName = name || id || inputId;

  return (
          <div className="checkbox">
            <input
                type={type}
                id={inputId}
                name={inputName}
                checked={checked}
                onChange={onChange}
                {...props}
            />
             {label && <label htmlFor={inputId}>{label}</label>}
          </div>
  );
};

export default Checkbox;
