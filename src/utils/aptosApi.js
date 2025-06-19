const NODE_API_KEY = import.meta.env.VITE_APTOS_NODE_API_KEY;
const API_BASE_URL = 'https://api.mainnet.aptoslabs.com/v1';

// Headers for authenticated requests
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'x-aptos-api-key': NODE_API_KEY
});

// Utility functions for API calls
export const aptosApi = {
  // Get account information
  getAccount: async (address) => {
    try {
      const response = await fetch(`${API_BASE_URL}/accounts/${address}`, {
        headers: getHeaders()
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching account:', error);
      throw error;
    }
  },

  // Get account resources
  getAccountResources: async (address) => {
    try {
      const response = await fetch(`${API_BASE_URL}/accounts/${address}/resources`, {
        headers: getHeaders()
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching account resources:', error);
      throw error;
    }
  },

  // Get account transactions
  getAccountTransactions: async (address, limit = 25) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/accounts/${address}/transactions?limit=${limit}`, 
        {
          headers: getHeaders()
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching account transactions:', error);
      throw error;
    }
  },

  // Submit transaction
  submitTransaction: async (transaction) => {
    try {
      const response = await fetch(`${API_BASE_URL}/transactions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(transaction)
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error submitting transaction:', error);
      throw error;
    }
  }
}; 