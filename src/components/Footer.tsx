import React from 'react';

interface FooterProps {
  text?: string;
  className?: string;
}

export const Footer: React.FC<FooterProps> = ({
  text = '© 2025 cURL → Rest Assured Converter. All rights reserved.',
  className = ''
}) => {
  return (
    <footer className={`footer ${className}`}>
      <div className="footer-content">
        <p>{text}</p>
      </div>
    </footer>
  );
};
