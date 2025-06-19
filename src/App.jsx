import { PetraWallet } from "petra-plugin-wallet-adapter";
import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import SideNav from './components/SideNav';
import WalletConnect from './components/WalletConnect';
import IsometricTilemap from './components/IsometricTilemap/IsometricTilemap';
import { APTOS_CONFIG } from './config/aptos';
import './App.css';

const wallets = [new PetraWallet()];

// Network configuration for mainnet with API key
const network = {
  name: 'mainnet',
  chainId: '1',
  nodeUrl: APTOS_CONFIG.NODE_URL,
  nodeApiKey: APTOS_CONFIG.API_KEY,
  indexerUrl: APTOS_CONFIG.INDEXER_URL,
  indexerApiKey: APTOS_CONFIG.INDEXER_API_KEY
};

function App() {
  return (
    <AptosWalletAdapterProvider 
      plugins={wallets} 
      autoConnect={true}
      network={network}
    >
      <div className="app-container">
        <WalletConnect />
        <SideNav />
        <main className="main-content">
          {/* Content for each section will go here */}
        </main>
        {/* Tilemap rendered last to be on top */}
        <IsometricTilemap />
      </div>
    </AptosWalletAdapterProvider>
  );
}

export default App;
