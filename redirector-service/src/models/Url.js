// src/models/Url.js - MongoDB schema for URL storage
const mongoose = require('mongoose');

// URL validation regex
const urlRegex = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

const urlSchema = new mongoose.Schema({
  originalUrl: {
    type: String,
    required: [true, 'Original URL is required'],
    trim: true,
    validate: {
      validator: function(url) {
        return urlRegex.test(url);
      },
      message: 'Please provide a valid URL (must include http:// or https://)'
    }
  },
  
  shortCode: {
    type: String,
    required: [true, 'Short code is required'],
    unique: true,
    trim: true,
    minlength: [6, 'Short code must be at least 6 characters'],
    maxlength: [8, 'Short code must not exceed 8 characters'],
    match: [/^[a-zA-Z0-9]+$/, 'Short code can only contain alphanumeric characters']
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  expiresAt: {
    type: Date,
    default: null // null means never expires
  },

  isActive: {
    type: Boolean,
    default: true
  },

  // Optional: Track basic stats (could be moved to analytics service)
  clickCount: {
    type: Number,
    default: 0
  },

  // User identification (for future features)
  createdBy: {
    type: String,
    default: 'anonymous'
  },

  // Custom alias (optional feature)
  customAlias: {
    type: String,
    default: null,
    unique: true,
    sparse: true // Allows multiple null values
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
  toJSON: { 
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for better performance
urlSchema.index({ shortCode: 1 }); // Primary lookup index
urlSchema.index({ createdAt: -1 }); // For recent URLs
urlSchema.index({ expiresAt: 1 }); // For cleanup operations
urlSchema.index({ customAlias: 1 }, { sparse: true }); // For custom aliases

// Virtual for checking if URL is expired
urlSchema.virtual('isExpired').get(function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

// Virtual for full short URL
urlSchema.virtual('shortUrl').get(function() {
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
  return `${baseUrl}/api/${this.shortCode}`;
});

// Instance method to check if URL is valid and active
urlSchema.methods.isValidForRedirect = function() {
  return this.isActive && !this.isExpired;
};

// Instance method to increment click count
urlSchema.methods.incrementClick = async function() {
  this.clickCount += 1;
  return this.save();
};

// Static method to find active URL by short code
urlSchema.statics.findActiveByShortCode = function(shortCode) {
  return this.findOne({
    shortCode,
    isActive: true,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  });
};

// Static method to find by short code or custom alias
urlSchema.statics.findByCodeOrAlias = function(code) {
  return this.findOne({
    $or: [
      { shortCode: code },
      { customAlias: code }
    ],
    isActive: true,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  });
};

// Static method to cleanup expired URLs
urlSchema.statics.cleanupExpired = function() {
  return this.updateMany(
    {
      expiresAt: { $lt: new Date() },
      isActive: true
    },
    { isActive: false }
  );
};

// Pre-save middleware to ensure URL format
urlSchema.pre('save', function(next) {
  // Ensure originalUrl has protocol
  if (this.originalUrl && !this.originalUrl.match(/^https?:\/\//)) {
    this.originalUrl = 'https://' + this.originalUrl;
  }
  
  next();
});

// Pre-save middleware for custom alias validation
urlSchema.pre('save', function(next) {
  if (this.customAlias) {
    // Convert to lowercase and validate format
    this.customAlias = this.customAlias.toLowerCase();
    
    if (!/^[a-z0-9-]{3,20}$/.test(this.customAlias)) {
      next(new Error('Custom alias must be 3-20 characters, lowercase alphanumeric and hyphens only'));
      return;
    }
  }
  
  next();
});

// Error handling for unique constraint violations
urlSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    if (error.keyValue.shortCode) {
      next(new Error('Short code already exists'));
    } else if (error.keyValue.customAlias) {
      next(new Error('Custom alias already exists'));
    } else {
      next(new Error('Duplicate value error'));
    }
  } else {
    next(error);
  }
});

const Url = mongoose.model('Url', urlSchema);

module.exports = Url;