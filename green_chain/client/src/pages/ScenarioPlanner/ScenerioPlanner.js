import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import CarbonInsights from '../../components/CarbonInsights/CarbonInsights';
import './ScenarioPlanner.css';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';

const API_BASE_URL = 'http://localhost:3007/api';
const DEFAULT_USER_ID = 1;

const ScenarioPlanner = ({ onBack }) => {
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
  
  // Load initial data
  useEffect(() => {
    // These are our mock categories as a fallback
    const defaultCategories = [
      { id: 1, name: 'Electronics', emissionFactor: 0.11 },
      { id: 2, name: 'Clothing', emissionFactor: 0.14 },
      { id: 3, name: 'Sporting Goods', emissionFactor: 0.167 },
      { id: 4, name: 'Footwear', emissionFactor: 0.28 },
    ];
    
    // Set default categories while we try to load from the API
    setCategories(defaultCategories);
    
    // Try to fetch categories from API
    fetch(`${API_BASE_URL}/categories?limit=20?offset=0`)
      .then(response => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('Failed to fetch categories');
      })
      .then(data => {
        // Map API categories to match our format
        if (data.data && data.data.length) {
          const formattedCategories = data.data.map(cat => ({
            id: cat.Category_ID,
            name: cat.Category_Name,
            emissionFactor: 0.11 // Default emission factor
          }));
          setCategories(formattedCategories);
        }
      })
      .catch(error => {
        console.error('Error fetching categories:', error);
        // Keep using default categories on error
      });

    // Mock transactions - these would typically come from the API
    const mockTransactions = [
      { id: 1, category: 'Electronics', amount: 500, date: '2023-01-15', emissions: 55 },
      { id: 2, category: 'Clothing', amount: 200, date: '2023-02-10', emissions: 28 },
      { id: 3, category: 'Sporting Goods', amount: 150, date: '2023-03-05', emissions: 25 },
      { id: 4, category: 'Footwear', amount: 120, date: '2023-04-20', emissions: 34 },
      { id: 5, category: 'Electronics', amount: 300, date: '2023-05-18', emissions: 33 }
    ];
    
    setTransactions(mockTransactions);
    
    // Calculate total emissions
    const total = mockTransactions.reduce((sum, transaction) => sum + transaction.emissions, 0);
    setTotalEmissions(total);
    
    // Prepare chart data for Emissions by Price
    const priceData = [
      { name: 'Jan', value: 55 },
      { name: 'Feb', value: 32 },
      { name: 'Mar', value: 48 },
      { name: 'Apr', value: 25 },
      { name: 'May', value: 38 },
      { name: 'Jun', value: 65 }
    ];
    
    setEmissionsByPrice(priceData);
    
    // Prepare chart data for Emissions by Category
    const categoryData = [
      { category: 'Electronics', emissions: 88 },
      { category: 'Clothing', emissions: 28 },
      { category: 'Sporting Goods', emissions: 25 },
      { category: 'Footwear', emissions: 34 }
    ];
    
    setEmissionsByCategory(categoryData);
  }, []);
  
  // Add a new transaction
  const handleAddTransaction = () => {
    if (!newTransaction.category || !newTransaction.amount) {
      alert('Please select a category and enter an amount');
      return;
    }
    
    const category = categories.find(c => c.name === newTransaction.category);
    if (!category) return;
    
    const emissions = Math.round(newTransaction.amount * category.emissionFactor);
    
    const transaction = {
      id: transactions.length + 1,
      category: newTransaction.category,
      amount: parseFloat(newTransaction.amount),
      date: newTransaction.date,
      emissions: emissions
    };
    
    // Add to transactions
    const updatedTransactions = [...transactions, transaction];
    setTransactions(updatedTransactions);
    
    // Update total emissions
    setTotalEmissions(totalEmissions + emissions);
    
    // Update emissions by category chart
    const updatedCategoryData = [...emissionsByCategory];
    const existingCategory = updatedCategoryData.find(c => c.category === transaction.category);
    
    if (existingCategory) {
      existingCategory.emissions += emissions;
    } else {
      updatedCategoryData.push({
        category: transaction.category,
        emissions: emissions
      });
    }
    
    setEmissionsByCategory(updatedCategoryData);
    
    // Reset form
    setNewTransaction({
      category: '',
      amount: '',
      date: new Date().toISOString().split('T')[0]
    });
  };
  
  // Delete a transaction
  const handleDeleteTransaction = (id) => {
    const transactionToDelete = transactions.find(t => t.id === id);
    if (!transactionToDelete) return;
    
    // Remove from transactions
    const updatedTransactions = transactions.filter(t => t.id !== id);
    setTransactions(updatedTransactions);
    
    // Update total emissions
    setTotalEmissions(totalEmissions - transactionToDelete.emissions);
    
    // Update emissions by category chart
    const updatedCategoryData = [...emissionsByCategory];
    const categoryIndex = updatedCategoryData.findIndex(c => c.category === transactionToDelete.category);
    
    if (categoryIndex !== -1) {
      updatedCategoryData[categoryIndex].emissions -= transactionToDelete.emissions;
      
      // Remove category if emissions are now 0
      if (updatedCategoryData[categoryIndex].emissions <= 0) {
        updatedCategoryData.splice(categoryIndex, 1);
      }
    }
    
    setEmissionsByCategory(updatedCategoryData);
  };
  
  // NEW FUNCTION: Handle bulk submission of transactions
  const handleBulkSubmit = async () => {
    if (transactions.length === 0) {
      alert('Please add at least one transaction first');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Format transactions for the API
      const formattedTransactions = transactions.map(tx => {
        // Find category ID from name
        const category = categories.find(c => c.name === tx.category);
        return {
          category_id: category ? category.id : null,
          amount: tx.amount,
          date: tx.date
        };
      }).filter(tx => tx.category_id !== null);
      
      if (formattedTransactions.length === 0) {
        alert('No valid transactions to submit');
        setIsLoading(false);
        return;
      }
      
      // Call the transaction API endpoint
      const response = await fetch(`${API_BASE_URL}/users/${DEFAULT_USER_ID}/bulk-transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ transactions: formattedTransactions })
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit transactions');
      }
      
      const result = await response.json();
      alert(`Successfully submitted ${result.transactions.length} transactions!`);
      
      // Show insights after successful submission
      setShowInsights(true);
    } catch (error) {
      console.error('Error submitting transactions:', error);
      alert('Error submitting transactions: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  // NEW FUNCTION: Toggle insights view
  const toggleInsights = () => {
    setShowInsights(!showInsights);
  };
  
  return (
    <div className="scenario-planner">
      <div className="planner-header">
        <button className="back-button" onClick={onBack}>
          &larr; Back to Dashboard
        </button>
        <h1>Explore Your Carbon Footprint</h1>
      </div>
      
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px' }}>
          <LoadingSpinner message="Loading data..." />
        </div>
      ) : (
        <div className="planner-content">
          {showInsights ? (
            <>
              <CarbonInsights />
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
                    {transactions.map((transaction) => (
                      <div className="table-row" key={transaction.id}>
                        <div className="table-cell">{transaction.category}</div>
                        <div className="table-cell">${transaction.amount.toFixed(2)}</div>
                        <div className="table-cell">{transaction.date}</div>
                        <div className="table-cell">{transaction.emissions}</div>
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
                    
                    <button 
                      className="add-btn"
                      onClick={handleAddTransaction}
                    >
                      Add Transaction
                    </button>
                  </div>
                  
                  {/* NEW: Database operation buttons */}
                  <div style={{ marginTop: '20px' }}>
                    <button 
                      className="add-btn"
                      onClick={handleBulkSubmit}
                      style={{ width: '100%', marginTop: '10px', backgroundColor: '#2980b9' }}
                    >
                      Submit All Transactions
                    </button>
                    
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
                  <div className="emissions-value">{totalEmissions}</div>
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