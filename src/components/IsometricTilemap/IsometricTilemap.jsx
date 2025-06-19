import React, { useEffect, useRef, useState, useCallback } from 'react';
import './IsometricTilemap.css';

// Base tile dimensions (original pixel art size)
const BASE_TILE_WIDTH = 32;   // Original pixel art width
const BASE_TILE_HEIGHT = 16;  // Original pixel art height

// Display scale (makes the pixel art tiles visible)
const DISPLAY_SCALE = 2.5;  // Increased zoom from 2.0 to 2.5 (2.5x size)

// Pan sensitivity and momentum settings
const PAN_SETTINGS = {
  SENSITIVITY: 1.0,  // Base sensitivity
  MOMENTUM_DECAY: 0.85,  // How quickly momentum dies down
  MIN_VELOCITY: 0.1,  // Minimum velocity before stopping
  MAX_VELOCITY: 50,  // Maximum velocity cap
  FRAME_RATE: 1000 / 60  // Target 60 FPS
};

// Local storage key for view state
const VIEW_STATE_KEY = 'isometric-view-state';

// Helper function to ensure pixel-perfect numbers
const snapToPixel = (value) => Math.round(value);

// Calculate initial center position based on map size
const calculateInitialCenter = () => {
  // Calculate the total width and height of the map in pixels
  const mapWidthPx = (MAP_WIDTH + MAP_HEIGHT) * (BASE_TILE_WIDTH * DISPLAY_SCALE / 2);
  const mapHeightPx = (MAP_WIDTH + MAP_HEIGHT) * (BASE_TILE_HEIGHT * DISPLAY_SCALE / 2);
  
  return {
    x: window.innerWidth / 2 - mapWidthPx / 2,
    y: window.innerHeight / 4 - mapHeightPx / 4
  };
};

// Get initial view offset from localStorage or calculate default
const getInitialViewOffset = () => {
  const savedState = localStorage.getItem(VIEW_STATE_KEY);
  if (savedState) {
    try {
      const parsed = JSON.parse(savedState);
      // Validate the saved state
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse saved view state:', e);
    }
  }
  // Calculate initial center position
  return calculateInitialCenter();
};

// Final display dimensions
const TILE_WIDTH = BASE_TILE_WIDTH * DISPLAY_SCALE;   // Scaled width
const TILE_HEIGHT = BASE_TILE_HEIGHT * DISPLAY_SCALE;  // Scaled height

const MAP_WIDTH = 50;   // Maintaining 50x50 grid
const MAP_HEIGHT = 50;  // Maintaining 50x50 grid

// Available tile types with their sprites/colors and fallbacks
const TILE_TYPES = {
  GRASS: { 
    id: 'GRASS', 
    image: '/tiles/grass.png', 
    fallbackColor: '#4CAF50',
    name: 'Grass',
    heightMultiplier: 2, // 48px tall
    size: { width: 1, height: 1 } // Standard 1x1 tile
  },
  WATER: { 
    id: 'WATER', 
    image: '/tiles/water.png', 
    fallbackColor: '#2196F3',
    name: 'Water',
    heightMultiplier: 2, // 48px tall
    size: { width: 1, height: 1 }
  },
  SAND: { 
    id: 'SAND', 
    image: '/tiles/sand.png', 
    fallbackColor: '#FDD835',
    name: 'Sand',
    heightMultiplier: 2, // 48px tall
    size: { width: 1, height: 1 }
  },
  ROCK: { 
    id: 'ROCK', 
    image: '/tiles/rock.png', 
    fallbackColor: '#757575',
    name: 'Rock',
    heightMultiplier: 4, // 96px tall
    size: { width: 1, height: 1 }
  },
  ALIEN: {
    id: 'ALIEN',
    image: '/tiles/alien.png',
    fallbackColor: '#9C27B0',
    name: 'Alien',
    heightMultiplier: 5, // 80px tall (5 * 16px)
    size: { width: 1, height: 1 }
  }
};

// Image cache for preloading
const imageCache = {};

// Create an offscreen canvas for pixel detection
const offscreenCanvas = document.createElement('canvas');
const offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

