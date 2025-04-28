// src/pages/ScenarioPlanner/ScenerioPlanner.js
import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import CarbonInsights from '../../components/CarbonInsights/CarbonInsights';
import './ScenarioPlanner.css';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';

const API_BASE_URL = 'http://localhost:3007/api';

const ScenarioPlanner = ({ onBack, user, onLogout }) => {
  const [transactions, setTransactions] = useState([]);
  const [totalEmissions, setTotalEmissions] = useState(0);
  const [categories, setCategories] = useState([]);
  const [showInsights, setShowInsights] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    category: '',
    amount: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [emissionsByPrice, setEmissionsByPrice] = useState([]);
  const [emissionsByCategory, setEmissionsByCategory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState(null);
  
  // Use the user's ID from props
  const DEFAULT_USER_ID = 1; // Fallback if no user
  const userId = user?.id || user?.User_ID || DEFAULT_USER_ID;
  
  // Load initial data
  useEffect(() => {
    // Load categories
    const loadCategories = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/categories?limit=20`);
        if (response.ok) {
          const data = await response.json();
          // Map API categories to match our format
          if (data.data && data.data.length) {
            const formattedCategories = data.data.map(cat => ({
              id: cat.Category_ID,
              name: cat.Category_Name,
              emissionFactor: 0.11 // Default emission factor
            }));
            setCategories(formattedCategories);
          } else {
            // Set empty categories array
            setCategories([]);
          }
        } else {
          // Set empty categories array on error
          setCategories([]);
          throw new Error('Failed to fetch categories');
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
        setError('Error loading categories. Please try again later.');
        setCategories([]);
      }
    };

    // Initialize empty charts
    const initializeEmptyCharts = () => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      setEmissionsByPrice(months.map(name => ({ name, value: 0 })));
      setEmissionsByCategory([]);
    };

    // Load data
    loadCategories();
    fetchUserTransactions();
    initializeEmptyCharts();
  }, [userId]);

  // Update charts after transactions change
  const updateChartsAfterChange = (currentTransactions) => {
    // Update emissions by category chart
    const categoryMap = new Map();
    currentTransactions.forEach(transaction => {
      const existing = categoryMap.get(transaction.category) || 0;
      categoryMap.set(transaction.category, existing + parseFloat(transaction.emissions || 0));
    });
    
    const categoryData = Array.from(categoryMap).map(([category, emissions]) => ({
      category,
      emissions
    }));
    
    setEmissionsByCategory(categoryData);
    
    // Update emissions by month chart
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthData = Array(12).fill(0);
    
    currentTransactions.forEach(transaction => {
      const date = new Date(transaction.date);
      const monthIndex = date.getMonth();
      monthData[monthIndex] += parseFloat(transaction.emissions || 0);
    });
    
    const priceData = months.map((name, index) => ({
      name,
      value: monthData[index]
    }));
    
    setEmissionsByPrice(priceData);
  };

  // Fetch user transactions from API
  const fetchUserTransactions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/users/${userId}/transactions`);
      
      if (response.ok) {
        const data = await response.json();
        setTransactions(data);
        
        // Calculate total emissions properly
        const total = data.reduce((sum, transaction) => sum + parseFloat(transaction.emissions || 0), 0);
        setTotalEmissions(total);
        
        // Prepare chart data for Emissions by Category
        const categoryMap = new Map();
        data.forEach(transaction => {
          const existing = categoryMap.get(transaction.category) || 0;
          categoryMap.set(transaction.category, existing + parseFloat(transaction.emissions || 0));
        });
        
        const categoryData = Array.from(categoryMap).map(([category, emissions]) => ({
          category,
          emissions
        }));
        
        setEmissionsByCategory(categoryData);
        
        // Prepare chart data for Emissions by Month
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthData = Array(12).fill(0);
        
        data.forEach(transaction => {
          const date = new Date(transaction.date);
          const monthIndex = date.getMonth();
          monthData[monthIndex] += parseFloat(transaction.emissions || 0);
        });
        
        const priceData = months.map((name, index) => ({
          name,
          value: monthData[index]
        }));
        
        setEmissionsByPrice(priceData);
      } else if (response.status === 404) {
        // If no transactions found, use empty arrays
        setTransactions([]);
        setTotalEmissions(0);
        setEmissionsByCategory([]);
        
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        setEmissionsByPrice(months.map(name => ({ name, value: 0 })));
      } else {
        throw new Error(`Failed to fetch transactions: ${response.statusText}`);
      }
    } catch (err) {
      console.error('Error fetching user transactions:', err);
      setError('Error loading transactions. Please try again later.');
      // Set default empty state
      setTransactions([]);
      setTotalEmissions(0);
      setEmissionsByCategory([]);
      
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      setEmissionsByPrice(months.map(name => ({ name, value: 0 })));
    } finally {
      setIsLoading(false);
    }
  };
  
  // Add a new transaction
  const handleAddTransaction = async () => {
    if (!newTransaction.category || !newTransaction.amount) {
      setError('Please select a category and enter an amount');
      return;
    }
    
    const category = categories.find(c => c.name === newTransaction.category);
    if (!category) {
      setError('Selected category not found');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Find category_id
      const categoryId = category.id;
      
      // Send request to API
      const response = await fetch(`${API_BASE_URL}/users/${userId}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category_id: categoryId,
          amount: parseFloat(newTransaction.amount),
          date: newTransaction.date
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add transaction');
      }
      
      const addedTransaction = await response.json();
      console.log('Transaction added successfully:', addedTransaction);
      
      // Update local state
      const updatedTransactions = [...transactions, addedTransaction];
      setTransactions(updatedTransactions);
      
      // Update total emissions properly
      const newTotal = updatedTransactions.reduce((sum, t) => sum + parseFloat(t.emissions || 0), 0);
      setTotalEmissions(newTotal);
      
      // Update charts
      updateChartsAfterChange(updatedTransactions);
      
      // Reset form
      setNewTransaction({
        category: '',
        amount: '',
        date: new Date().toISOString().split('T')[0]
      });
    } catch (err) {
      console.error('Error adding transaction:', err);
      setError(`Failed to add transaction: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Delete a transaction
  const handleDeleteTransaction = async (id) => {
    if (!id) {
      setError('Invalid transaction ID');
      return;
    }
    
    const transactionToDelete = transactions.find(t => t.id === id);
    if (!transactionToDelete) {
      setError('Transaction not found');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Send delete request to API
      const response = await fetch(`${API_BASE_URL}/users/${userId}/transactions/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete transaction: ${response.status} ${response.statusText}`);
      }
      
      // Remove from transactions
      const updatedTransactions = transactions.filter(t => t.id !== id);
      setTransactions(updatedTransactions);
      
      // Update total emissions properly
      const newTotal = updatedTransactions.reduce((sum, t) => sum + parseFloat(t.emissions || 0), 0);
      setTotalEmissions(newTotal);
      
      // Update charts
      updateChartsAfterChange(updatedTransactions);
      
    } catch (err) {
      console.error('Error deleting transaction:', err);
      setError(`Failed to delete transaction: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle edit button click
  const handleEditClick = (transaction) => {
    setEditingTransaction(transaction);
    setNewTransaction({
      category: transaction.category,
      amount: transaction.amount,
      date: transaction.date
    });
    setIsEditing(true);
    setError(null);
  };

  // Handle update transaction
  const handleUpdateTransaction = async () => {
    if (!editingTransaction) {
      setError('No transaction selected for editing');
      return;
    }
    
    if (!newTransaction.category || !newTransaction.amount) {
      setError('Please select a category and enter an amount');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Find category
      const category = categories.find(c => c.name === newTransaction.category);
      if (!category) {
        throw new Error('Category not found');
      }
      
      // Prepare the update data
      const updateData = {
        category_id: category.id,
        amount: parseFloat(newTransaction.amount),
        date: newTransaction.date
      };
      
      // Send update request to API
      const response = await fetch(`${API_BASE_URL}/users/${userId}/transactions/${editingTransaction.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update transaction: ${response.status} ${response.statusText}`);
      }
      
      const updatedTransaction = await response.json();
      console.log('Transaction updated successfully:', updatedTransaction);
      
      // Update in local state
      const updatedTransactions = transactions.map(t => 
        t.id === editingTransaction.id ? updatedTransaction : t
      );
      setTransactions(updatedTransactions);
      
      // Recalculate total emissions
      const newTotal = updatedTransactions.reduce((sum, t) => sum + parseFloat(t.emissions || 0), 0);
      setTotalEmissions(newTotal);
      
      // Update charts
      updateChartsAfterChange(updatedTransactions);
      
      // Reset form and editing state
      setNewTransaction({
        category: '',
        amount: '',
        date: new Date().toISOString().split('T')[0]
      });
      setEditingTransaction(null);
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating transaction:', err);
      setError(`Failed to update transaction: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingTransaction(null);
    setIsEditing(false);
    setError(null);
    setNewTransaction({
      category: '',
      amount: '',
      date: new Date().toISOString().split('T')[0]
    });
  };
  
  // Toggle insights view
  const toggleInsights = () => {
    setShowInsights(!showInsights);
    setError(null);
  };

  return (
    <div className="scenario-planner">
      <div className="planner-header">
        <button className="back-button" onClick={onBack}>
          &larr; Back to Dashboard
        </button>
        <h1>Explore Your Carbon Footprint</h1>
        
        {user && (
          <div className="user-controls">
            <div className="user-info">
              <span className="username">{user.username}</span>
            </div>
            <button className="logout-button" onClick={onLogout}>
              Logout
            </button>
          </div>
        )}
      </div>
      
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px' }}>
          <LoadingSpinner message="Loading data..." />
        </div>
      ) : (
        <div className="planner-content">
          {/* Display error message if there is one */}
          {error && (
            <div style={{ 
              padding: '10px 15px', 
              backgroundColor: '#ffebee', 
              color: '#e74c3c',
              borderRadius: '4px',
              marginBottom: '20px',
              width: '100%',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}
          
          {showInsights ? (
            <>
              <CarbonInsights user={user} />
              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <button 
                  className="back-button" 
                  onClick={toggleInsights}
                  style={{ margin: '0 auto' }}
                >
                  Back to Transactions
                </button>
              </div>
            </>
          ) : (
            <>
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
                    {transactions.length > 0 ? (
                      transactions.map((transaction) => (
                        <div className="table-row" key={transaction.id}>
                          <div className="table-cell">{transaction.category}</div>
                          <div className="table-cell">${Number(transaction.amount).toFixed(2)}</div>
                          <div className="table-cell">{transaction.date}</div>
                          <div className="table-cell">{Number(transaction.emissions).toFixed(2)}</div>
                          <div className="table-cell">
                            <button 
                              className="edit-btn"
                              onClick={() => handleEditClick(transaction)}
                            >
                              Edit
                            </button>
                            <button 
                              className="delete-btn"
                              onClick={() => handleDeleteTransaction(transaction.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="table-row" style={{ justifyContent: 'center', padding: '20px' }}>
                        <div>No transactions yet. Add your first transaction below.</div>
                      </div>
                    )}
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
                        <option key={category.id} value={category.name}>
                          {category.name}
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
                    
                    {isEditing ? (
                      <>
                        <button 
                          className="add-btn update-btn"
                          onClick={handleUpdateTransaction}
                        >
                          Update Transaction
                        </button>
                        <button 
                          className="add-btn cancel-btn"
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button 
                        className="add-btn"
                        onClick={handleAddTransaction}
                      >
                        Add Transaction
                      </button>
                    )}
                  </div>
                  
                  <div style={{ marginTop: '20px' }}>
                    <button 
                      className="add-btn"
                      onClick={toggleInsights}
                      style={{ width: '100%', marginTop: '10px', backgroundColor: '#27ae60' }}
                    >
                      View Carbon Insights
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="emissions-section">
                <div className="emissions-card">
                  <h3>Total Emissions</h3>
                  <div className="emissions-value">
                    {isNaN(totalEmissions) ? "0.00" : Number(totalEmissions).toFixed(2)}
                  </div>
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
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ScenarioPlanner;