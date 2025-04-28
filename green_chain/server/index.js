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
    let sql = 'SELECT * FROM Category ORDER BY Category_Name';
    const rawPage = parseInt(req.query.page, 10);
    const rawLimit = parseInt(req.query.limit, 10);
    const page = Number.isNaN(rawPage) ? 1 : rawPage;
    const limit = Number.isNaN(rawLimit) ? null : rawLimit;

    if (limit) {
      const offset = (page - 1) * limit;
      sql += ` LIMIT ${limit} OFFSET ${offset}`;
    }

    const connection = await pool.getConnection();
    try {
      // Get total count
      const [countResult] = await connection.execute('SELECT COUNT(*) as total FROM Category');
      const total = countResult[0].total;

      // Get (possibly paginated) results
      const [categories] = await connection.query(sql);

      res.json({
        total,
        page: limit ? page : 1,
        limit: limit || total,
        data: categories.map(cat => ({
          Category_ID: cat.Category_ID,
          Category_Name: cat.Category_Name,
          NAICS_Code: cat.NAICS_Code
        })),
      });
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
// Replace the existing GET /api/users/:id/transactions endpoint with this updated version
app.get('/api/users/:id/transactions', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      // First check if the user exists before returning any transactions
      const [users] = await connection.execute(
        'SELECT User_ID FROM Users WHERE User_ID = ?',
        [req.params.id]
      );
      
      // If user doesn't exist, return an empty array
      if (users.length === 0) {
        return res.json([]);
      }
      
      // Check if the user has any orders
      const [orderCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM Orders WHERE Customer_ID = ?',
        [req.params.id]
      );
      
      // If user has no orders, return an empty array
      if (orderCount[0].count === 0) {
        return res.json([]);
      }
      
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
// Replace the existing POST /api/users/:id/transactions endpoint with this updated version
app.post('/api/users/:id/transactions', express.json(), async (req, res) => {
  try {
    const { category_id, amount, date } = req.body;
    const userId = parseInt(req.params.id);
    
    if (!category_id || !amount) {
      return res.status(400).json({ error: 'Category ID and amount are required' });
    }
    
    const connection = await pool.getConnection();
    try {
      // First check if the user exists
      const [users] = await connection.execute(
        'SELECT User_ID FROM Users WHERE User_ID = ?',
        [userId]
      );
      
      if (users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
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
      
      // Find the current max Order_ID
      const [orderRows] = await connection.execute('SELECT MAX(Order_ID) AS maxOrderId FROM Orders');
      const maxOrderId = orderRows[0].maxOrderId || 0;
      const newOrderId = maxOrderId + 1;
      
      // Insert the transaction - IMPORTANT: Use the user's ID as Customer_ID
      const [result] = await connection.execute(`
        INSERT INTO Orders 
        (Order_ID, Customer_ID, Category_ID, Order_Date, Quantity, Total) 
        VALUES (?, ?, ?, ?, ?, ?)
      `, [newOrderId, userId, category_id, date, 1, amount]);
      
      res.status(201).json({
        id: newOrderId,
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

// Update a transaction
// Replace the existing DELETE transaction endpoint
app.delete('/api/users/:userId/transactions/:transactionId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const transactionId = parseInt(req.params.transactionId);
    
    const connection = await pool.getConnection();
    try {
      // Verify the transaction belongs to this user
      const [transactions] = await connection.execute(
        'SELECT Order_ID FROM Orders WHERE Order_ID = ? AND Customer_ID = ?',
        [transactionId, userId]
      );
      
      if (transactions.length === 0) {
        return res.status(404).json({ error: 'Transaction not found or does not belong to this user' });
      }
      
      // Delete the transaction
      await connection.execute(
        'DELETE FROM Orders WHERE Order_ID = ? AND Customer_ID = ?',
        [transactionId, userId]
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

// Replace the existing UPDATE transaction endpoint
app.put('/api/users/:userId/transactions/:transactionId', express.json(), async (req, res) => {
  try {
    const { category_id, amount, date } = req.body;
    const userId = parseInt(req.params.userId);
    const transactionId = parseInt(req.params.transactionId);
    
    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }
    
    const connection = await pool.getConnection();
    try {
      // Verify the transaction belongs to this user
      const [transactions] = await connection.execute(
        'SELECT Order_ID FROM Orders WHERE Order_ID = ? AND Customer_ID = ?',
        [transactionId, userId]
      );
      
      if (transactions.length === 0) {
        return res.status(404).json({ error: 'Transaction not found or does not belong to this user' });
      }
      
      // Update the transaction
      if (category_id) {
        // If category_id is provided, update it along with amount and date
        await connection.execute(
          'UPDATE Orders SET Category_ID = ?, Total = ?, Order_Date = ? WHERE Order_ID = ? AND Customer_ID = ?',
          [category_id, amount, date, transactionId, userId]
        );
      } else {
        // Otherwise just update amount and date
        await connection.execute(
          'UPDATE Orders SET Total = ?, Order_Date = ? WHERE Order_ID = ? AND Customer_ID = ?',
          [amount, date, transactionId, userId]
        );
      }
      
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
          o.Order_ID = ? AND o.Customer_ID = ?
      `, [transactionId, userId]);
      
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


// Update the trigger creation to handle missing fields
async function createTriggers() {
  const connection = await pool.getConnection();
  try {
    // Drop existing triggers if they exist
    await connection.query(`DROP TRIGGER IF EXISTS after_order_insert`);
    await connection.query(`DROP TRIGGER IF EXISTS after_order_update`);
    await connection.query(`DROP TRIGGER IF EXISTS after_order_delete`);
    
    // First, check if the Users table exists
    const [tables] = await connection.query(`
      SHOW TABLES LIKE 'Users'
    `);
    
    // If Users table doesn't exist, create it
    if (tables.length === 0) {
      await connection.query(`
        CREATE TABLE Users (
          User_ID INT PRIMARY KEY,
          Username VARCHAR(50) NOT NULL,
          Email VARCHAR(100) NOT NULL,
          Password VARCHAR(100) NOT NULL,
          Total_Emissions DECIMAL(10,2) DEFAULT 0,
          Monthly_Emissions DECIMAL(10,2) DEFAULT 0
        )
      `);
      console.log('Created Users table');
    } else {
      // Check if the Users table has the necessary columns
      const [userColumns] = await connection.query(`
        SHOW COLUMNS FROM Users
      `);
      
      const hasEmissionsField = userColumns.some(col => col.Field === 'Total_Emissions');
      const hasMonthlyField = userColumns.some(col => col.Field === 'Monthly_Emissions');
      
      // If fields don't exist, add them
      if (!hasEmissionsField) {
        await connection.query(`
          ALTER TABLE Users ADD COLUMN Total_Emissions DECIMAL(10,2) DEFAULT 0
        `);
        console.log('Added Total_Emissions column to Users table');
      }
      
      if (!hasMonthlyField) {
        await connection.query(`
          ALTER TABLE Users ADD COLUMN Monthly_Emissions DECIMAL(10,2) DEFAULT 0
        `);
        console.log('Added Monthly_Emissions column to Users table');
      }
    }
    
    // Create trigger that fires after inserting a new order
    await connection.query(`
      CREATE TRIGGER after_order_insert
      AFTER INSERT ON Orders
      FOR EACH ROW
      BEGIN
        DECLARE emission_factor DECIMAL(10,2);
        DECLARE order_emissions DECIMAL(10,2);
        
        -- Get the emission factor for this category
        SELECT i.Emissions INTO emission_factor
        FROM Category c
        JOIN Industries i ON c.NAICS_Code = i.NAICS_Code
        WHERE c.Category_ID = NEW.Category_ID;
        
        -- Only proceed if we found a valid emission factor
        IF emission_factor IS NOT NULL THEN
          -- Calculate emissions for this order
          SET order_emissions = (NEW.Total * emission_factor / 100);
          
          -- Update user's total emissions
          UPDATE Users
          SET 
            Total_Emissions = IFNULL(Total_Emissions, 0) + order_emissions
          WHERE User_ID = NEW.Customer_ID;
          
          -- Update monthly emissions if the order is from the current month
          IF YEAR(NEW.Order_Date) = YEAR(CURRENT_DATE()) AND MONTH(NEW.Order_Date) = MONTH(CURRENT_DATE()) THEN
            UPDATE Users
            SET Monthly_Emissions = IFNULL(Monthly_Emissions, 0) + order_emissions
            WHERE User_ID = NEW.Customer_ID;
          END IF;
        END IF;
      END
    `);
    
    // Create trigger that fires after updating an order
    await connection.query(`
      CREATE TRIGGER after_order_update
      AFTER UPDATE ON Orders
      FOR EACH ROW
      BEGIN
        DECLARE old_emission_factor DECIMAL(10,2);
        DECLARE new_emission_factor DECIMAL(10,2);
        DECLARE old_emissions DECIMAL(10,2);
        DECLARE new_emissions DECIMAL(10,2);
        
        -- Get the emission factors
        SELECT i.Emissions INTO old_emission_factor
        FROM Category c
        JOIN Industries i ON c.NAICS_Code = i.NAICS_Code
        WHERE c.Category_ID = OLD.Category_ID;
        
        SELECT i.Emissions INTO new_emission_factor
        FROM Category c
        JOIN Industries i ON c.NAICS_Code = i.NAICS_Code
        WHERE c.Category_ID = NEW.Category_ID;
        
        -- Calculate emissions
        IF old_emission_factor IS NOT NULL THEN
          SET old_emissions = (OLD.Total * old_emission_factor / 100);
        ELSE
          SET old_emissions = 0;
        END IF;
        
        IF new_emission_factor IS NOT NULL THEN
          SET new_emissions = (NEW.Total * new_emission_factor / 100);
        ELSE
          SET new_emissions = 0;
        END IF;
        
        -- Update total emissions
        UPDATE Users
        SET Total_Emissions = GREATEST(0, IFNULL(Total_Emissions, 0) - old_emissions + new_emissions)
        WHERE User_ID = NEW.Customer_ID;
        
        -- Update monthly emissions if needed
        IF YEAR(OLD.Order_Date) = YEAR(CURRENT_DATE()) AND MONTH(OLD.Order_Date) = MONTH(CURRENT_DATE()) THEN
          UPDATE Users
          SET Monthly_Emissions = GREATEST(0, IFNULL(Monthly_Emissions, 0) - old_emissions)
          WHERE User_ID = NEW.Customer_ID;
        END IF;
        
        IF YEAR(NEW.Order_Date) = YEAR(CURRENT_DATE()) AND MONTH(NEW.Order_Date) = MONTH(CURRENT_DATE()) THEN
          UPDATE Users
          SET Monthly_Emissions = IFNULL(Monthly_Emissions, 0) + new_emissions
          WHERE User_ID = NEW.Customer_ID;
        END IF;
      END
    `);
    
    // Create trigger that fires after deleting an order
    await connection.query(`
      CREATE TRIGGER after_order_delete
      AFTER DELETE ON Orders
      FOR EACH ROW
      BEGIN
        DECLARE emission_factor DECIMAL(10,2);
        DECLARE order_emissions DECIMAL(10,2);
        
        -- Get the emission factor for this category
        SELECT i.Emissions INTO emission_factor
        FROM Category c
        JOIN Industries i ON c.NAICS_Code = i.NAICS_Code
        WHERE c.Category_ID = OLD.Category_ID;
        
        -- Only proceed if we found a valid emission factor
        IF emission_factor IS NOT NULL THEN
          -- Calculate emissions for this order
          SET order_emissions = (OLD.Total * emission_factor / 100);
          
          -- Update user's total emissions
          UPDATE Users
          SET 
            Total_Emissions = GREATEST(0, IFNULL(Total_Emissions, 0) - order_emissions)
          WHERE User_ID = OLD.Customer_ID;
          
          -- Update monthly emissions if the order was from the current month
          IF YEAR(OLD.Order_Date) = YEAR(CURRENT_DATE()) AND MONTH(OLD.Order_Date) = MONTH(CURRENT_DATE()) THEN
            UPDATE Users
            SET Monthly_Emissions = GREATEST(0, IFNULL(Monthly_Emissions, 0) - order_emissions)
            WHERE User_ID = OLD.Customer_ID;
          END IF;
        END IF;
      END
    `);
    
    console.log('Database triggers created successfully');
  } catch (err) {
    console.error('Error creating database triggers:', err);
  } finally {
    connection.release();
  }
}

// 3. Create stored procedures
async function createStoredProcedures() {
  const connection = await pool.getConnection();
  try {
    // Create stored procedure for carbon insights
    await connection.query(`
      DROP PROCEDURE IF EXISTS GetUserCarbonInsights;
    `);
    
    await connection.query(`
      CREATE PROCEDURE GetUserCarbonInsights(IN userId INT)
      BEGIN
        -- Declare variables
        DECLARE total_emissions DECIMAL(10,2);
        
        -- Calculate total emissions for user (control structure)
        SELECT SUM(o.Total * i.Emissions / 100) INTO total_emissions
        FROM Orders o
        JOIN Category c ON o.Category_ID = c.Category_ID
        JOIN Industries i ON c.NAICS_Code = i.NAICS_Code
        WHERE o.Customer_ID = userId;
        
        -- ADVANCED QUERY 1: Multiple joins with GROUP BY aggregation
        SELECT 
          c.Category_Name AS category,
          SUM(o.Total) AS total_spent,
          SUM(o.Total * i.Emissions / 100) AS category_emissions,
          COUNT(o.Order_ID) AS order_count,
          -- Control structure with IF condition
          IF(SUM(o.Total * i.Emissions / 100) > 100, 'High', 'Low') AS impact_level
        FROM 
          Orders o
        JOIN 
          Category c ON o.Category_ID = c.Category_ID
        JOIN 
          Industries i ON c.NAICS_Code = i.NAICS_Code
        WHERE 
          o.Customer_ID = userId
        GROUP BY 
          c.Category_Name
        ORDER BY 
          category_emissions DESC;
          
        -- ADVANCED QUERY 2: Temporal grouping with multiple joins
        SELECT 
          DATE_FORMAT(o.Order_Date, '%Y-%m') AS month,
          SUM(o.Total) AS monthly_spent,
          SUM(o.Total * i.Emissions / 100) AS monthly_emissions
        FROM 
          Orders o
        JOIN 
          Category c ON o.Category_ID = c.Category_ID
        JOIN 
          Industries i ON c.NAICS_Code = i.NAICS_Code
        WHERE 
          o.Customer_ID = userId
        GROUP BY 
          DATE_FORMAT(o.Order_Date, '%Y-%m')
        ORDER BY 
          month DESC;
      END
    `);
    
    console.log('Stored procedures created successfully');
  } catch (err) {
    console.error('Error creating stored procedures:', err);
  } finally {
    connection.release();
  }
}

// 4. Transaction endpoint with advanced queries
app.post('/api/users/:id/bulk-transaction', express.json(), async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    // Begin transaction with SERIALIZABLE isolation level
    await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
    await connection.beginTransaction();
    
    const { transactions } = req.body;
    const userId = req.params.id;
    
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Valid transactions array is required' });
    }
    
    const results = [];
    
    // Process each transaction
    for (const tx of transactions) {
      const { category_id, amount, date } = tx;
      
      if (!category_id || !amount) {
        await connection.rollback();
        return res.status(400).json({ error: 'Category ID and amount are required for each transaction' });
      }
      
      // ADVANCED QUERY 1: JOIN multiple relations
      const [categories] = await connection.execute(`
        SELECT c.Category_Name, i.Emissions 
        FROM Category c
        JOIN Industries i ON c.NAICS_Code = i.NAICS_Code
        WHERE c.Category_ID = ?
      `, [category_id]);
      
      if (categories.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: `Category with ID ${category_id} not found` });
      }
      
      const category = categories[0];
      const emissions = (amount * category.Emissions / 100);
      
      // Find the current max Order_ID
      const [orderRows] = await connection.execute('SELECT MAX(Order_ID) AS maxOrderId FROM Orders');
      const maxOrderId = orderRows[0].maxOrderId || 0;
      const newOrderId = maxOrderId + 1;
      
      // Insert the transaction
      const [result] = await connection.execute(`
        INSERT INTO Orders 
        (Order_ID, Customer_ID, Category_ID, Order_Date, Quantity, Total) 
        VALUES (?, ?, ?, ?, ?, ?)
      `, [newOrderId, userId, category_id, date, 1, amount]);
      
      // ADVANCED QUERY 2: Subquery with aggregation
      await connection.execute(`
        UPDATE Users 
        SET Monthly_Emissions = (
          SELECT SUM(o.Total * i.Emissions / 100)
          FROM Orders o
          JOIN Category c ON o.Category_ID = c.Category_ID
          JOIN Industries i ON c.NAICS_Code = i.NAICS_Code
          WHERE o.Customer_ID = ?
            AND YEAR(o.Order_Date) = YEAR(CURRENT_DATE())
            AND MONTH(o.Order_Date) = MONTH(CURRENT_DATE())
          GROUP BY o.Customer_ID
        )
        WHERE User_ID = ?
      `, [userId, userId]);
      
      results.push({
        id: newOrderId,
        category: category.Category_Name,
        amount,
        date,
        emissions
      });
    }
    
    // Commit the transaction
    await connection.commit();
    
    res.status(201).json({
      userId,
      transactions: results
    });
    
  } catch (err) {
    await connection.rollback();
    console.error('Error in bulk transaction:', err);
    res.status(500).json({ error: 'Internal server error during transaction' });
  } finally {
    connection.release();
  }
});

// 5. API endpoint for stored procedure
app.get('/api/users/:id/carbon-insights', async (req, res) => {
  try {
    const userId = req.params.id;
    console.log('Fetching carbon insights for user:', userId);
    
    const connection = await pool.getConnection();
    try {
      // First check if the user exists
      const [users] = await connection.execute(
        'SELECT User_ID FROM Users WHERE User_ID = ?',
        [userId]
      );
      
      // If the user doesn't exist, return empty data
      if (users.length === 0) {
        console.log('User not found, returning empty insights data');
        return res.json({
          userId,
          categoryInsights: [],
          monthlyInsights: []
        });
      }
      
      // Check if the user has any orders before calling the stored procedure
      const [orderCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM Orders WHERE Customer_ID = ?',
        [userId]
      );
      
      // If the user has no orders, return empty data
      if (orderCount[0].count === 0) {
        console.log('User has no orders, returning empty insights data');
        return res.json({
          userId,
          categoryInsights: [],
          monthlyInsights: []
        });
      }
      
      // User exists and has orders, call the stored procedure
      const [results] = await connection.query('CALL GetUserCarbonInsights(?)', [userId]);
      
      // The procedure returns multiple result sets
      if (results && results.length > 0) {
        res.json({
          userId,
          categoryInsights: results[0] || [],
          monthlyInsights: results[1] || []
        });
      } else {
        // Procedure returned no data
        res.json({
          userId,
          categoryInsights: [],
          monthlyInsights: []
        });
      }
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error retrieving carbon insights:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 6. Update the initialization section
initializeDatabase()
  .then(async () => {
    await createTriggers();
    await createStoredProcedures();
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to connect to database, server not started:', err);
    process.exit(1);
  });

 // Replace the existing login endpoint with this improved version
app.post('/api/auth/login', express.json(), async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    
    const connection = await pool.getConnection();
    try {
      // Check if the user exists
      const [users] = await connection.execute(
        'SELECT * FROM Users WHERE Username = ? OR Email = ?',
        [username, email]
      );
      
      if (users.length > 0) {
        // User exists, check password (simplified for demo purposes)
        const user = users[0];
        
        // In a real app, you would use a secure password comparison 
        // For this simple demo, we'll accept any password
        // const passwordMatches = await bcrypt.compare(password, user.Password_Hash);
        
        // For a simple demo, just accept the login
        const passwordMatches = true;
        
        if (passwordMatches) {
          return res.json({
            id: user.User_ID,
            username: user.Username,
            email: user.Email,
            message: 'Login successful'
          });
        } else {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
      } else {
        // User doesn't exist, create a new account
        
        // Find the current max Customer_ID from Orders table
        const [customerRows] = await connection.execute('SELECT MAX(Customer_ID) AS maxCustomerId FROM Orders');
        const maxCustomerId = customerRows[0].maxCustomerId || 0;
        
        // Find the current max User_ID
        const [userRows] = await connection.execute('SELECT MAX(User_ID) AS maxUserId FROM Users');
        const maxUserId = userRows[0].maxUserId || 0;
        
        // Use the higher of these values + 1 to ensure uniqueness across both tables
        const newId = Math.max(maxCustomerId, maxUserId) + 1;
  
        // Hash the password (simplified)
        // const hashedPassword = await bcrypt.hash(password, 10);
        const hashedPassword = password; // For demo only
  
        // Create the user with the new ID
        const [result] = await connection.execute(
          'INSERT INTO Users (User_ID, Username, Email, Password) VALUES (?, ?, ?, ?)',
          [newId, username, email, hashedPassword]
        );
  
        return res.status(201).json({
          id: newId,
          username,
          email,
          message: 'User created successfully'
        });
      }
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Authentication error:', err);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
});