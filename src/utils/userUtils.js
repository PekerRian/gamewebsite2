import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { formatWalletAddress, isValidWalletAddress } from './walletUtils';

/**
 * Checks if a wallet address already has an associated account
 * @param {string} walletAddress - The wallet address to check
 * @returns {Promise<{exists: boolean, userData: object|null, error: string|null}>}
 */
export const checkWalletAccount = async (walletAddress) => {
  try {
    if (!walletAddress) {
      return {
        exists: false,
        userData: null,
        error: 'No wallet address provided'
      };
    }

    // Validate and format the wallet address
    if (!isValidWalletAddress(walletAddress)) {
      return {
        exists: false,
        userData: null,
        error: 'Invalid wallet address format'
      };
    }

    const formattedAddress = formatWalletAddress(walletAddress);
    
    // Query Firestore for the wallet address
    const usersRef = collection(db, 'users');
    const walletQuery = query(usersRef, where('walletAddress', '==', formattedAddress));
    const walletSnapshot = await getDocs(walletQuery);

    if (walletSnapshot.empty) {
      return {
        exists: false,
        userData: null,
        error: null
      };
    }

    // Return the existing user data
    const userDoc = walletSnapshot.docs[0];
    const userData = userDoc.data();

    return {
      exists: true,
      userData: {
        ...userData,
        id: userDoc.id,
        lastChecked: new Date().toISOString()
      },
      error: null
    };

  } catch (error) {
    console.error('Error checking wallet account:', error);
    return {
      exists: false,
      userData: null,
      error: error.message || 'Error checking wallet account'
    };
  }
}; 