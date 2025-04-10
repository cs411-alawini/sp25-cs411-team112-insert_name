const express = require('express');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const cors = require('cors');

const app = express();
const PORT = 3007;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// In-memory cache
const cache = {
  categories: [],
  industries: {},
  naicsCategoryMap: {}
};

// Function to load CSV data with optimizations
const loadCSVData = () => {
  console.log('Loading data...');
  
  // Load categories
  const categoriesPromise = new Promise((resolve) => {
    fs.createReadStream(path.join(__dirname, '../data/category.csv'))
      .pipe(csv())
      .on('data', (data) => {
        cache.categories.push(data);
        
        // Create a mapping of NAICS codes to category names for faster lookups
        if (!cache.naicsCategoryMap[data.NAICS_Code]) {
          cache.naicsCategoryMap[data.NAICS_Code] = [];
        }
        cache.naicsCategoryMap[data.NAICS_Code].push(data.Category_Name);
      })
      .on('end', resolve);
  });

  // Load industries
  const industriesPromise = new Promise((resolve) => {
    fs.createReadStream(path.join(__dirname, '../data/industries.csv'))
      .pipe(csv())
      .on('data', (data) => {
        // Store industries as an object keyed by NAICS code for O(1) lookup
        cache.industries[data.NAICS_Code] = {
          title: data.Title,
          description: data.Description,
          emissions: parseFloat(data.Emissions)
        };
      })
      .on('end', resolve);
  });

  // Wait for both operations to complete
  Promise.all([categoriesPromise, industriesPromise])
    .then(() => {
      console.log('Data loaded successfully!');
      console.log(`Loaded ${cache.categories.length} categories and ${Object.keys(cache.industries).length} industries`);
    })
    .catch(err => {
      console.error('Error loading data:', err);
    });
};

// Load data when server starts
loadCSVData();

// API root endpoint
app.get('/api/', (req, res) => {
  res.send('API of GreenChain Insights');
});

// Get all categories (paginated)
app.get('/api/categories', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  
  const results = {
    total: cache.categories.length,
    page,
    limit,
    data: cache.categories.slice(startIndex, endIndex)
  };
  
  res.json(results);
});

// Search by category name (optimized)
app.get('/api/search', (req, res) => {
  const { query } = req.query;
  
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  const searchTerm = query.toLowerCase();
  
  // Find matching categories using a more efficient filter
  const matchedCategories = cache.categories.filter(cat => 
    cat.Category_Name.toLowerCase().includes(searchTerm)
  ).slice(0, 10); // Limit to 10 results for performance
  
  if (matchedCategories.length === 0) {
    return res.status(404).json({ error: 'No categories found matching the query' });
  }

  // Create results with pre-computed industry data
  const results = matchedCategories.map(category => {
    const industry = cache.industries[category.NAICS_Code];
    
    if (!industry) {
      return {
        category: category.Category_Name,
        categoryId: category.Category_ID,
        naicsCode: category.NAICS_Code,
        emissionFactor: null,
        unit: 'kg CO₂e per USD',
        notFound: true
      };
    }
    
    return {
      category: category.Category_Name,
      categoryId: category.Category_ID,
      naicsCode: category.NAICS_Code,
      emissionFactor: industry.emissions,
      unit: 'kg CO₂e per USD',
      description: industry.description || industry.title
    };
  });

  res.json(results);
});

// Get category by ID (optimized)
app.get('/api/categories/:id', (req, res) => {
  const category = cache.categories.find(c => c.Category_ID === req.params.id);
  
  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }
  
  res.json(category);
});

// Get industry by NAICS code (optimized)
app.get('/api/industries/:naicsCode', (req, res) => {
  const industry = cache.industries[req.params.naicsCode];
  
  if (!industry) {
    return res.status(404).json({ error: 'Industry not found' });
  }
  
  res.json({
    NAICS_Code: req.params.naicsCode,
    Title: industry.title,
    Description: industry.description,
    Emissions: industry.emissions
  });
});

// Get top-level categories (for suggestions)
app.get('/api/suggestions', (req, res) => {
  // Get the most common categories for suggestions
  const suggestions = Array.from(new Set(
    cache.categories
      .map(c => c.Category_Name)
      .filter(name => name.length > 3)
  )).slice(0, 10);
  
  res.json(suggestions);
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});