
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './CarbonInsights.css';

const API_BASE_URL = 'http://localhost:3007/api';

const EmptyInsightsState = () => {
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
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🌱</div>
      <h3 style={{ color: '#2c3e50', marginBottom: '12px' }}>No Carbon Data Yet</h3>
      <p style={{ color: '#7f8c8d', marginBottom: '24px', maxWidth: '450px', margin: '0 auto 24px' }}>
        You haven't recorded any transactions yet. Add purchases in the Transaction section to see your carbon footprint insights.
      </p>
      <p style={{ fontSize: '14px', color: '#95a5a6' }}>
        Your data will appear here once you've added some transactions.
      </p>
    </div>
  );
};

const CarbonInsights = ({ user }) => {
  const DEFAULT_USER_ID = 1; 
  const userId = user?.id || user?.User_ID || DEFAULT_USER_ID;
  
  const [insights, setInsights] = useState({
    categoryInsights: [],
    monthlyInsights: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchInsights = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`${API_BASE_URL}/users/${userId}/carbon-insights`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch carbon insights');
        }
        
        const data = await response.json();
        
        
        const isEmpty = 
          (!data.categoryInsights || data.categoryInsights.length === 0) && 
          (!data.monthlyInsights || data.monthlyInsights.length === 0);

        
        setInsights({
          categoryInsights: data.categoryInsights || [],
          monthlyInsights: data.monthlyInsights || []
        });
        
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching carbon insights:', err);
        setError(err.message);
        
        setInsights({
          categoryInsights: [],
          monthlyInsights: []
        });
        setIsLoading(false);
      }
    };
    
    fetchInsights();
  }, [userId]);
  
  if (isLoading) {
    return <div>Loading carbon insights...</div>;
  }
  
  if (error) {
    return <div>Error loading insights: {error}</div>;
  }
  
  
  if (
    (!insights.categoryInsights || insights.categoryInsights.length === 0) &&
    (!insights.monthlyInsights || insights.monthlyInsights.length === 0)
  ) {
    return <EmptyInsightsState />;
  }
  
  return (
    <div className="carbon-insights">
      <h2>Carbon Footprint Analysis for {user ? user.username : 'Guest'}</h2>
      
      <div className="insights-section">
        <h3>Emissions by Category</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={insights.categoryInsights}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="category_emissions" fill="#27ae60" name="Emissions (kg CO₂e)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="insights-section">
        <h3>Category Breakdown</h3>
        <table className="insights-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Total Spent ($)</th>
              <th>Emissions (kg CO₂e)</th>
              <th>Orders</th>
              <th>Impact Level</th>
            </tr>
          </thead>
          <tbody>
            {insights.categoryInsights.map((item, index) => (
              <tr key={index}>
                <td>{item.category}</td>
                <td>${parseFloat(item.total_spent).toFixed(2)}</td>
                <td>{parseFloat(item.category_emissions).toFixed(2)}</td>
                <td>{item.order_count}</td>
                <td>
                  <span className={`impact-level ${item.impact_level.toLowerCase()}`}>
                    {item.impact_level}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="insights-section">
        <h3>Monthly Emissions</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={insights.monthlyInsights}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="monthly_emissions" fill="#3498db" name="Emissions (kg CO₂e)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CarbonInsights;
