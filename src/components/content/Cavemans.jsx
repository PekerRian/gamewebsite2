import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { request } from "graphql-request";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { db } from "../../firebase/config";
import { collection, setDoc, doc, getDoc, updateDoc, query, where, getDocs, writeBatch } from "firebase/firestore";
import { inventoryOperations } from "../../utils/inventoryOperations";
import { aptosClient, APTOS_CONFIG, getRequestHeaders } from '../../config/aptos';
import gameItems from '../../data/gameItems.json';
import './content.css';

// Constants
const COLLECTION_ID = "0x13049480ae8f39cb21c9a0ee8805f248ed8d12d4d70da29daf324e21a3ffe97b";
const HUNTING_DURATION = 10000; // 10 seconds in milliseconds
const STORAGE_KEY = 'hunting_state';
const REWARDS_KEY = 'pending_rewards';

// Loot Popup Component
const LootPopup = ({ loot, onAccept, onClose }) => {
  return (
    <>
      <button 
        className="close-button"
        onClick={onClose}
      >
        ×
      </button>
      <div className="loot-popup-overlay">
        <div className="loot-popup-wrapper">
          <div className="loot-popup">
            <h3>Hunting Results</h3>
            <div className="loot-items">
              {Object.entries(loot).map(([item, amount]) => (
                <div key={item} className="loot-item">
                  <span>{item}: {amount}</span>
                </div>
              ))}
            </div>
            <button className="accept-button" onClick={onAccept}>Accept Loot</button>
          </div>
        </div>
      </div>
    </>
  );
};

// Loot Display Component
const LootDisplay = ({ loot, onAccept, onDiscard, onClose }) => {
  return (
    <div className="loot-display-overlay">
      <div className="loot-display">
        <div className="loot-content">
          <h3>Hunting Rewards</h3>
          <div className="loot-items-display">
            {Object.entries(loot).map(([item, amount]) => (
              <div key={item} className="loot-item-display">
                <img 
                  src={`/items/${item.toLowerCase()}.png`} 
                  alt={item} 
                  className="loot-item-image"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/items/default-item.png';
                  }}
                />
                <div className="loot-item-quantity">x{amount}</div>
              </div>
            ))}
          </div>
          <div className="loot-actions">
            <button className="accept-loot-button" onClick={onAccept}>
              Accept Rewards
            </button>
            <button className="discard-loot-button" onClick={onDiscard}>
              Discard
            </button>
          </div>
        </div>
      </div>
      <button className="close-button" onClick={onClose}>×</button>
    </div>
  );
};

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

const saveHuntingState = (huntingState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(
    Array.from(huntingState.entries()).map(([key, value]) => ({
      id: key,
      endTime: value
    }))
  ));
};

const savePendingRewards = (rewards) => {
  localStorage.setItem(REWARDS_KEY, JSON.stringify(Array.from(rewards)));
};

const loadHuntingState = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return new Map();
  
  const state = new Map();
  JSON.parse(saved).forEach(({ id, endTime }) => {
    // Only load if the hunt hasn't finished
    if (endTime > Date.now()) {
      state.set(id, endTime);
    }
  });
  return state;
};

const loadPendingRewards = () => {
  const saved = localStorage.getItem(REWARDS_KEY);
  return saved ? new Set(JSON.parse(saved)) : new Set();
};

// Memoize the NFTCard component
const NFTCard = React.memo(({ nft, onAction, isHunting, huntingTimeLeft, canClaim }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleClick = useCallback((e) => {
    if (!isHunting) {
    setIsFlipped(!isFlipped);
    }
  }, [isHunting]);

  const handleAction = useCallback((action) => {
    if (!isHunting || action === 'claim') {
    onAction(nft, action);
      setIsFlipped(false);
    }
  }, [isHunting, nft, onAction]);

  return (
    <div className={`nft-card ${isFlipped ? 'flipped' : ''} ${isHunting ? 'hunting' : ''} ${canClaim ? 'can-claim' : ''}`} onClick={handleClick}>
      <div className="card-inner">
        <div className="card-front">
          {isHunting && (
            <div className="hunting-overlay">
              <div>HUNTING</div>
              <div className="countdown">{Math.ceil(huntingTimeLeft / 1000)}s</div>
            </div>
          )}
          {canClaim && (
            <div className="claim-overlay">
              <button 
                className="claim-button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction('claim');
                }}
              >
                CLAIM REWARDS
              </button>
            </div>
          )}
          <img 
            src={nft.metadata?.image || nft.current_token_data.token_uri} 
            alt={nft.current_token_data.token_name || 'NFT'} 
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/placeholder-nft.png';
            }}
          />
        </div>
        <div className="card-back">
          <div className="action-buttons">
            <button 
              onClick={(e) => { e.stopPropagation(); handleAction('hunt'); }}
              disabled={isHunting || canClaim}
            >
              Hunt
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); handleAction('farm'); }}
              disabled={isHunting || canClaim}
            >
              Farm
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); handleAction('rent'); }}
              disabled={isHunting || canClaim}
            >
              Rent Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

