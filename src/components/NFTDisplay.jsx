import React, { useEffect, useState, useCallback, useRef } from "react";
import { request } from "graphql-request";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { db } from "../firebase/config";
import { collection, setDoc, doc, getDoc } from "firebase/firestore";
import "./NFTDisplay.css";

// Constants
const APTOS_GRAPHQL_URL = "https://indexer.mainnet.aptoslabs.com/v1/graphql";
const COLLECTION_ID = "0x13049480ae8f39cb21c9a0ee8805f248ed8d12d4d70da29daf324e21a3ffe97b";

const generateRandomStats = () => {
  return {
    bond: 0,
    cookingSkill: Math.floor(Math.random() * 100),
    energy: Math.floor(Math.random() * 100),
    huntingSkill: Math.floor(Math.random() * 100),
    status: "idle"
  };
};

const extractTribeFromMetadata = (metadata) => {
  if (!metadata) return "Unknown";
  
  // Check attributes array for skin attribute
  if (metadata.attributes && Array.isArray(metadata.attributes)) {
    const skinAttribute = metadata.attributes.find(
      attr => attr.trait_type?.toLowerCase() === "skin" || 
             attr.traitType?.toLowerCase() === "skin"
    );
    if (skinAttribute) {
      return skinAttribute.value;
    }
  }

  // Check properties object for skin
  if (metadata.properties && metadata.properties.skin) {
    return metadata.properties.skin;
  }

  // Check direct skin property
  if (metadata.skin) {
    return metadata.skin;
  }

  return "Unknown";
};

