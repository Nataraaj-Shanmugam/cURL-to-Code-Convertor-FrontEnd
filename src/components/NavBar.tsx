import React from 'react';

interface NavBarProps {
  title?: string;
  onReset?: () => void;
  className?: string;
}

export const NavBar: React.FC<NavBarProps> = ({
  title = 'cURL → Rest Assured Converter',
  onReset,
  className = ''
}) => {
  return (
    <nav className={`navbar ${className}`}>
      <div className="navbar-content">
        {/* App Title */}
        <h2 className="navbar-title">{title}</h2>

        {/* Optional Reset button */}
        {onReset && (
          <button
            className="btn btn-secondary"
            onClick={onReset}
            aria-label="Reset application"
          >
            Reset
          </button>
        )}
      </div>
    </nav>
  );
};
