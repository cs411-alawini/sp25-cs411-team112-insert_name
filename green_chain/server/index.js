const express = require('express');
const path = require('path');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const csv = require('csv-parser');

const app = express();
const PORT = 3007;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Database connection
let db;

async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const dbDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    // Connect to database
    db = new sqlite3.Database(path.join(__dirname, '../data/greenchain.db'), (err) => {
      if (err) {
        console.error('Could not connect to database', err);
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');
      
      // Create tables
      createTables()
        .then(() => checkAndImportData())
        .then(() => {
          console.log('Database initialized successfully');
          resolve();
        })
        .catch(err => {
          console.error('Database initialization error:', err);
          reject(err);
        });
    });
  });
}


function createTables() {
  return new Promise((resolve, reject) => {
    const createCategoriesTable = `
      CREATE TABLE IF NOT EXISTS categories (
        category_id TEXT PRIMARY KEY,
        category_name TEXT NOT NULL,
        naics_code TEXT NOT NULL
      )
    `;
    
    const createIndustriesTable = `
      CREATE TABLE IF NOT EXISTS industries (
        naics_code TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        emissions REAL NOT NULL
      )
    `;
    
    db.run(createCategoriesTable, (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      db.run(createIndustriesTable, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        console.log('Database tables created or already exist');
        resolve();
      });
    });
  });
}

function checkAndImportData() {
  return new Promise((resolve, reject) => {
    const countCategories = 'SELECT COUNT(*) as count FROM categories';
    const countIndustries = 'SELECT COUNT(*) as count FROM industries';
    
    db.get(countCategories, (err, categoryResult) => {
      if (err) {
        reject(err);
        return;
      }
      
      db.get(countIndustries, (err, industryResult) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (categoryResult.count === 0 || industryResult.count === 0) {
          console.log('Database is empty, importing data from CSV files...');
          importCSVData()
            .then(resolve)
            .catch(reject);
        } else {
          console.log(`Database already contains ${categoryResult.count} categories and ${industryResult.count} industries`);
          resolve();
        }
      });
    });
  });
}

// Import data from CSV files
function importCSVData() {
  return new Promise((resolve, reject) => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Import categories
      const categories = [];
      fs.createReadStream(path.join(__dirname, '../data/category.csv'))
        .pipe(csv())
        .on('data', (data) => {
          categories.push([
            data.Category_ID,
            data.Category_Name,
            data.NAICS_Code
          ]);
        })
        .on('end', () => {
          // Prepare insert statement
          const insertCategory = 'INSERT OR REPLACE INTO categories (category_id, category_name, naics_code) VALUES (?, ?, ?)';
          const stmt = db.prepare(insertCategory);
          
          // Insert all categories
          categories.forEach(category => {
            stmt.run(category, (err) => {
              if (err) console.error('Error inserting category:', err);
            });
          });
          
          stmt.finalize(() => {
            console.log(`Imported ${categories.length} categories`);
            
            // Import industries
            const industries = [];
            fs.createReadStream(path.join(__dirname, '../data/industries.csv'))
              .pipe(csv())
              .on('data', (data) => {
                industries.push([
                  data.NAICS_Code,
                  data.Title,
                  data.Description,
                  parseFloat(data.Emissions)
                ]);
              })
              .on('end', () => {
                // Prepare insert statement
                const insertIndustry = 'INSERT OR REPLACE INTO industries (naics_code, title, description, emissions) VALUES (?, ?, ?, ?)';
                const stmt = db.prepare(insertIndustry);
                
                // Insert all industries
                industries.forEach(industry => {
                  stmt.run(industry, (err) => {
                    if (err) console.error('Error inserting industry:', err);
                  });
                });
                
                stmt.finalize(() => {
                  console.log(`Imported ${industries.length} industries`);
                  
                  // Commit transaction
                  db.run('COMMIT', (err) => {
                    if (err) {
                      db.run('ROLLBACK', () => {
                        console.error('Transaction rolled back due to error');
                        reject(err);
                      });
                      return;
                    }
                    
                    console.log('Data import completed successfully');
                    resolve();
                  });
                });
              })
              .on('error', (err) => {
                db.run('ROLLBACK', () => reject(err));
              });
          });
        })
        .on('error', (err) => {
          db.run('ROLLBACK', () => reject(err));
        });
    });
  });
}

