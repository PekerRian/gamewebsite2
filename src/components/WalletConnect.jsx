import { WalletSelector } from '@aptos-labs/wallet-adapter-ant-design';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useEffect, useState, useCallback } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import UserCreation from './UserCreation';
import PopupBox from './PopupBox';
import './WalletConnect.css';

function WalletConnect() {
  const { connected, account, error: walletError } = useWallet();
  const [showUserCreation, setShowUserCreation] = useState(false);
  const [username, setUsername] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);

  // Utility function to convert Uint8Array to hex string
  const uint8ArrayToHex = (uint8Array) =>
    Array.from(uint8Array)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

  // Handle errors
  const handleError = useCallback((error, context = '') => {
    console.error(`Error ${context}:`, error);
    const message = error.message || `Error ${context.toLowerCase()}`;
    setError(message);
    setIsChecking(false);
  }, []);

  // Check if user exists in Firebase
  const checkUser = useCallback(async (address) => {
    setIsChecking(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('walletAddress', '==', address));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setShowUserCreation(true);
        setShowWelcomePopup(false);
        setUsername("");
        setWelcomeMessage("");
        setUserData(null);
        return false;
      } else {
        const userDoc = querySnapshot.docs[0];
        const userDataFromDB = userDoc.data();
        setUserData(userDataFromDB);
        setUsername(userDataFromDB.displayName || userDataFromDB.username);
        
        // Create personalized welcome back message
        const lastLogin = userDataFromDB.lastLogin ? new Date(userDataFromDB.lastLogin) : null;
        const now = new Date();
        let timeAway = '';
        
        if (lastLogin) {
          const hoursSinceLastLogin = Math.floor((now - lastLogin) / (1000 * 60 * 60));
          if (hoursSinceLastLogin < 24) {
            timeAway = hoursSinceLastLogin === 0 ? 
              'Welcome back!' : 
              `Welcome back! It's been ${hoursSinceLastLogin} hours.`;
          } else {
            const daysSinceLastLogin = Math.floor(hoursSinceLastLogin / 24);
            timeAway = `Welcome back! It's been ${daysSinceLastLogin} days.`;
          }
        }

        setWelcomeMessage(`${timeAway}\nGood to see you again, ${userDataFromDB.displayName || userDataFromDB.username}!`);
        setShowWelcomePopup(true);
        setShowUserCreation(false);
        
        // Update last login
        await updateDoc(userDoc.ref, {
          lastLogin: serverTimestamp()
        });
        
        return true;
      }
    } catch (err) {
      handleError(err, 'checking user');
      return false;
    } finally {
      setIsChecking(false);
    }
  }, [handleError]);

  const handleUserCreationComplete = (newUserData) => {
    setUserData(newUserData);
    setUsername(newUserData.displayName);
    setShowUserCreation(false);
    setWelcomeMessage(`Welcome to Aptosaurs, ${newUserData.displayName}!\nYour account has been created successfully.`);
    setShowWelcomePopup(true);
  };

  useEffect(() => {
    const handleWalletConnection = async () => {
      if (connected && account) {
        let formattedAddress;
        try {
          if (account.address?.data) {
            formattedAddress = `0x${uint8ArrayToHex(new Uint8Array(account.address.data))}`;
          } else if (typeof account.address === 'string') {
            formattedAddress = account.address.startsWith('0x') ? account.address : `0x${account.address}`;
          } else {
            throw new Error('Invalid wallet address format');
          }
          
          setWalletAddress(formattedAddress);
          await checkUser(formattedAddress);
        } catch (error) {
          handleError(error, "formatting wallet address");
        }
      } else {
        setShowUserCreation(false);
        setShowWelcomePopup(false);
        setUsername("");
        setWelcomeMessage("");
        setWalletAddress("");
        setUserData(null);
      }
    };

    handleWalletConnection();
  }, [connected, account, checkUser, handleError]);

  // Auto-hide welcome popup after 5 seconds
  useEffect(() => {
    let timeoutId;
    if (showWelcomePopup) {
      timeoutId = setTimeout(() => {
        setShowWelcomePopup(false);
      }, 5000);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [showWelcomePopup]);

  return (
    <>
      <div className="wallet-connect">
        <WalletSelector />
        {(error || walletError) && (
          <div className="error-message">
            <p>{error || walletError.message}</p>
            <button 
              className="retry-button"
              onClick={() => {
                setError(null);
                setIsChecking(false);
              }}
            >
              Try Again
            </button>
          </div>
        )}
        {isChecking && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <p>Checking account...</p>
          </div>
        )}
      </div>

      {showUserCreation && (
        <UserCreation
          walletAddress={walletAddress}
          onComplete={handleUserCreationComplete}
        />
      )}

      <PopupBox
        isOpen={showWelcomePopup && welcomeMessage !== ""}
        onClose={() => setShowWelcomePopup(false)}
        content={
          <div className="welcome-message">
            {welcomeMessage.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        }
        buttonPosition={{ top: 20, left: 20 }}
      />
    </>
  );
}

export default WalletConnect; 