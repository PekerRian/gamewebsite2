import { useState } from 'react';
import './SideNav.css';
import Cavemans from './content/Cavemans';
import AptosaursDisplay from './Aptosaurs';
import Storage from './content/Storage';
import Mail from './Mail';

// Define button configurations with images
const BUTTONS = {
  CAVEMANS: {
    name: 'CAVEMANS',
    image: '/icons/caveman.png',
    alt: 'Caveman Icon'
  },
  APTOSAURS: {
    name: 'APTOSAURS',
    image: '/icons/dino.png',
    alt: 'Dinosaur Icon'
  },
  STORAGE: {
    name: 'STORAGE',
    image: '/icons/chest.png',
    alt: 'Storage Chest Icon'
  },
  MAIL: {
    name: 'MAIL',
    image: '/icons/mail.png',
    alt: 'Mail Icon'
  }
};

function SideNav() {
  const [activeButton, setActiveButton] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleButtonClick = (buttonName) => {
    setActiveButton(buttonName);
    setShowPopup(true);
    setIsAnimating(true);
  };

  const handleClosePopup = () => {
    setIsAnimating(false);
    setTimeout(() => {
      setShowPopup(false);
      setActiveButton(null);
    }, 300); // Match this with CSS animation duration
  };

  // Map component names to their actual components
  const contentComponents = {
    CAVEMANS: Cavemans,
    APTOSAURS: AptosaursDisplay,
    STORAGE: Storage,
    MAIL: Mail
  };

  // Get the active component
  const ActiveContent = activeButton ? contentComponents[activeButton] : null;

  return (
    <>
      <div className="side-nav">
        <nav>
          {Object.entries(BUTTONS).map(([key, button]) => (
            <button
              key={key}
              className={`nav-button ${activeButton === key ? 'active' : ''}`}
              onClick={() => handleButtonClick(key)}
            >
              <div className="nav-button-content">
                <img 
                  src={button.image} 
                  alt={button.alt}
                  className="nav-button-icon"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/icons/default.png';
                  }}
                />
                <span className="nav-button-text">{button.name}</span>
              </div>
            </button>
          ))}
        </nav>
      </div>

      {showPopup && ActiveContent && (
        <div className={`popup-overlay ${isAnimating ? 'active' : 'fade-out'}`}>
          <div className={`popup-content ${isAnimating ? 'popup-animate-in' : 'popup-animate-out'}`}>
            <button className="close-button" onClick={handleClosePopup}>×</button>
            <div className="popup-inner-content">
              <ActiveContent />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default SideNav; 