// API root endpoint
app.get('/api/', (req, res) => {
  res.send('API of GreenChain Insights - Using SQLite Database');
});

// Get all categories (paginated) with SQL query
app.get('/api/categories', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  
  // Get total count with SQL
  const countQuery = 'SELECT COUNT(*) as total FROM categories';
  
  db.get(countQuery, (err, result) => {
    if (err) {
      console.error('Error counting categories:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    const total = result.total;
    
    const paginationQuery = `
      SELECT * FROM categories
      ORDER BY category_name
      LIMIT ? OFFSET ?
    `;
    
    db.all(paginationQuery, [limit, offset], (err, categories) => {
      if (err) {
        console.error('Error retrieving categories:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      const results = {
        total,
        page,
        limit,
        data: categories.map(cat => ({
          Category_ID: cat.category_id,
          Category_Name: cat.category_name,
          NAICS_Code: cat.naics_code
        }))
      };
      
      res.json(results);
    });
  });
});

// Search by category name with SQL JOIN
app.get('/api/search', (req, res) => {
  const { query } = req.query;
  
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }
  
  // SQL JOIN query for search
  const searchQuery = `
    SELECT 
      c.category_id, 
      c.category_name, 
      c.naics_code,
      i.title,
      i.description,
      i.emissions
    FROM 
      categories c
    LEFT JOIN 
      industries i ON c.naics_code = i.naics_code
    WHERE 
      c.category_name LIKE ?
    LIMIT 10
  `;
  
  db.all(searchQuery, [`%${query}%`], (err, matchedCategories) => {
    if (err) {
      console.error('Error searching categories:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (matchedCategories.length === 0) {
      return res.status(404).json({ error: 'No categories found matching the query' });
    }
    
    // Map results to expected format
    const results = matchedCategories.map(category => {
      return {
        category: category.category_name,
        categoryId: category.category_id,
        naicsCode: category.naics_code,
        emissionFactor: category.emissions,
        unit: 'kg CO₂e per 100 USD',
        description: category.description || category.title,
        notFound: category.emissions === null
      };
    });
    
    res.json(results);
  });
});

// Get category by ID with SQL query
app.get('/api/categories/:id', (req, res) => {
  const categoryQuery = 'SELECT * FROM categories WHERE category_id = ?';
  
  db.get(categoryQuery, [req.params.id], (err, category) => {
    if (err) {
      console.error('Error retrieving category:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json({
      Category_ID: category.category_id,
      Category_Name: category.category_name,
      NAICS_Code: category.naics_code
    });
  });
});

// Get industry by NAICS code with SQL query
app.get('/api/industries/:naicsCode', (req, res) => {
  const industryQuery = 'SELECT * FROM industries WHERE naics_code = ?';
  
  db.get(industryQuery, [req.params.naicsCode], (err, industry) => {
    if (err) {
      console.error('Error retrieving industry:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    if (!industry) {
      return res.status(404).json({ error: 'Industry not found' });
    }
    
    res.json({
      NAICS_Code: industry.naics_code,
      Title: industry.title,
      Description: industry.description,
      Emissions: industry.emissions
    });
  });
});

app.get('/api/suggestions', (req, res) => {
  const suggestionsQuery = `
    SELECT DISTINCT category_name
    FROM categories
    WHERE LENGTH(category_name) > 3
    ORDER BY category_name
    LIMIT 10
  `;
  
  db.all(suggestionsQuery, (err, suggestions) => {
    if (err) {
      console.error('Error retrieving suggestions:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    res.json(suggestions.map(s => s.category_name));
  });
});
// Initialize database and start server
initializeDatabase()
  .then(() => {
    // Start the server after database initialization
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database, server not started:', err);
    process.exit(1);
  });