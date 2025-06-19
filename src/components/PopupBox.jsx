import { useEffect, useState } from 'react';
import './PopupBox.css';

function PopupBox({ isOpen, onClose, content, buttonPosition }) {
  const [animationClass, setAnimationClass] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAnimationClass('popup-animate-in');
    } else {
      setAnimationClass('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const popupStyle = {
    '--button-top': `${buttonPosition.top}px`,
    '--button-left': `${buttonPosition.left}px`
  };

  return (
    <div className="popup-overlay">
      <div 
        className={`popup-content ${animationClass}`}
        style={popupStyle}
      >
        <button 
          className="close-button nav-button"
          onClick={onClose}
        >
          ×
        </button>
        <div className="popup-body">
          {content}
        </div>
      </div>
    </div>
  );
}

export default PopupBox; 