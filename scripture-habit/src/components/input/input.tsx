import React from 'react';
import './input.css';

interface InputBaseProps {
  id?: string;
  label?: string;
  as?: 'input' | 'textarea';
  className?: string;
}

type InputProps = InputBaseProps & 
  React.InputHTMLAttributes<HTMLInputElement> & 
  React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Input = ({
  id,
  label,
  type = 'text',
  value,
  onChange,
  required = false,
  as = 'input',
  placeholder = '',
  min,
  className = '',
  ...rest
}: InputProps) => {
  const generatedId = React.useId();
  const inputId = id || generatedId;

  const Component = as === 'textarea' ? 'textarea' : 'input';

  return (
    <div className={`GlassInputContainer ${className}`}>
      {label && <label htmlFor={inputId}>{label}</label>}

      <Component
        id={inputId}
        // textarea の場合は type 属性を渡さないようにします
        {...(as === 'input' ? { type } : {})}
        value={value}
        onChange={onChange}
        required={required}
        className="GlassInput"
        placeholder={placeholder}
        min={min}
        {...rest}
      />
    </div>
  );
};

export default Input;
