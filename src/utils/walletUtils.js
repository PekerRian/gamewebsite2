/**
 * Formats a wallet address to ensure consistent format across the application
 * @param {string|{data: Uint8Array}|{address: string|{data: Uint8Array}}} address - The wallet address to format
 * @returns {string} - The formatted wallet address
 * @throws {Error} - If the address format is invalid
 */
export const formatWalletAddress = (address) => {
  try {
    // Case 1: address is a string
    if (typeof address === 'string') {
      return address.startsWith('0x') ? address.toLowerCase() : `0x${address.toLowerCase()}`;
    }

    // Case 2: address is an object with data property (Uint8Array)
    if (address?.data instanceof Uint8Array) {
      return `0x${Array.from(address.data)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toLowerCase()}`;
    }

    // Case 3: address is an account object with address property
    if (address?.address) {
      return formatWalletAddress(address.address);
    }

    throw new Error('Invalid wallet address format');
  } catch (error) {
    console.error('Error formatting wallet address:', error);
    throw new Error('Invalid wallet address format');
  }
};

/**
 * Validates if a string is a valid wallet address
 * @param {string} address - The wallet address to validate
 * @returns {boolean} - Whether the address is valid
 */
export const isValidWalletAddress = (address) => {
  try {
    if (typeof address !== 'string') return false;
    
    // Remove 0x prefix if present
    const cleanAddress = address.startsWith('0x') ? address.slice(2) : address;
    
    // Check if it's a valid hex string of the correct length (64 characters for Aptos)
    return /^[0-9a-f]{64}$/i.test(cleanAddress);
  } catch {
    return false;
  }
}; 