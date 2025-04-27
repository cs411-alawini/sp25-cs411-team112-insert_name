const express = require('express');
const path = require('path');
const cors = require('cors');
const mysql = require('mysql2/promise');
const fs = require('fs');
const csv = require('csv-parser');
require('dotenv').config(); // Load environment variables

const app = express();
const PORT = 3007;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Database connection
let pool;

async function initializeDatabase() {
  try {
    // Create connection pool using environment variables from .env
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test the connection
    const connection = await pool.getConnection();
    console.log('Connected to MySQL database');
    connection.release();
    
    // Display tables for verification
    const [tables] = await connection.query('SHOW TABLES');
    console.log('Available tables:', tables.map(t => Object.values(t)[0]).join(', '));
    
    console.log('Database initialization complete');
  } catch (err) {
    console.error('Database connection error:', err);
    throw err;
  }
}

// API root endpoint
app.get('/api/', (req, res) => {
  res.send('API of GreenChain Insights - Using MySQL Database');
});

// Get all categories (paginated)
app.get('/api/categories', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    const connection = await pool.getConnection();
    try {
      // Get total count
      const [countResult] = await connection.execute('SELECT COUNT(*) as total FROM Category');
      const total = countResult[0].total;
      
      // Get paginated results
      const [categories] = await connection.execute(
        'SELECT * FROM Category ORDER BY Category_Name LIMIT ? OFFSET ?',
        [limit, offset]
      );
      
      const results = {
        total,
        page,
        limit,
        data: categories.map(cat => ({
          Category_ID: cat.Category_ID,
          Category_Name: cat.Category_Name,
          NAICS_Code: cat.NAICS_Code
        }))
      };
      
      res.json(results);
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error retrieving categories:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search by category name
app.get('/api/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const connection = await pool.getConnection();
    try {
      const [matchedCategories] = await connection.execute(
        `SELECT 
          c.Category_ID, 
          c.Category_Name, 
          c.NAICS_Code,
          i.Title,
          i.Description,
          i.Emissions
        FROM 
          Category c
        LEFT JOIN 
          Industries i ON c.NAICS_Code = i.NAICS_Code
        WHERE 
          c.Category_Name LIKE ?
        LIMIT 10`,
        [`%${query}%`]
      );
      
      if (matchedCategories.length === 0) {
        return res.status(404).json({ error: 'No categories found matching the query' });
      }
      
      const results = matchedCategories.map(category => ({
        category: category.Category_Name,
        categoryId: category.Category_ID,
        naicsCode: category.NAICS_Code,
        emissionFactor: category.Emissions,
        unit: 'kg CO₂e per 100 USD',
        description: category.Description || category.Title,
        notFound: category.Emissions === null
      }));
      
      res.json(results);
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error searching categories:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get category by ID
app.get('/api/categories/:id', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [categories] = await connection.execute(
        'SELECT * FROM Category WHERE Category_ID = ?',
        [req.params.id]
      );
      
      if (categories.length === 0) {
        return res.status(404).json({ error: 'Category not found' });
      }
      
      const category = categories[0];
      res.json({
        Category_ID: category.Category_ID,
        Category_Name: category.Category_Name,
        NAICS_Code: category.NAICS_Code
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error retrieving category:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get industry by NAICS code
app.get('/api/industries/:naicsCode', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [industries] = await connection.execute(
        'SELECT * FROM Industries WHERE NAICS_Code = ?',
        [req.params.naicsCode]
      );
      
      if (industries.length === 0) {
        return res.status(404).json({ error: 'Industry not found' });
      }
      
      const industry = industries[0];
      res.json({
        NAICS_Code: industry.NAICS_Code,
        Title: industry.Title,
        Description: industry.Description,
        Emissions: industry.Emissions
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error retrieving industry:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get suggestions
app.get('/api/suggestions', async (req, res) => {
  try {
    const { query } = req.query;
    const connection = await pool.getConnection();
    try {
      let sql = `SELECT DISTINCT Category_Name
                 FROM Category
                 WHERE LENGTH(Category_Name) > 3`;
      
      const params = [];
      
      if (query) {
        sql += ' AND Category_Name LIKE ?';
        params.push(`%${query}%`);
      }
      
      sql += ' ORDER BY Category_Name LIMIT 10';
      
      const [suggestions] = await connection.execute(sql, params);
      res.json(suggestions.map(s => s.Category_Name));
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error retrieving suggestions:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Initialize database and start server
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to connect to database, server not started:', err);
    process.exit(1);
  });