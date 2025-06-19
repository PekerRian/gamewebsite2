import React, { useState, useCallback } from 'react';
import { db } from '../firebase/config';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import './UserCreation.css';

// Function to handle Firebase errors
const handleFirebaseError = (error) => {
  console.error('Firebase error:', error);
  return error.message || 'An unexpected error occurred. Please try again.';
};

const UserCreation = ({ walletAddress, onComplete }) => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Validate username as user types
  const validateUsername = useCallback(async (value) => {
    if (!value) return false;
    
    // Check length and characters
    const isValidFormat = value.length >= 3 && value.length <= 20 && /^[A-Za-z0-9_-]+$/.test(value);
    if (!isValidFormat) return false;

    try {
      // Check if username is taken
      const usersRef = collection(db, 'users');
      const usernameQuery = query(usersRef, where('username', '==', value.toLowerCase()));
      const usernameSnapshot = await getDocs(usernameQuery);
      return usernameSnapshot.empty;
    } catch (err) {
      console.error('Error checking username:', err);
      return false;
    }
  }, []);

  const handleUsernameChange = useCallback(async (e) => {
    const value = e.target.value.trim();
    setUsername(value);
    setError('');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Final validation check
      const isValid = await validateUsername(username);
      if (!isValid) {
        setError('Username is invalid or already taken.');
        setIsLoading(false);
        return;
      }

      // Create user document
      const usersRef = collection(db, 'users');
      const userId = doc(usersRef).id;
      
      const userData = {
        id: userId,
        username: username.toLowerCase(),
        displayName: username,
        walletAddress,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      };

      await setDoc(doc(usersRef, userId), userData);
      
      // Complete the process
      onComplete(userData);

    } catch (err) {
      console.error('Error creating user:', err);
      setError(handleFirebaseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="user-creation-overlay">
      <div className="user-creation-modal">
        <h2>Create Your Account</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Choose a Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={handleUsernameChange}
              placeholder="Enter username"
              required
              minLength={3}
              maxLength={20}
              pattern="[A-Za-z0-9_-]+"
              title="Username can only contain letters, numbers, underscores, and hyphens"
              disabled={isLoading}
            />
          </div>
          {error && (
            <div className="error-message">
              <p>{error}</p>
            </div>
          )}
          <button 
            type="submit" 
            disabled={isLoading || !username}
            className={isLoading ? 'loading' : ''}
          >
            {isLoading ? 'Creating...' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UserCreation; 