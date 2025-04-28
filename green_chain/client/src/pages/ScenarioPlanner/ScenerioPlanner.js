import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './ScenarioPlanner.css';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';

const API_BASE_URL = 'http://localhost:3007/api';
const DEFAULT_USER_ID = 1; // Using a default user ID for demonstration

const ScenarioPlanner = ({ onBack }) => {
  const [transactions, setTransactions] = useState([]);
  const [totalEmissions, setTotalEmissions] = useState(0);
  const [categories, setCategories] = useState([]);
  const [newTransaction, setNewTransaction] = useState({
    category: '',
    amount: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [emissionsByPrice, setEmissionsByPrice] = useState([]);
  const [emissionsByCategory, setEmissionsByCategory] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Load initial data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        
        // Get a real user from the database
        const userResponse = await fetch(`${API_BASE_URL}/users/${DEFAULT_USER_ID}`);
        
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setCurrentUser(userData);
          
          // Fetch this user's transactions
          const transactionsResponse = await fetch(`${API_BASE_URL}/users/${DEFAULT_USER_ID}/transactions`);
          
          if (transactionsResponse.ok) {
            const transactionsData = await transactionsResponse.json();
            setTransactions(transactionsData);
            
            // Calculate total emissions from real data
            const total = transactionsData.reduce((sum, transaction) => sum + transaction.emissions, 0);
            setTotalEmissions(total);
            
            // Prepare chart data for Emissions by Price
            // Group transactions by month
            const monthlyData = transactionsData.reduce((acc, transaction) => {
              const date = new Date(transaction.date);
              const month = date.toLocaleString('default', { month: 'short' });
              
              if (!acc[month]) {
                acc[month] = 0;
              }
              acc[month] += transaction.emissions;
              return acc;
            }, {});
            
            // Convert to array for chart
            const priceData = Object.keys(monthlyData).map(month => ({
              name: month,
              value: monthlyData[month]
            }));
            
            setEmissionsByPrice(priceData);
            
            // Prepare chart data for Emissions by Category from real data
            const categoryData = transactionsData.reduce((acc, transaction) => {
              const existingCategory = acc.find(c => c.category === transaction.category);
              if (existingCategory) {
                existingCategory.emissions += transaction.emissions;
              } else {
                acc.push({
                  category: transaction.category,
                  emissions: transaction.emissions
                });
              }
              return acc;
            }, []);
            
            setEmissionsByCategory(categoryData);
          }
        }
        
        // Also fetch available categories
        const categoriesResponse = await fetch(`${API_BASE_URL}/categories?limit=100`);
        
        if (categoriesResponse.ok) {
          const data = await categoriesResponse.json();
          setCategories(data.data);
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setIsLoading(false);
      }
    };
    
    fetchUserData();
  }, []);
  
  // Add a new transaction
  const handleAddTransaction = async () => {
    if (!newTransaction.category || !newTransaction.amount || !currentUser) {
      alert('Please select a category and enter an amount');
      return;
    }
    
    const categoryObj = categories.find(c => c.Category_Name === newTransaction.category);
    if (!categoryObj) return;
    
    try {
      setIsLoading(true);
      
      // API call to add transaction
      const response = await fetch(`${API_BASE_URL}/users/${currentUser.User_ID}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category_id: categoryObj.Category_ID,
          amount: parseFloat(newTransaction.amount),
          date: newTransaction.date,
        }),
      });
      
      if (response.ok) {
        const newTransactionData = await response.json();
        
        // Update local state with the new transaction
        const updatedTransactions = [...transactions, newTransactionData];
        setTransactions(updatedTransactions);
        
        // Update total emissions
        setTotalEmissions(totalEmissions + newTransactionData.emissions);
        
        // Update emissions by category chart
        updateEmissionsByCategory(newTransactionData, 'add');
        
        // Update emissions by price chart
        updateEmissionsByPrice(newTransactionData, 'add');
        
        // Reset form
        setNewTransaction({
          category: '',
          amount: '',
          date: new Date().toISOString().split('T')[0]
        });
      } else {
        console.error('Error adding transaction:', await response.text());
        alert('Failed to add transaction. Please try again.');
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error('Error adding transaction:', err);
      alert('Failed to add transaction. Please try again.');
      setIsLoading(false);
    }
  };
  
  // Delete a transaction
const handleDeleteTransaction = async (id) => {
  if (!currentUser) return;
  
  try {
    setIsLoading(true);
    
    // Find the transaction to delete before it's removed
    const transactionToDelete = transactions.find(t => t.id === id);
    if (!transactionToDelete) return;
    
    // API call to delete transaction
    const response = await fetch(`${API_BASE_URL}/users/${currentUser.User_ID}/transactions/${id}`, {
      method: 'DELETE',
    });
    
    if (response.ok) {
      // Remove from transactions
      const updatedTransactions = transactions.filter(t => t.id !== id);
      setTransactions(updatedTransactions);
      
      // Update total emissions
      setTotalEmissions(totalEmissions - transactionToDelete.emissions);
      
      // Update emissions by category chart
      updateEmissionsByCategory(transactionToDelete, 'delete');
      
      // Update emissions by price chart
      updateEmissionsByPrice(transactionToDelete, 'delete');
    } else {
      console.error('Error deleting transaction:', await response.text());
      alert('Failed to delete transaction. Please try again.');
    }
    
    setIsLoading(false);
  } catch (err) {
    console.error('Error deleting transaction:', err);
    alert('Failed to delete transaction. Please try again.');
    setIsLoading(false);
  }
};

// Helper function to update emissions by category chart
const updateEmissionsByCategory = (transaction, action) => {
  const updatedCategoryData = [...emissionsByCategory];
  const categoryIndex = updatedCategoryData.findIndex(c => c.category === transaction.category);
  
  if (action === 'add') {
    if (categoryIndex !== -1) {
      updatedCategoryData[categoryIndex].emissions += transaction.emissions;
    } else {
      updatedCategoryData.push({
        category: transaction.category,
        emissions: transaction.emissions
      });
    }
  } else if (action === 'delete') {
    if (categoryIndex !== -1) {
      updatedCategoryData[categoryIndex].emissions -= transaction.emissions;
      
      // Remove category if emissions are now 0
      if (updatedCategoryData[categoryIndex].emissions <= 0) {
        updatedCategoryData.splice(categoryIndex, 1);
      }
    }
  }
  
  setEmissionsByCategory(updatedCategoryData);
};

// Helper function to update emissions by price chart
const updateEmissionsByPrice = (transaction, action) => {
  const date = new Date(transaction.date);
  const month = date.toLocaleString('default', { month: 'short' });
  const updatedPriceData = [...emissionsByPrice];
  const monthIndex = updatedPriceData.findIndex(m => m.name === month);
  
  if (action === 'add') {
    if (monthIndex !== -1) {
      updatedPriceData[monthIndex].value += transaction.emissions;
    } else {
      updatedPriceData.push({
        name: month,
        value: transaction.emissions
      });
    }
  } else if (action === 'delete') {
    if (monthIndex !== -1) {
      updatedPriceData[monthIndex].value -= transaction.emissions;
      
      // Remove month if emissions are now 0
      if (updatedPriceData[monthIndex].value <= 0) {
        updatedPriceData.splice(monthIndex, 1);
      }
    }
  }
  
  setEmissionsByPrice(updatedPriceData);
};

return (
  <div className="scenario-planner">
    <div className="planner-header">
      <button className="back-button" onClick={onBack}>
        &larr; Back to Dashboard
      </button>
      <h1>Explore Your Carbon Footprint</h1>
      <div className="user-icon">👤</div>
    </div>
    
    {isLoading ? (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px' }}>
        <LoadingSpinner message="Loading data..." />
      </div>
    ) : (
      <div className="planner-content">
        <div className="transactions-section">
          <h2>Customer Purchase History</h2>
          
          <div className="transactions-table">
            <div className="table-header">
              <div className="table-cell">Category</div>
              <div className="table-cell">Amount ($)</div>
              <div className="table-cell">Date</div>
              <div className="table-cell">Emissions (kg CO₂e)</div>
              <div className="table-cell">Actions</div>
            </div>
            
            <div className="table-body">
              {transactions.map((transaction) => (
                <div className="table-row" key={transaction.id}>
                  <div className="table-cell">{transaction.category}</div>
                  <div className="table-cell">${parseFloat(transaction.amount).toFixed(2)}</div>
                  <div className="table-cell">{new Date(transaction.date).toLocaleDateString()}</div>
                  <div className="table-cell">{parseFloat(transaction.emissions).toFixed(2)}</div>
                  <div className="table-cell">
                    <button 
                      className="delete-btn"
                      onClick={() => handleDeleteTransaction(transaction.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="transaction-actions">
            <div className="add-transaction">
              <select 
                value={newTransaction.category}
                onChange={(e) => setNewTransaction({...newTransaction, category: e.target.value})}
              >
                <option value="">Select Category</option>
                {categories.map(category => (
                  <option key={category.Category_ID} value={category.Category_Name}>
                    {category.Category_Name}
                  </option>
                ))}
              </select>
              
              <input
                type="number"
                placeholder="Amount ($)"
                value={newTransaction.amount}
                onChange={(e) => setNewTransaction({...newTransaction, amount: e.target.value})}
              />
              
              <input
                type="date"
                value={newTransaction.date}
                onChange={(e) => setNewTransaction({...newTransaction, date: e.target.value})}
              />
              
              <button 
                className="add-btn"
                onClick={handleAddTransaction}
              >
                Add Transaction
              </button>
            </div>
          </div>
        </div>
        
        <div className="emissions-section">
          <div className="emissions-card">
            <h3>Total Emissions</h3>
            <div className="emissions-value">{parseFloat(totalEmissions).toFixed(2)}</div>
            <div className="emissions-unit">kg CO₂e</div>
          </div>
          
          <div className="chart-container">
            <h3>Emissions by Month</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={emissionsByPrice}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#4CAF50" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          <div className="chart-container">
            <h3>Emissions by Category</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={emissionsByCategory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="emissions" fill="#4CAF50" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    )}
  </div>
);
};

export default ScenarioPlanner;