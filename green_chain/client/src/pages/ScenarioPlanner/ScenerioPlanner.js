
import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import CarbonInsights from '../../components/CarbonInsights/CarbonInsights';
import './ScenarioPlanner.css';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';

const API_BASE_URL = 'http://localhost:3007/api';


const EmptyState = () => {
  return (
    <div style={{
      textAlign: 'center',
      padding: '40px 20px',
      background: '#f8fffa',
      borderRadius: '8px',
      border: '1px dashed #27ae60',
      maxWidth: '600px',
      margin: '20px auto'
    }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
      <h3 style={{ color: '#2c3e50', marginBottom: '12px' }}>No Transactions Yet</h3>
      <p style={{ color: '#7f8c8d', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
        Add your first transaction to start tracking your carbon footprint. Each purchase you record will help you understand your environmental impact.
      </p>
      <p style={{ fontSize: '14px', color: '#95a5a6' }}>
        Use the form below to add your first transaction.
      </p>
    </div>
  );
};

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
  
  
  const DEFAULT_USER_ID = 1; 
  const userId = user?.id || user?.User_ID || DEFAULT_USER_ID;
  
  
  useEffect(() => {
    
    const loadCategories = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/categories?limit=20`);
        if (response.ok) {
          const data = await response.json();
          
          if (data.data && data.data.length) {
            const formattedCategories = data.data.map(cat => ({
              id: cat.Category_ID,
              name: cat.Category_Name,
              emissionFactor: 0.11 
            }));
            setCategories(formattedCategories);
          } else {
            
            setCategories([]);
          }
        } else {
          
          setCategories([]);
          throw new Error('Failed to fetch categories');
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
        setError('Error loading categories. Please try again later.');
        setCategories([]);
      }
    };

    
    const initializeEmptyCharts = () => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      setEmissionsByPrice(months.map(name => ({ name, value: 0 })));
      setEmissionsByCategory([]);
    };

    
    loadCategories();
    fetchUserTransactions();
    initializeEmptyCharts();
  }, [userId]);

  
  const updateChartsAfterChange = (currentTransactions) => {
    
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

  
  const fetchUserTransactions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/users/${userId}/transactions`);
      
      if (response.ok) {
        const data = await response.json();
        
        
        if (Array.isArray(data) && data.length === 0) {
          
          setTransactions([]);
          setTotalEmissions(0);
          setEmissionsByCategory([]);
          
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          setEmissionsByPrice(months.map(name => ({ name, value: 0 })));
          
          setIsLoading(false);
          return;
        }
        
        
        setTransactions(data);
        
        
        const total = data.reduce((sum, transaction) => sum + parseFloat(transaction.emissions || 0), 0);
        setTotalEmissions(total);
        
        
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
      
      setTransactions([]);
      setTotalEmissions(0);
      setEmissionsByCategory([]);
      
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      setEmissionsByPrice(months.map(name => ({ name, value: 0 })));
    } finally {
      setIsLoading(false);
    }
  };
  
  
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
      
      const categoryId = category.id;
      
      
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
      
      
      const updatedTransactions = [...transactions, addedTransaction];
      setTransactions(updatedTransactions);
      
      
      const newTotal = updatedTransactions.reduce((sum, t) => sum + parseFloat(t.emissions || 0), 0);
      setTotalEmissions(newTotal);
      
      
      updateChartsAfterChange(updatedTransactions);
      
      
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
      
      const response = await fetch(`${API_BASE_URL}/users/${userId}/transactions/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete transaction: ${response.status} ${response.statusText}`);
      }
      
      
      const updatedTransactions = transactions.filter(t => t.id !== id);
      setTransactions(updatedTransactions);
      
      
      const newTotal = updatedTransactions.reduce((sum, t) => sum + parseFloat(t.emissions || 0), 0);
      setTotalEmissions(newTotal);
      
      
      updateChartsAfterChange(updatedTransactions);
      
    } catch (err) {
      console.error('Error deleting transaction:', err);
      setError(`Failed to delete transaction: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  
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
      
      const category = categories.find(c => c.name === newTransaction.category);
      if (!category) {
        throw new Error('Category not found');
      }
      
      
      const updateData = {
        category_id: category.id,
        amount: parseFloat(newTransaction.amount),
        date: newTransaction.date
      };
      
      
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
      
      
      const updatedTransactions = transactions.map(t => 
        t.id === editingTransaction.id ? updatedTransaction : t
      );
      setTransactions(updatedTransactions);
      
      
      const newTotal = updatedTransactions.reduce((sum, t) => sum + parseFloat(t.emissions || 0), 0);
      setTotalEmissions(newTotal);
      
      
      updateChartsAfterChange(updatedTransactions);
      
      
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
          {}
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
                
                {transactions.length > 0 ? (
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
                      ))}
                    </div>
                  </div>
                ) : (
                  <EmptyState />
                )}
                
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
