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

// NEW ENDPOINT: Get dashboard emissions data
app.get('/api/dashboard/emissions', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      // Query to get emissions by category with calculated risk levels
      const [results] = await connection.execute(`
        SELECT 
          c.Category_Name as category,
          i.Emissions as emissions,
          CASE 
            WHEN i.Emissions >= 500 THEN 'high'
            WHEN i.Emissions >= 300 THEN 'medium'
            WHEN i.Emissions IS NOT NULL THEN 'low'
            ELSE 'unknown'
          END as riskLevel
        FROM 
          Category c
        JOIN 
          Industries i ON c.NAICS_Code = i.NAICS_Code
        WHERE
          i.Emissions IS NOT NULL
        ORDER BY 
          i.Emissions DESC
        LIMIT 10
      `);
      
      res.json(results);
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error retrieving dashboard emissions:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// NEW ENDPOINT: Get user by ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [users] = await connection.execute(
        'SELECT * FROM Users WHERE User_ID = ?',
        [req.params.id]
      );
      
      if (users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const user = users[0];
      res.json({
        User_ID: user.User_ID,
        Username: user.Username,
        Email: user.Email
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error retrieving user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// NEW ENDPOINT: Get user transactions
app.get('/api/users/:id/transactions', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      // Join with Categories to get category names and Industries to get emission data
      const [transactions] = await connection.execute(`
        SELECT 
          o.Order_ID as id,
          c.Category_Name as category,
          o.Total as amount,
          o.Order_Date as date,
          (o.Total * i.Emissions / 100) as emissions
        FROM 
          Orders o
        JOIN 
          Category c ON o.Category_ID = c.Category_ID
        JOIN 
          Industries i ON c.NAICS_Code = i.NAICS_Code
        WHERE 
          o.Customer_ID = ?
        ORDER BY 
          o.Order_Date DESC
      `, [req.params.id]);
      
      res.json(transactions);
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error retrieving user transactions:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// NEW ENDPOINT: Add a new transaction
app.post('/api/users/:id/transactions', express.json(), async (req, res) => {
  try {
    const { category_id, amount, date } = req.body;
    
    if (!category_id || !amount) {
      return res.status(400).json({ error: 'Category ID and amount are required' });
    }
    
    const connection = await pool.getConnection();
    try {
      // Get the emission factor for this category
      const [categories] = await connection.execute(`
        SELECT c.Category_Name, i.Emissions 
        FROM Category c
        JOIN Industries i ON c.NAICS_Code = i.NAICS_Code
        WHERE c.Category_ID = ?
      `, [category_id]);
      
      if (categories.length === 0) {
        return res.status(404).json({ error: 'Category not found' });
      }
      
      const category = categories[0];
      const emissions = (amount * category.Emissions / 100);
      
      // Insert the transaction
      const [result] = await connection.execute(`
        INSERT INTO Orders 
        (Customer_ID, Category_ID, Order_Date, Quantity, Total) 
        VALUES (?, ?, ?, ?, ?)
      `, [req.params.id, category_id, date, 1, amount]);
      
      res.status(201).json({
        id: result.insertId,
        category: category.Category_Name,
        amount,
        date,
        emissions
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error adding transaction:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// NEW ENDPOINT: Update a transaction
app.put('/api/users/:userId/transactions/:transactionId', express.json(), async (req, res) => {
  try {
    const { amount, date } = req.body;
    
    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }
    
    const connection = await pool.getConnection();
    try {
      // Verify the transaction belongs to this user
      const [transactions] = await connection.execute(
        'SELECT Order_ID FROM Orders WHERE Order_ID = ? AND Customer_ID = ?',
        [req.params.transactionId, req.params.userId]
      );
      
      if (transactions.length === 0) {
        return res.status(404).json({ error: 'Transaction not found or does not belong to this user' });
      }
      
      // Update the transaction
      await connection.execute(
        'UPDATE Orders SET Total = ?, Order_Date = ? WHERE Order_ID = ?',
        [amount, date, req.params.transactionId]
      );
      
      // Get the updated transaction data
      const [updatedTransaction] = await connection.execute(`
        SELECT 
          o.Order_ID as id,
          c.Category_Name as category,
          o.Total as amount,
          o.Order_Date as date,
          (o.Total * i.Emissions / 100) as emissions
        FROM 
          Orders o
        JOIN 
          Category c ON o.Category_ID = c.Category_ID
        JOIN 
          Industries i ON c.NAICS_Code = i.NAICS_Code
        WHERE 
          o.Order_ID = ?
      `, [req.params.transactionId]);
      
      if (updatedTransaction.length === 0) {
        return res.status(404).json({ error: 'Transaction not found after update' });
      }
      
      res.json(updatedTransaction[0]);
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error updating transaction:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// NEW ENDPOINT: Delete a transaction
app.delete('/api/users/:userId/transactions/:transactionId', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      // Verify the transaction belongs to this user
      const [transactions] = await connection.execute(
        'SELECT Order_ID FROM Orders WHERE Order_ID = ? AND Customer_ID = ?',
        [req.params.transactionId, req.params.userId]
      );
      
      if (transactions.length === 0) {
        return res.status(404).json({ error: 'Transaction not found or does not belong to this user' });
      }
      
      // Delete the transaction
      await connection.execute(
        'DELETE FROM Orders WHERE Order_ID = ?',
        [req.params.transactionId]
      );
      
      res.status(204).send();
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error deleting transaction:', err);
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