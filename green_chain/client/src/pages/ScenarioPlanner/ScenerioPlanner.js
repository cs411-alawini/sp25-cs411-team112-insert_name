import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './ScenarioPlanner.css';

const API_BASE_URL = 'http://localhost:3007/api';

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
  
  // Load initial data
  useEffect(() => {
    // Mock data - in a real implementation, you would fetch this from your API
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
    
    // Mock categories
    const mockCategories = [
      { id: 1, name: 'Electronics', emissionFactor: 0.11 },
      { id: 2, name: 'Clothing', emissionFactor: 0.14 },
      { id: 3, name: 'Sporting Goods', emissionFactor: 0.167 },
      { id: 4, name: 'Footwear', emissionFactor: 0.28 },
      { id: 5, name: 'Books', emissionFactor: 0.09 },
      { id: 6, name: 'Furniture', emissionFactor: 0.19 }
    ];
    
    setCategories(mockCategories);
    
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
    const categoryData = mockCategories.map(cat => ({
      category: cat.name,
      emissions: mockTransactions
        .filter(t => t.category === cat.name)
        .reduce((sum, t) => sum + t.emissions, 0)
    })).filter(item => item.emissions > 0);
    
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
  
  return (
    <div className="scenario-planner">
      <div className="planner-header">
        <button className="back-button" onClick={onBack}>
          &larr; Back to Dashboard
        </button>
        <h1>Explore Your Carbon Footprint</h1>
        <div className="user-icon">👤</div>
      </div>
      
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
          </div>
        </div>
        
        <div className="emissions-section">
          <div className="emissions-card">
            <h3>Total Emissions</h3>
            <div className="emissions-value">{totalEmissions}</div>
            <div className="emissions-unit">kg CO₂e</div>
          </div>
          
          <div className="chart-container">
            <h3>Emissions by Price</h3>
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
    </div>
  );
};

export default ScenarioPlanner;