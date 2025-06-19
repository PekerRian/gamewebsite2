import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

// API Configuration
export const APTOS_CONFIG = {
  API_KEY: import.meta.env.VITE_APTOS_API_KEY,
  NODE_URL: import.meta.env.VITE_APTOS_NODE_URL || 'https://api.mainnet.aptoslabs.com/v1',
  INDEXER_URL: import.meta.env.VITE_APTOS_INDEXER_URL || 'https://indexer.mainnet.aptoslabs.com/v1/graphql',
  INDEXER_API_KEY: import.meta.env.VITE_APTOS_INDEXER_API_KEY
};

// Client Configuration
const clientConfig = {
  API_KEY: APTOS_CONFIG.API_KEY
};

// Create Aptos client configuration
const config = new AptosConfig({ 
  network: Network.MAINNET,
  clientConfig
});

// Export the Aptos client
export const aptosClient = new Aptos(config);

export const getRequestHeaders = () => ({
  'x-indexer-api-key': APTOS_CONFIG.INDEXER_API_KEY
}); 