const NFTDisplay = () => {
  const { connected, account, wallet } = useWallet();
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [collectionName, setCollectionName] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  
  // Persisted flag to prevent future fetches after a successful fetch
  const fetchedRef = useRef(false);

  // Utility function to convert Uint8Array to hex string
  const uint8ArrayToHex = (uint8Array) =>
    Array.from(uint8Array)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

  // Save NFT data to Firebase
  const saveNFTToFirebase = async (nft) => {
    try {
      const nftRef = doc(db, "cavemans", nft.token_data_id);
      
      // Check if NFT already exists in database
      const nftDoc = await getDoc(nftRef);
      if (nftDoc.exists()) {
        console.log("NFT already exists in database:", nft.token_data_id);
        return;
      }

      // Generate initial stats
      const stats = generateRandomStats();
      
      // Extract tribe from metadata
      const tribe = extractTribeFromMetadata(nft.metadata);
      console.log("Extracted tribe for NFT:", nft.token_data_id, tribe);
      
      // Prepare NFT data
      const nftData = {
        ...stats,
        name: nft.metadata?.name || nft.current_token_data.token_name,
        tribe: tribe,
        tokenId: nft.token_data_id,
        owner: walletAddress,
        lastUpdated: new Date().toISOString()
      };

      // Save to Firebase
      await setDoc(nftRef, nftData);
      console.log("Saved NFT to Firebase:", nft.token_data_id, nftData);
    } catch (err) {
      console.error("Error saving NFT to Firebase:", err);
    }
  };

  // Debug function to log wallet state
  const logWalletState = useCallback(() => {
    console.log("Wallet Connection State:", {
      connected,
      wallet: wallet?.name,
      accountExists: !!account,
      accountAddress: account?.address,
      accountAddressType: account?.address ? typeof account.address : 'undefined',
      accountAddressData: account?.address?.data ? 'Has data' : 'No data'
    });
  }, [connected, account, wallet]);

  // Fetch and log the collection name
  const fetchCollectionName = useCallback(async (collectionId) => {
    try {
      const collectionQuery = `
        query GetCollectionName($collection_id: String) {
          current_collections_v2(where: { collection_id: { _eq: $collection_id } }) {
            collection_name
            description
            uri
          }
        }
      `;
      const variables = { collection_id: collectionId };
      const response = await request(APTOS_GRAPHQL_URL, collectionQuery, variables);
      const name = response?.current_collections_v2?.[0]?.collection_name;
      if (name) {
        console.log("Collection name for", collectionId, "is:", name);
        setCollectionName(name);
      } else {
        console.log("No collection found for", collectionId);
      }
    } catch (e) {
      console.error("Failed to fetch collection name:", e);
    }
  }, []);

  // Fetch NFTs based on the connected wallet
  const fetchNFTs = useCallback(async () => {
    if (fetchedRef.current) return;

    logWalletState();

    if (!connected || !account) {
      console.log("Wallet not connected or account unavailable.");
      return;
    }

    let formattedAddress;
    try {
      if (account.address?.data) {
        formattedAddress = `0x${uint8ArrayToHex(new Uint8Array(account.address.data))}`;
      } else if (typeof account.address === 'string') {
        formattedAddress = account.address.startsWith('0x') ? account.address : `0x${account.address}`;
      } else {
        throw new Error('Invalid wallet address format');
      }

      console.log("Using wallet address for query:", formattedAddress);
      setWalletAddress(formattedAddress);
    } catch (error) {
      console.error("Error formatting wallet address:", error);
      setError("Failed to read wallet address");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const query = `
        query GetCollectionTokens($address: String!, $collection_id: String!) {
          current_token_ownerships_v2(
            where: {
              owner_address: { _eq: $address },
              current_token_data: { collection_id: { _eq: $collection_id } },
              amount: { _gt: "0" }
            }
          ) {
            token_data_id
            current_token_data {
              token_name
              token_uri
              token_properties
              description
              collection_id
            }
            amount
            last_transaction_version
            table_type_v2
          }
        }
      `;

      const variables = { 
        address: formattedAddress,
        collection_id: COLLECTION_ID
      };

      const response = await request(APTOS_GRAPHQL_URL, query, variables);
      const tokens = response?.current_token_ownerships_v2 || [];

      // Process and set NFTs with metadata
      const processedNFTs = await Promise.all(tokens.map(async (token) => {
        try {
          // Fetch metadata from token_uri if available
          let metadata = {};
          if (token.current_token_data.token_uri) {
            try {
              const metadataResponse = await fetch(token.current_token_data.token_uri);
              metadata = await metadataResponse.json();
            } catch (e) {
              console.warn('Failed to fetch metadata for token:', token.token_data_id);
            }
          }

          // Get or generate stats
          const statsDoc = await getDoc(doc(db, 'nft_stats', token.token_data_id));
          const stats = statsDoc.exists() ? statsDoc.data() : generateRandomStats();

          // Save stats if they don't exist
          if (!statsDoc.exists()) {
            await setDoc(doc(db, 'nft_stats', token.token_data_id), stats);
          }

          return {
            ...token,
            metadata,
            stats,
            tribe: extractTribeFromMetadata(metadata)
          };
        } catch (e) {
          console.error('Error processing NFT:', e);
          return token;
        }
      }));

      setNfts(processedNFTs);
      fetchedRef.current = true;
    } catch (error) {
      console.error("Error fetching NFTs:", error);
      setError("Failed to fetch NFTs. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [connected, account, wallet]);

  // Effect to fetch NFTs and collection name only once after success
  useEffect(() => {
    if (!fetchedRef.current) {
      fetchNFTs();
      fetchCollectionName(COLLECTION_ID);
    }
  }, [fetchNFTs, fetchCollectionName]);

  if (!connected) {
    return (
      <div className="nft-display">
        <p>Please connect your wallet to view NFTs.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="nft-display">
        <p>Loading NFTs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="nft-display">
        <p className="error-message">{error}</p>
        {walletAddress && <p>Connected Wallet: {walletAddress}</p>}
      </div>
    );
  }

  return (
    <div className="nft-display">
      <h2>{collectionName || 'Caveman'} NFTs</h2>
      {walletAddress && <p>Connected Wallet: {walletAddress}</p>}
      <div className="nft-grid">
        {nfts.length === 0 ? (
          <div>
            <p>No NFTs found in this collection</p>
          </div>
        ) : (
          nfts.map((nft, index) => (
            <div key={index} className="nft-card">
              <img 
                src={nft.metadata?.image || nft.current_token_data.token_uri} 
                alt={nft.current_token_data.token_name || 'NFT'} 
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/placeholder-nft.png';
                }}
              />
              <div className="nft-info">
                <h3>{nft.current_token_data.token_name || 'Unnamed NFT'}</h3>
                <p>{nft.current_token_data.description || 'No description'}</p>
                <p>Collection: {collectionName}</p>
                <p>Last Transaction Version: {nft.last_transaction_version}</p>
                <p className="amount">Amount: {nft.amount}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NFTDisplay; 