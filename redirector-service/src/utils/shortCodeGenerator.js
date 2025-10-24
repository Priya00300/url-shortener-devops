// src/utils/shortCodeGenerator.js - Generate unique short codes
const Url = require('../models/Url');

/**
 * Character set for short codes
 * Excludes confusing characters: 0 (zero), O (capital o), l (lowercase L), I (capital i)
 */
const CHARSET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ123456789';
const DEFAULT_LENGTH = 6;
const MAX_RETRIES = 10;

/**
 * Generate a random string of specified length
 * @param {number} length - Length of the string to generate
 * @returns {string} Random string
 */
function generateRandomString(length = DEFAULT_LENGTH) {
  let result = '';
  const charsetLength = CHARSET.length;
  
  for (let i = 0; i < length; i++) {
    result += CHARSET.charAt(Math.floor(Math.random() * charsetLength));
  }
  
  return result;
}

/**
 * Check if a short code already exists in the database
 * @param {string} shortCode - The short code to check
 * @returns {Promise<boolean>} True if exists, false otherwise
 */
async function shortCodeExists(shortCode) {
  try {
    const existingUrl = await Url.findOne({ 
      $or: [
        { shortCode },
        { customAlias: shortCode }
      ]
    });
    return !!existingUrl;
  } catch (error) {
    console.error('Error checking short code existence:', error);
    throw new Error('Database error while checking short code');
  }
}

/**
 * Generate a unique short code
 * @param {number} length - Length of the short code (default: 6)
 * @param {number} maxRetries - Maximum number of retries (default: 10)
 * @returns {Promise<string>} Unique short code
 */
async function generateUniqueShortCode(length = DEFAULT_LENGTH, maxRetries = MAX_RETRIES) {
  let attempts = 0;
  
  while (attempts < maxRetries) {
    const shortCode = generateRandomString(length);
    
    try {
      const exists = await shortCodeExists(shortCode);
      
      if (!exists) {
        return shortCode;
      }
      
      attempts++;
      console.log(`Short code collision detected (attempt ${attempts}): ${shortCode}`);
      
    } catch (error) {
      console.error('Error generating short code:', error);
      throw error;
    }
  }
  
  // If we've exhausted retries with the current length, try with longer length
  if (length < 8) {
    console.log(`Max retries exceeded for length ${length}, trying length ${length + 1}`);
    return generateUniqueShortCode(length + 1, maxRetries);
  }
  
  throw new Error('Unable to generate unique short code after maximum retries');
}

/**
 * Validate a custom short code/alias
 * @param {string} customCode - The custom code to validate
 * @returns {Object} Validation result with isValid and message
 */
function validateCustomCode(customCode) {
  if (!customCode) {
    return { isValid: false, message: 'Custom code is required' };
  }
  
  if (customCode.length < 3 || customCode.length > 20) {
    return { isValid: false, message: 'Custom code must be 3-20 characters long' };
  }
  
  if (!/^[a-zA-Z0-9-]+$/.test(customCode)) {
    return { isValid: false, message: 'Custom code can only contain letters, numbers, and hyphens' };
  }
  
  // Check for reserved words/patterns
  const reservedWords = ['api', 'admin', 'www', 'app', 'short', 'url', 'link', 'health'];
  if (reservedWords.includes(customCode.toLowerCase())) {
    return { isValid: false, message: 'This custom code is reserved' };
  }
  
  return { isValid: true, message: 'Valid custom code' };
}

/**
 * Generate short code with custom alias support
 * @param {string} customAlias - Optional custom alias
 * @returns {Promise<Object>} Object with shortCode and type
 */
async function generateShortCode(customAlias = null) {
  try {
    if (customAlias) {
      // Validate custom alias
      const validation = validateCustomCode(customAlias);
      if (!validation.isValid) {
        throw new Error(validation.message);
      }
      
      // Check if custom alias is available
      const exists = await shortCodeExists(customAlias);
      if (exists) {
        throw new Error('Custom alias is already taken');
      }
      
      return {
        shortCode: customAlias.toLowerCase(),
        type: 'custom',
        isCustom: true
      };
    }
    
    // Generate random short code
    const shortCode = await generateUniqueShortCode();
    return {
      shortCode,
      type: 'generated',
      isCustom: false
    };
    
  } catch (error) {
    console.error('Error in generateShortCode:', error);
    throw error;
  }
}

/**
 * Get statistics about short codes
 * @returns {Promise<Object>} Statistics object
 */
async function getShortCodeStats() {
  try {
    const totalUrls = await Url.countDocuments();
    const activeUrls = await Url.countDocuments({ isActive: true });
    const customAliases = await Url.countDocuments({ customAlias: { $ne: null } });
    const expiredUrls = await Url.countDocuments({ 
      expiresAt: { $lt: new Date() },
      isActive: true 
    });
    
    // Calculate collision probability for current URL count
    const charsetSize = CHARSET.length;
    const possibleCombinations = Math.pow(charsetSize, DEFAULT_LENGTH);
    const collisionProbability = totalUrls / possibleCombinations;
    
    return {
      totalUrls,
      activeUrls,
      customAliases,
      expiredUrls,
      charsetSize,
      possibleCombinations,
      collisionProbability: Math.round(collisionProbability * 10000) / 100 // Percentage with 2 decimals
    };
  } catch (error) {
    console.error('Error getting short code stats:', error);
    throw error;
  }
}

module.exports = {
  generateUniqueShortCode,
  generateShortCode,
  validateCustomCode,
  shortCodeExists,
  getShortCodeStats,
  generateRandomString,
  CHARSET,
  DEFAULT_LENGTH
};