function Cavemans() {
  const { connected, account, wallet } = useWallet();
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [collectionName, setCollectionName] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [userId, setUserId] = useState(null);
  const [huntingNFTs, setHuntingNFTs] = useState(() => loadHuntingState());
  const [lootPopup, setLootPopup] = useState(null);
  const [countdowns, setCountdowns] = useState(new Map());
  const [pendingRewards, setPendingRewards] = useState(() => loadPendingRewards());
  const [processingRewards, setProcessingRewards] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ total: 0, loaded: 0, status: 'Fetching NFTs...' });
  const [loadedTokenIds, setLoadedTokenIds] = useState(new Set());
  
  // Persisted flag to prevent future fetches after a successful fetch
  const fetchedRef = useRef(false);

  // Utility function to convert Uint8Array to hex string
  const uint8ArrayToHex = (uint8Array) =>
    Array.from(uint8Array)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

  // Memoize the wallet state logging function
  const logWalletState = useCallback(() => {
    console.log("Detailed Wallet Connection State:", {
      connected,
      walletName: wallet?.name,
      walletConnected: wallet?.connected,
      accountExists: !!account,
      accountPublicKey: account?.publicKey?.toString(),
      accountAddress: account?.address,
      accountAddressType: account?.address ? typeof account.address : 'undefined',
      accountAddressData: account?.address?.data ? 'Has data' : 'No data',
      rawAccount: account
    });
  }, [connected, account, wallet]);

  // Get user document ID from Firebase
  const getUserDocId = async (walletAddr) => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('walletAddress', '==', walletAddr));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        return querySnapshot.docs[0].id;
      }
      return null;
    } catch (error) {
      console.error('Error getting user doc ID:', error);
      return null;
    }
  };

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
      const response = await request(APTOS_CONFIG.INDEXER_URL, collectionQuery, variables, getRequestHeaders());
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

  // Batch NFT updates
  const batchUpdateNFTs = useCallback(async (updates) => {
    const batch = writeBatch(db);
    
    updates.forEach(({ nftId, data }) => {
      const nftRef = doc(db, "cavemans", nftId);
      batch.update(nftRef, {
        ...data,
        lastUpdated: new Date().toISOString()
      });
    });

    await batch.commit();
  }, []);

  // Optimize NFT fetching with batching and caching
  const fetchNFTs = useCallback(async () => {
    if (fetchedRef.current) {
      console.log("NFTs already fetched, skipping.");
      return;
    }

    if (!connected || !account) {
      console.log("Wallet not connected or account unavailable.");
      setError("Please connect your wallet to view NFTs.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Format wallet address
      const formattedAddress = account.address?.data 
        ? `0x${uint8ArrayToHex(new Uint8Array(account.address.data))}`
        : (typeof account.address === 'string' 
            ? (account.address.startsWith('0x') ? account.address : `0x${account.address}`)
            : null);

      if (!formattedAddress) {
        throw new Error('Invalid wallet address format');
      }

      setWalletAddress(formattedAddress);

      // Get user document ID
      const docId = await getUserDocId(formattedAddress);
      if (!docId) {
        setError("User not found. Please create an account first.");
        setLoading(false);
        return;
      }
      setUserId(docId);

      // Query collection tokens
      const response = await request(
        APTOS_CONFIG.INDEXER_URL,
        `query GetCollectionTokens($address: String!, $collection_id: String!) {
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
                collection_id
              }
            amount
            last_transaction_version
          }
        }`,
        { 
          address: formattedAddress,
          collection_id: COLLECTION_ID
        },
        getRequestHeaders()
      );

      const tokens = response?.current_token_ownerships_v2 || [];
      
      if (tokens.length === 0) {
        setNfts([]);
        setLoading(false);
        fetchedRef.current = true;
        return;
      }

      setLoadingProgress({
        total: tokens.length,
        loaded: 0,
        status: `Found ${tokens.length} NFTs. Loading metadata...`
      });

      // Process tokens in parallel with rate limiting
      const processedTokens = [];
      const batchSize = 5;
      
      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (token) => {
            try {
              if (loadedTokenIds.has(token.token_data_id)) return null;

              const metadata = await fetch(token.current_token_data.token_uri).then(res => res.json());
              const nftWithMetadata = { ...token, metadata };
              
              await saveNFTToFirebase(nftWithMetadata);
              return nftWithMetadata;
            } catch (err) {
              console.error("Error processing token:", err);
              return null;
            }
          })
        );

        const validResults = results.filter(Boolean);
        processedTokens.push(...validResults);

        setLoadingProgress(prev => ({
          ...prev,
          loaded: Math.min(prev.loaded + validResults.length, prev.total),
          status: `Loaded ${Math.min(prev.loaded + validResults.length, prev.total)} of ${prev.total} NFTs...`
        }));

        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      setNfts(processedTokens);
      fetchedRef.current = true;

    } catch (err) {
      console.error("Error fetching NFTs:", err);
      setError(err.message || "Failed to fetch NFTs");
    } finally {
      setLoading(false);
    }
  }, [connected, account, loadedTokenIds, walletAddress]);

  // Effect to fetch NFTs and collection name when wallet connection changes
  useEffect(() => {
    if (connected && account && !fetchedRef.current) {
      fetchNFTs();
      fetchCollectionName(COLLECTION_ID);
    }
  }, [connected, account, fetchNFTs, fetchCollectionName]);

  // Update NFT status in Firebase
  const updateNFTStatus = async (nft, status) => {
    try {
      const nftRef = doc(db, "cavemans", nft.token_data_id);
      await updateDoc(nftRef, {
        status: status,
        lastUpdated: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error updating NFT status:", err);
    }
  };

  // Generate random loot based on hunting skill
  const generateLoot = (huntingSkill) => {
    const baseAmount = Math.floor(Math.random() * 3) + 1; // 1-3 base items
    const skillBonus = Math.floor(huntingSkill / 20); // bonus items based on skill
    return {
      "Raw_Meat": baseAmount + skillBonus
    };
  };

  // Modified handleAcceptLoot
  const handleAcceptLoot = async () => {
    if (!lootPopup || !userId) return;

    try {
      // Add items to user's inventory
      await Promise.all(
        Object.entries(lootPopup.loot).map(([itemId, amount]) =>
          inventoryOperations.addItems(userId, "materials", itemId, amount)
        )
      );

      // Update NFT status and clear pendingLoot
      const nftRef = doc(db, "cavemans", lootPopup.nft.token_data_id);
      await updateDoc(nftRef, {
        status: "idle",
        pendingLoot: null,
        lastUpdated: new Date().toISOString()
      });

      // Remove from pending rewards
      setPendingRewards(prev => {
        const newSet = new Set(prev);
        newSet.delete(lootPopup.nft.token_data_id);
        savePendingRewards(newSet);
        return newSet;
      });

      // Close popup
      setLootPopup(null);
    } catch (error) {
      console.error("Error accepting loot:", error);
      setError("Failed to add items to inventory");
    }
  };

  // Handle close popup
  const handleClosePopup = () => {
    setLootPopup(null);
  };

  // Modified handleNFTAction
  const handleNFTAction = async (nft, action) => {
    if (!userId) {
      setError("Please connect your wallet first");
      return;
    }

    try {
      switch (action) {
        case 'hunt':
          // Start hunting
          const endTime = Date.now() + HUNTING_DURATION;
          setHuntingNFTs(prev => {
            const newMap = new Map(prev);
            newMap.set(nft.token_data_id, endTime);
            saveHuntingState(newMap);
            return newMap;
          });

          // Update NFT status in Firebase
          await updateNFTStatus(nft, 'hunting');

          // Set countdown
          setCountdowns(prev => {
            const newMap = new Map(prev);
            newMap.set(nft.token_data_id, HUNTING_DURATION);
            return newMap;
          });

          // Set up timer to handle hunt completion
          setTimeout(async () => {
            try {
              // Generate loot based on NFT's hunting skill
              const loot = generateLoot(nft.stats?.huntingSkill || 50);
              
              // Add to pending rewards
              setPendingRewards(prev => {
                const newSet = new Set(prev);
                newSet.add(nft.token_data_id);
                savePendingRewards(newSet);
                return newSet;
              });

              // Update NFT status
              await updateNFTStatus(nft, 'idle');

              // Remove from hunting state
              setHuntingNFTs(prev => {
                const newMap = new Map(prev);
                newMap.delete(nft.token_data_id);
                saveHuntingState(newMap);
                return newMap;
              });

              // Store loot in Firebase
              const nftRef = doc(db, 'cavemans', nft.token_data_id);
              await updateDoc(nftRef, {
                pendingLoot: loot
              });

            } catch (error) {
              console.error('Error completing hunt:', error);
              setError('Failed to complete hunting. Please try again.');
            }
          }, HUNTING_DURATION);
          break;

        case 'claim':
          try {
            // Get the NFT's pending loot from Firebase
            const nftRef = doc(db, 'cavemans', nft.token_data_id);
            const nftDoc = await getDoc(nftRef);
            
            if (nftDoc.exists() && nftDoc.data().pendingLoot) {
              const loot = nftDoc.data().pendingLoot;
              
              // Show loot popup
              setLootPopup({
                nft: nft,
                loot: loot,
                onAccept: async () => {
                  await handleAcceptLoot(nft.token_data_id, loot);
                  // Remove from pending rewards
                  setPendingRewards(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(nft.token_data_id);
                    savePendingRewards(newSet);
                    return newSet;
                  });
                },
                onDiscard: async () => {
                  await handleDiscardLoot(nft.token_data_id);
                  // Remove from pending rewards
                  setPendingRewards(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(nft.token_data_id);
                    savePendingRewards(newSet);
                    return newSet;
                  });
                }
              });
            }
          } catch (error) {
            console.error('Error claiming rewards:', error);
            setError('Failed to claim rewards. Please try again.');
          }
          break;

        case 'farm':
          // Implement farming logic
          break;

        case 'rent':
          // Implement renting logic
          break;

        default:
          console.warn(`Unknown action: ${action}`);
      }
    } catch (error) {
      console.error('Error handling NFT action:', error);
      setError(`Failed to ${action}. Please try again.`);
    }
  };

  // Add handleDiscardLoot function
  const handleDiscardLoot = async () => {
    if (!lootPopup) return;

    try {
      // Update NFT status
      await updateNFTStatus(lootPopup.nft, "idle");

      // Close popup without adding items to inventory
      setLootPopup(null);
    } catch (error) {
      console.error("Error discarding loot:", error);
      setError("Failed to discard items");
    }
  };

  // Memoize the NFT grid rendering
  const renderNFTGrid = useMemo(() => {
    if (!userId) {
      return <div><p>Please create an account first</p></div>;
    }
    
    if (nfts.length === 0 && !loadingProgress.total) {
      return <div><p>No NFTs found in this collection</p></div>;
    }

    return nfts.map((nft) => (
      <NFTCard 
        key={nft.token_data_id}
        nft={nft} 
        onAction={handleNFTAction}
        isHunting={huntingNFTs.has(nft.token_data_id)}
        huntingTimeLeft={countdowns.get(nft.token_data_id) || 0}
        canClaim={pendingRewards.has(nft.token_data_id)}
      />
    ));
  }, [userId, nfts, huntingNFTs, countdowns, handleNFTAction, pendingRewards]);

  // Effect to handle hunting timers and state persistence
  useEffect(() => {
    saveHuntingState(huntingNFTs);
    const interval = setInterval(() => {
      const now = Date.now();
      const newCountdowns = new Map();
      const newPendingRewards = new Set(pendingRewards);
      let stateChanged = false;

      huntingNFTs.forEach((endTime, nftId) => {
        const timeLeft = Math.max(0, endTime - now);
        if (timeLeft > 0) {
          newCountdowns.set(nftId, timeLeft);
        } else if (!pendingRewards.has(nftId)) {
          // Hunt just completed, add to pending rewards
          newPendingRewards.add(nftId);
          stateChanged = true;
        }
      });

      setCountdowns(newCountdowns);
      if (stateChanged) {
        setPendingRewards(newPendingRewards);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [huntingNFTs, pendingRewards]);

  // Effect to save pending rewards state
  useEffect(() => {
    savePendingRewards(pendingRewards);
  }, [pendingRewards]);

  if (!connected) {
    return (
      <div className="cavemans-container">
        <div className="nft-display">
          <p>Please connect your wallet to view NFTs.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="cavemans-container">
        <div className="nft-display">
          <p>Loading NFTs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cavemans-container">
        <div className="nft-display">
          <p className="error-message">{error}</p>
          {walletAddress && <p>Connected Wallet: {walletAddress}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="cavemans-container">
      {error && <div className="error-message">{error}</div>}
      <div className="nft-display">
        <h2>{collectionName || 'Caveman'} NFTs</h2>
        {walletAddress && <p>Connected Wallet: {walletAddress}</p>}
        {loadingProgress.total > 0 && (
          <div className="loading-progress">
            <div>{loadingProgress.status}</div>
            <div>Progress: {loadingProgress.loaded} / {loadingProgress.total}</div>
          </div>
        )}
        <div className="nft-grid">
          {renderNFTGrid}
        </div>
      </div>
      {lootPopup && (
        <LootDisplay
          loot={lootPopup.loot}
          onAccept={handleAcceptLoot}
          onDiscard={handleDiscardLoot}
          onClose={handleClosePopup}
        />
      )}
    </div>
  );
}

export default Cavemans; 