// Helper function to check if a pixel is transparent
const isPixelTransparent = (imageData, x, y, width) => {
  if (x < 0 || y < 0 || x >= width || y >= imageData.height) return true;
  const index = (y * width + x) * 4 + 3; // Alpha channel
  return imageData.data[index] < 128; // Consider pixels with alpha < 128 as transparent
};

// Simple pan sensitivity
const PAN_SENSITIVITY = 1.0;

const IsometricTilemap = () => {
  const canvasRef = useRef(null);
  const initializedRef = useRef(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTileType, setSelectedTileType] = useState(TILE_TYPES.GRASS);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [lastViewOffset, setLastViewOffset] = useState({ x: 0, y: 0 });
  const [viewOffset, setViewOffset] = useState(calculateInitialCenter());
  const animationFrameRef = useRef(null);
  const [hoverTile, setHoverTile] = useState(null);
  const [mousePos, setMousePos] = useState(null);

  // Initialize view position after everything is loaded
  useEffect(() => {
    if (!imagesLoaded || !canvasRef.current || initializedRef.current) return;

    // Mark as initialized to prevent multiple runs
    initializedRef.current = true;

    // Get saved position or calculate initial center
    const savedState = localStorage.getItem(VIEW_STATE_KEY);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          setViewOffset(parsed);
          return;
        }
      } catch (e) {
        console.warn('Failed to parse saved view state:', e);
      }
    }

    // If no valid saved state, calculate initial center
    setViewOffset(calculateInitialCenter());
  }, [imagesLoaded]);

  // Save view state whenever it changes
  useEffect(() => {
    if (viewOffset) {
      localStorage.setItem(VIEW_STATE_KEY, JSON.stringify(viewOffset));
    }
  }, [viewOffset]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas || !initializedRef.current) return;

      // Update canvas size
      const container = canvas.parentElement;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;

      // Only recalculate center if no view offset exists
      if (!viewOffset) {
        setViewOffset(calculateInitialCenter());
      }

      // Redraw
      drawTilemap();
    };

    // Initial setup
    handleResize();

    // Add resize listener
    const debouncedResize = debounce(handleResize, 250);
    window.addEventListener('resize', debouncedResize);

    return () => {
      window.removeEventListener('resize', debouncedResize);
    };
  }, [viewOffset]);

  // Debounce helper function
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  const [tileMap, setTileMap] = useState(() => {
    return Array(MAP_HEIGHT).fill(null).map(() => 
      Array(MAP_WIDTH).fill(null).map(() => ({...TILE_TYPES.GRASS}))
    );
  });

  // Preload images with better error handling
  useEffect(() => {
    let mounted = true;
    let loadedImages = 0;
    let errorCount = 0;
    const totalImages = Object.keys(TILE_TYPES).length;

    const preloadImage = (tileType) => {
      return new Promise((resolve) => {
        const img = new Image();
        
        img.onload = () => {
          if (!mounted) return;
          imageCache[tileType.image] = img;
          loadedImages++;
          if (loadedImages + errorCount === totalImages) {
            setImagesLoaded(true);
            drawTilemap(); // Force redraw when images are loaded
          }
          resolve();
        };

        img.onerror = () => {
          if (!mounted) return;
          console.warn(`Failed to load image: ${tileType.image}`);
          errorCount++;
          if (loadedImages + errorCount === totalImages) {
            setImagesLoaded(true);
            if (errorCount === totalImages) {
              setLoadingError(true);
            }
            drawTilemap(); // Force redraw even with fallbacks
          }
          resolve();
        };

        img.src = tileType.image;
      });
    };

    // Load all images
    Promise.all(
      Object.values(TILE_TYPES).map(type => preloadImage(type))
    ).catch(error => {
      if (mounted) {
        console.error('Error loading images:', error);
        setLoadingError(true);
        setImagesLoaded(true); // Allow fallback rendering
      }
    });

    return () => {
      mounted = false;
      // Cleanup image cache
      Object.keys(imageCache).forEach(key => {
        delete imageCache[key];
      });
    };
  }, []);

  // Draw debug visualization
  const drawDebug = (ctx) => {
    if (!mousePos || !isEditing) return;

    ctx.save();
    
    // Apply view offset for debug visualization
    ctx.translate(viewOffset.x, viewOffset.y);

    // Draw cursor position
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(mousePos.x, mousePos.y, 2, 0, Math.PI * 2);
    ctx.fill();

    // Draw crosshair
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mousePos.x - 10, mousePos.y);
    ctx.lineTo(mousePos.x + 10, mousePos.y);
    ctx.moveTo(mousePos.x, mousePos.y - 10);
    ctx.lineTo(mousePos.x, mousePos.y + 10);
    ctx.stroke();

    // If we have a hovered tile, draw its image with highlight
    if (hoverTile) {
      const tileType = tileMap[hoverTile.y][hoverTile.x];
      const image = imageCache[tileType.image];
      if (image) {
        // Draw a semi-transparent highlight over the image
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = 'yellow';
        
        // Position highlight at exact tile position using stored screen coordinates
        ctx.translate(
          hoverTile.screenX,
          hoverTile.screenY - hoverTile.imageHeight + BASE_TILE_HEIGHT / 2
        );
        
        // Draw the highlight in the shape of the image
        ctx.drawImage(
          image,
          -BASE_TILE_WIDTH / 2,
          0,
          BASE_TILE_WIDTH,
          hoverTile.imageHeight
        );
        
        ctx.restore();
      }
    }

    ctx.restore();
  };

  // Convert screen coordinates to isometric coordinates with pixel-perfect detection
  const screenToIso = (screenX, screenY) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    // Get the canvas size
    const rect = canvas.getBoundingClientRect();

    // Adjust coordinates relative to the view offset and scale
    const adjustedX = (screenX - viewOffset.x) / DISPLAY_SCALE;
    const adjustedY = (screenY - viewOffset.y) / DISPLAY_SCALE;

    // Store scaled mouse position for debug rendering
    setMousePos({ 
      x: adjustedX * DISPLAY_SCALE, 
      y: adjustedY * DISPLAY_SCALE 
    });

    // Calculate center points with scale adjustment
    const centerX = (rect.width / 2) / DISPLAY_SCALE;
    const centerY = (rect.height / 4) / DISPLAY_SCALE;
    
    // Check tiles in reverse order (front to back) for proper overlap
    for (let y = MAP_HEIGHT - 1; y >= 0; y--) {
      for (let x = MAP_WIDTH - 1; x >= 0; x--) {
        const tileType = tileMap[y][x];
        const image = imageCache[tileType.image];
        if (!image) continue;

        // Get tile position in screen space (pre-scaled)
        const { screenX: tileScreenX, screenY: tileScreenY } = isoToScreen(x, y);
        const tileCenterX = centerX + tileScreenX / DISPLAY_SCALE;
        const tileCenterY = centerY + tileScreenY / DISPLAY_SCALE;

        // Calculate image dimensions in original scale
        const imageHeight = BASE_TILE_HEIGHT * (tileType.heightMultiplier || 2);

        // Convert cursor position to local tile space
        const localX = adjustedX - tileCenterX;
        const localY = adjustedY - (tileCenterY - imageHeight + BASE_TILE_HEIGHT / 2);
    
        // Check vertical bounds first (optimization)
        if (localY >= 0 && localY < imageHeight) {
          // Calculate diamond-shaped bounds with height-based adjustment
          const heightRatio = localY / imageHeight;
          const widthAtHeight = BASE_TILE_WIDTH * (1 - Math.abs(heightRatio - 0.5) * 0.8); // Adjusted diamond shape
          
          // Enhanced isometric perspective adjustment
          const isoAdjustX = (heightRatio - 0.5) * (BASE_TILE_WIDTH / 3);
          const adjustedLocalX = localX - isoAdjustX;

          // Check horizontal bounds with improved precision
          if (Math.abs(adjustedLocalX) <= widthAtHeight / 2) {
            // Set up offscreen canvas for pixel detection
            offscreenCanvas.width = image.width;
            offscreenCanvas.height = image.height;
            offscreenCtx.clearRect(0, 0, image.width, image.height);
            offscreenCtx.drawImage(image, 0, 0);

            try {
              // Convert to image coordinates with enhanced precision
              const scaleX = image.width / BASE_TILE_WIDTH;
              const scaleY = image.height / imageHeight;
              
              const imageX = Math.floor((adjustedLocalX + BASE_TILE_WIDTH / 2) * scaleX);
              const imageY = Math.floor(localY * scaleY);

              // Add small tolerance for edge detection
              const tolerance = 1;
              for (let dx = -tolerance; dx <= tolerance; dx++) {
                for (let dy = -tolerance; dy <= tolerance; dy++) {
                  const checkX = imageX + dx;
                  const checkY = imageY + dy;
                  
                  if (checkX >= 0 && checkX < image.width && checkY >= 0 && checkY < image.height) {
                    const pixel = offscreenCtx.getImageData(checkX, checkY, 1, 1).data;
                    if (pixel[3] > 25) { // Reduced alpha threshold for better edge detection
                      return {
                        x,
                        y,
                        localX: adjustedLocalX * DISPLAY_SCALE,
                        localY: localY * DISPLAY_SCALE,
                        imageHeight: imageHeight * DISPLAY_SCALE,
                        screenX: tileCenterX * DISPLAY_SCALE,
                        screenY: tileCenterY * DISPLAY_SCALE
                      };
                    }
                  }
                }
              }
            } catch (error) {
              console.error('Error in pixel detection:', error);
            }
          }
        }
      }
    }
    
    return null;
  };

  // Convert isometric coordinates to screen coordinates with pixel perfection
  const isoToScreen = (x, y) => {
    return {
      screenX: snapToPixel((x - y) * TILE_WIDTH / 2),
      screenY: snapToPixel((x + y) * TILE_HEIGHT / 2)
    };
  };

  // Handle mouse down for panning
  const handleMouseDown = (event) => {
    if (!isEditing) {
      setIsPanning(true);
      setPanStart({
        x: event.clientX,
        y: event.clientY
      });
      setLastViewOffset({
        x: viewOffset.x,
        y: viewOffset.y
      });
    }
  };

  // Handle mouse move for panning or hover
  const handleMouseMove = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    if (!isEditing && isPanning) {
      // Simple direct panning
      const deltaX = (event.clientX - panStart.x) * PAN_SENSITIVITY;
      const deltaY = (event.clientY - panStart.y) * PAN_SENSITIVITY;

      setViewOffset({
        x: lastViewOffset.x + deltaX,
        y: lastViewOffset.y + deltaY
      });
    } else if (isEditing) {
      // Handle tile hover in edit mode
    const isoCoords = screenToIso(x, y);
      setHoverTile(isoCoords);
    }
  };

  // Handle mouse up to end panning
  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Handle mouse leave
  const handleMouseLeave = () => {
    setIsPanning(false);
    setHoverTile(null);
  };

  // Draw a single isometric tile
  const drawTile = (ctx, x, y, tileType, isHovered = false) => {
    const { screenX, screenY } = isoToScreen(x, y);
    
    // Adjust for canvas center with pixel snapping
    const centerX = snapToPixel(ctx.canvas.width / 2);
    const centerY = snapToPixel(ctx.canvas.height / 4);

    ctx.save();
    
    // Ensure pixel-perfect translation
    ctx.translate(
      snapToPixel(centerX + screenX),
      snapToPixel(centerY + screenY)
    );

    // Get the cached image
    const image = imageCache[tileType.image];
    
    if (image) {
      // Calculate scaled dimensions while maintaining aspect ratio
      const imageWidth = image.naturalWidth;
      const imageHeight = image.naturalHeight;
      
      // Center horizontally on the tile and position at bottom
      const offsetX = snapToPixel(-imageWidth * DISPLAY_SCALE / 2);
      const offsetY = snapToPixel(-imageHeight * DISPLAY_SCALE);

      // Draw the image at the correct scale without stretching
      ctx.drawImage(
        image,
        offsetX,
        offsetY,
        imageWidth * DISPLAY_SCALE,
        imageHeight * DISPLAY_SCALE
      );

      if (isHovered && isEditing) {
        // Draw tile bounds
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1;
        
        // Draw the full image bounds
        ctx.strokeRect(
          offsetX,
          offsetY,
          imageWidth * DISPLAY_SCALE,
          imageHeight * DISPLAY_SCALE
        );

        // Draw the base tile area
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
        ctx.strokeRect(
          -BASE_TILE_WIDTH * DISPLAY_SCALE / 2,
          -BASE_TILE_HEIGHT * DISPLAY_SCALE,
          BASE_TILE_WIDTH * DISPLAY_SCALE,
          BASE_TILE_HEIGHT * DISPLAY_SCALE
        );
      }
    } else {
      // Fallback: draw colored rectangle in base tile dimensions
      ctx.fillStyle = tileType.fallbackColor;
      ctx.fillRect(
        -BASE_TILE_WIDTH * DISPLAY_SCALE / 2,
        -BASE_TILE_HEIGHT * DISPLAY_SCALE,
        BASE_TILE_WIDTH * DISPLAY_SCALE,
        BASE_TILE_HEIGHT * DISPLAY_SCALE
      );
    }

    ctx.restore();
  };

  // Draw the tilemap with safety checks
  const drawTilemap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || viewOffset === null) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear the entire canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Disable image smoothing
    ctx.imageSmoothingEnabled = false;
    
    // Save the context state
    ctx.save();
    
    // Apply view offset
    ctx.translate(viewOffset.x, viewOffset.y);

    // Draw tiles in isometric order (back to front)
    for (let sum = 0; sum <= (MAP_WIDTH + MAP_HEIGHT - 2); sum++) {
      for (let x = 0; x <= sum; x++) {
        const y = sum - x;
        if (x < MAP_WIDTH && y < MAP_HEIGHT) {
          const tileType = tileMap[y][x];
          if (tileType) {
            const isHovered = hoverTile && hoverTile.x === x && hoverTile.y === y;
            drawTile(ctx, x, y, tileType, isHovered);
      }
    }
      }
    }

    // Draw debug visualization if needed
    drawDebug(ctx);

    // Restore the context state
    ctx.restore();
  }, [tileMap, hoverTile, viewOffset, imagesLoaded]);

  // Update drawTilemap when dependencies change
  useEffect(() => {
    if (canvasRef.current && viewOffset !== null) {
      drawTilemap();
    }
  }, [drawTilemap, viewOffset]);

  // Handle canvas click for tile editing
  const handleClick = (event) => {
    if (!isEditing) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const isoCoords = screenToIso(x, y);
    if (!isoCoords) return;

    // Handle single-tile placement
    const newTileMap = [...tileMap];
    newTileMap[isoCoords.y][isoCoords.x] = selectedTileType;
    setTileMap(newTileMap);
    };

  if (!imagesLoaded) {
    return (
      <div className="loading-overlay">
        {loadingError ? 
          "Error loading tiles. Using fallback colors..." : 
          "Loading tiles..."}
      </div>
    );
  }

  return (
    <>
      <div className="isometric-tilemap-container">
      <div className="isometric-tilemap">
        <canvas 
          ref={canvasRef}
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            style={{ cursor: isEditing ? 'pointer' : 'grab' }}
          />
        </div>
        <div className="vintage-border" />
      </div>
      
      {/* Edit controls rendered outside the tilemap container */}
      <button 
        className={`edit-button ${isEditing ? 'active' : ''}`}
        onClick={() => setIsEditing(!isEditing)}
      >
        <span className="edit-icon">✏️</span>
      </button>

      {/* Tile selector panel */}
      {isEditing && (
        <div className="tile-selector">
          {Object.values(TILE_TYPES).map((tileType) => (
            <button
              key={tileType.id}
              className={`tile-option ${selectedTileType.id === tileType.id ? 'selected' : ''}`}
              style={{ 
                backgroundColor: tileType.fallbackColor,
                backgroundImage: imageCache[tileType.image] ? `url(${tileType.image})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
              onClick={() => setSelectedTileType(tileType)}
            >
              <span className="tile-name">{tileType.name}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
};

export default IsometricTilemap; 