import { db } from '../firebase/config';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import gameItems from '../data/gameItems.json';

// Function to generate empty inventory based on gameItems
const generateEmptyInventory = () => {
  return {
    consumables: Object.fromEntries(gameItems.consumables.map(item => [item.id, 0])),
    materials: Object.fromEntries(gameItems.materials.map(item => [item.id, 0])),
    articles: Object.fromEntries(gameItems.articles.map(item => [item.id, 0]))
  };
};

// Function to update all users' inventories with new items
export const updateAllUsersInventories = async () => {
  try {
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);

    const updatePromises = usersSnapshot.docs.map(async (doc) => {
      const userData = doc.data();
      const currentInventory = userData.inventory || {};

      // Update each category with any missing items
      const updatedInventory = {
        consumables: {
          ...currentInventory.consumables || {},
          ...Object.fromEntries(
            gameItems.consumables
              .filter(item => !(currentInventory.consumables || {})[item.id])
              .map(item => [item.id, 0])
          )
        },
        materials: {
          ...currentInventory.materials || {},
          ...Object.fromEntries(
            gameItems.materials
              .filter(item => !(currentInventory.materials || {})[item.id])
              .map(item => [item.id, 0])
          )
        },
        articles: {
          ...currentInventory.articles || {},
          ...Object.fromEntries(
            gameItems.articles
              .filter(item => !(currentInventory.articles || {})[item.id])
              .map(item => [item.id, 0])
          )
        }
      };

      return updateDoc(doc.ref, { inventory: updatedInventory });
    });

    await Promise.all(updatePromises);
    console.log('All users inventories updated successfully');
    return true;
  } catch (error) {
    console.error('Error updating user inventories:', error);
    throw error;
  }
};

// Function to check if an inventory needs updating
export const checkInventoryNeedsUpdate = (inventory) => {
  if (!inventory) return true;

  // Check if all current gameItems exist in the inventory
  const needsUpdate = {
    consumables: gameItems.consumables.some(item => !inventory.consumables?.[item.id]),
    materials: gameItems.materials.some(item => !inventory.materials?.[item.id]),
    articles: gameItems.articles.some(item => !inventory.articles?.[item.id])
  };

  return needsUpdate.consumables || needsUpdate.materials || needsUpdate.articles;
};

export const inventoryOperations = {
  // Get a user's inventory
  getUserInventory: async (userId) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        return userDoc.data().inventory || null;
      }
      return null;
    } catch (error) {
      console.error('Error getting user inventory:', error);
      throw error;
    }
  },

  // Add items to a user's inventory
  addItems: async (userId, category, itemId, amount) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const currentInventory = userDoc.data().inventory || {};
      const categoryItems = currentInventory[category] || {};
      const currentAmount = categoryItems[itemId] || 0;

      await updateDoc(userRef, {
        [`inventory.${category}.${itemId}`]: currentAmount + amount
      });

      return true;
    } catch (error) {
      console.error('Error adding items:', error);
      throw error;
    }
  },

  // Remove items from a user's inventory
  removeItems: async (userId, category, itemId, amount) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const currentInventory = userDoc.data().inventory || {};
      const categoryItems = currentInventory[category] || {};
      const currentAmount = categoryItems[itemId] || 0;

      if (currentAmount < amount) {
        throw new Error('Not enough items');
      }

      await updateDoc(userRef, {
        [`inventory.${category}.${itemId}`]: currentAmount - amount
      });

      return true;
    } catch (error) {
      console.error('Error removing items:', error);
      throw error;
    }
  },

  // Check if user has enough of an item
  hasEnoughItems: async (userId, category, itemId, amount) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        return false;
      }

      const inventory = userDoc.data().inventory || {};
      return inventory[category]?.[itemId] >= amount;
    } catch (error) {
      console.error('Error checking items:', error);
      return false;
    }
  }
}; 