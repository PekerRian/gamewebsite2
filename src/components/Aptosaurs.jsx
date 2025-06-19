import './components.css';
import React, { useEffect, useState, useCallback, useRef } from "react";
import { request } from "graphql-request";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import "./NFTDisplay.css";

// Constants
const APTOS_GRAPHQL_URL = "https://indexer-testnet.staging.gcp.aptosdev.com/v1/graphql";
const COLLECTION_ID = "0x30f6a9694c2b4df3f34f46164bd40732de9b14e1b716a1bed6d69106dbd312f2";

const AptosaursDisplay = () => {
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

    logWalletState(); // Log wallet state before proceeding

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
      // Pagination variables
      const limit = 50;
      let offset = 0;
      let allNFTs = [];
      let keepFetching = true;

      while (keepFetching) {
        const query = `
          query GetWalletNFTs($owner_address: String!, $limit: Int!, $offset: Int!) {
            current_token_ownerships_v2(
              where: {
                owner_address: { _eq: $owner_address },
                amount: { _gt: "0" }
              },
              limit: $limit,
              offset: $offset
            ) {
              token_data_id
              amount
              last_transaction_version
              token_standard
              current_token_data {
                token_name
                token_uri
                token_properties
                description
                collection_id
              }
            }
          }
        `;

        console.log("Sending query with variables:", {
          owner_address: formattedAddress,
          limit,
          offset
        });

        const response = await request(APTOS_GRAPHQL_URL, query, {
          owner_address: formattedAddress,
          limit,
          offset
        });

        const batchNFTs = response?.current_token_ownerships_v2 || [];
        allNFTs = allNFTs.concat(batchNFTs);
        if (batchNFTs.length < limit) {
          keepFetching = false;
        } else {
          offset += limit;
        }
      }

      console.log("All NFTs in wallet:", allNFTs);

      // Filter NFTs for our collection
      const collectionNFTs = allNFTs.filter(nft => 
        nft.current_token_data?.collection_id === COLLECTION_ID
      );

      console.log("Found NFTs from our collection:", collectionNFTs);

      if (!collectionNFTs.length) {
        setNfts([]);
        setLoading(false);
        fetchedRef.current = true;
        return;
      }

      // Helper function to fetch metadata with retry logic
      const fetchMetadataWithRetry = async (tokenUri, retries = 3) => {
        for (let attempt = 0; attempt < retries; attempt++) {
          try {
            const metadataResponse = await fetch(tokenUri);
            if (!metadataResponse.ok) {
              throw new Error(`Failed to fetch metadata: ${metadataResponse.status}`);
            }
            return await metadataResponse.json();
          } catch (err) {
            console.error(`Retry ${attempt + 1} for metadata:`, err);
            if (attempt === retries - 1) throw err;
          }
        }
      };

      // Process NFTs in batches to avoid rate limits
      const batchSize = 5;
      const nftsWithMetadata = [];
      for (let i = 0; i < collectionNFTs.length; i += batchSize) {
        const batch = collectionNFTs.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(async (nft) => {
            try {
              const metadata = await fetchMetadataWithRetry(nft.current_token_data.token_uri);
              return { ...nft, metadata };
            } catch (err) {
              console.error("Failed to fetch metadata for:", nft, err);
              return nft;
            }
          })
        );
        nftsWithMetadata.push(...batchResults.map((result) => (result.status === "fulfilled" ? result.value : null)));
      }

      setNfts(nftsWithMetadata.filter(Boolean));
      fetchedRef.current = true;
    } catch (err) {
      console.error("Error fetching NFTs:", err);
      setError(err.message || "Failed to fetch NFTs");
    } finally {
      setLoading(false);
    }
  }, [connected, account, logWalletState]);

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
      <h2>{collectionName || 'Aptosaurs'} NFTs</h2>
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

export default AptosaursDisplay; 