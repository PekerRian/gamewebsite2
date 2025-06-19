import React, { useState, useEffect } from 'react';
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from 'firebase/firestore';
import gameItems from '../../data/gameItems.json';
import './content.css';

const categories = ['consumables', 'materials', 'articles'];

function Storage() {
  const { connected, account } = useWallet();
  const [activeCategory, setActiveCategory] = useState('consumables');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showItemDetails, setShowItemDetails] = useState(null);

  // Function to get user's inventory from Firebase
  const fetchUserInventory = async (walletAddress) => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('walletAddress', '==', walletAddress));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('User not found. Please create an account first.');
        setLoading(false);
        return;
      }

      const userData = querySnapshot.docs[0].data();
      setInventory(userData.inventory || {});
      setLoading(false);
    } catch (err) {
      console.error('Error fetching inventory:', err);
      setError('Failed to load inventory');
      setLoading(false);
    }
  };

  // Effect to fetch inventory when wallet is connected
  useEffect(() => {
    if (connected && account?.address) {
      setLoading(true);
      setError(null);
      
      try {
        let formattedAddress;
        if (account.address?.data) {
          formattedAddress = `0x${Array.from(new Uint8Array(account.address.data))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')}`;
        } else if (typeof account.address === 'string') {
          formattedAddress = account.address.startsWith('0x') 
            ? account.address 
            : `0x${account.address}`;
        }
        
        if (formattedAddress) {
          fetchUserInventory(formattedAddress);
        } else {
          throw new Error('Invalid wallet address format');
        }
      } catch (err) {
        console.error('Error processing wallet address:', err);
        setError('Failed to process wallet address');
        setLoading(false);
      }
    } else {
      setInventory(null);
      setError(null);
      setLoading(false);
    }
  }, [connected, account]);

  const handleSlotClick = (index, item) => {
    if (!item && selectedSlot === index) {
      setSelectedSlot(null);
      setShowItemDetails(null);
    } else {
      setSelectedSlot(index);
      setShowItemDetails(item);
    }
  };

  const renderInventoryGrid = () => {
    if (!connected) {
      return <div className="inventory-message">Please connect your wallet to view your inventory</div>;
    }

    if (loading) {
      return <div className="inventory-message">Loading your inventory...</div>;
    }

    if (error) {
      return <div className="inventory-message error">{error}</div>;
    }

    if (!inventory) {
      return <div className="inventory-message">No inventory found. Please create an account first.</div>;
    }

    // Get items for the active category
    const categoryItems = inventory[activeCategory] || {};
    const itemsArray = Object.entries(categoryItems)
      .map(([itemId, quantity]) => {
        const itemData = gameItems[activeCategory]?.find(item => item.id === itemId);
        return itemData ? {
          id: itemId,
          name: itemData.name,
          quantity,
          description: itemData.description,
          image: itemData.image
        } : null;
      })
      .filter(Boolean);

    return (
      <div className="inventory-grid">
        {Array.from({ length: 24 }).map((_, index) => {
          const item = itemsArray[index];
          return (
            <div
              key={index}
              className={`inventory-slot ${selectedSlot === index ? 'selected' : ''} ${item ? 'filled' : ''}`}
              onClick={() => handleSlotClick(index, item)}
            >
              {item && (
                <>
                  <img src={item.image} alt={item.name} />
                  <span className="item-quantity">{item.quantity}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="storage-container">
      <div className="storage-content">
        {/* Category Carousel */}
        <div className="category-carousel">
          <div className="carousel-track">
            {categories.map((category) => (
              <button
                key={category}
                className={`category-button ${activeCategory === category ? 'active' : ''}`}
                onClick={() => setActiveCategory(category)}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Active Category Title */}
        <h2 className="category-title">
          {activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)}
        </h2>

        {/* Inventory Grid */}
        {renderInventoryGrid()}

        {/* Item Details Popup */}
        {showItemDetails && (
          <div className="item-details-overlay">
            <div className="item-details-popup">
              <div className="item-details-content">
                <h3>{showItemDetails.name}</h3>
                <div className="item-icon large">
                  <div className="placeholder-icon" />
                </div>
                <div className="item-info">
                  <p className="item-description">{showItemDetails.description}</p>
                  <p className="item-quantity">Quantity: {showItemDetails.quantity}</p>
                </div>
              </div>
            </div>
            <button 
              className="close-button"
              onClick={() => setShowItemDetails(null)}
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Storage; 