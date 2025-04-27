import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import SearchBar from '../../components/SearchBar/SearchBar';
import Header from '../../components/Header/Header';
import './LandingPage.css';

const API_BASE_URL = 'http://localhost:3007/api';

const LandingPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [highRiskCategories, setHighRiskCategories] = useState(0);
  
  // Load emissions data for the chart
  useEffect(() => {
    const fetchEmissionsData = async () => {
      try {
        // In a real implementation, you would fetch this data from your API
        // For now, we'll use mock data that matches your sketch
        const mockCategories = [
          { category: 'a', emissions: 340, riskLevel: 'high' },
          { category: 'b', emissions: 580, riskLevel: 'low' },
          { category: 'c', emissions: 420, riskLevel: 'medium' },
          { category: 'd', emissions: 490, riskLevel: 'low' },
          { category: 'e', emissions: 380, riskLevel: 'medium' },
          { category: 'f', emissions: 520, riskLevel: 'high' }
        ];
        
        setCategoryData(mockCategories);
        
        // Count high risk categories
        const highRiskCount = mockCategories.filter(cat => cat.riskLevel === 'high').length;
        setHighRiskCategories(highRiskCount);
      } catch (err) {
        console.error('Error fetching emissions data:', err);
      }
    };
    
    fetchEmissionsData();
  }, []);
  
  // Load suggestions when search term changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const url = searchTerm 
          ? `${API_BASE_URL}/suggestions?query=${encodeURIComponent(searchTerm)}`
          : `${API_BASE_URL}/suggestions`;
          
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data);
        }
      } catch (err) {
        console.error('Error fetching suggestions:', err);
      }
    };
    
    fetchSuggestions();
  }, [searchTerm]);
  
  const handleSearch = async (query) => {
    if (!query || query.trim() === '') return;
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/search?query=${encodeURIComponent(query)}`);
      
      if (response.ok) {
        // In a real implementation, this would redirect to search results
        console.log('Search successful, would navigate to results page');
      }
    } catch (err) {
      console.error('Error performing search:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="landing-page">
      <div className="landing-container">
        <Header />
        
        <div className="search-section">
          <SearchBar 
            onSearch={handleSearch} 
            isLoading={isLoading} 
            suggestions={suggestions}
            onSearchTermChange={setSearchTerm}
          />
        </div>
        
        <div className="dashboard-section">
          <div className="dashboard-row">
            <div className="dashboard-card total-emission">
              <h3>Total Emission</h3>
              <div className="card-content">
                <div className="metric">{Math.round(categoryData.reduce((sum, cat) => sum + cat.emissions, 0))}</div>
                <div className="trend-icon">↗</div>
              </div>
            </div>
            
            <div className="dashboard-card high-risk">
              <h3>High Risk Categories</h3>
              <div className="card-content">
                <div className="metric">{highRiskCategories}</div>
                <div className="warning-icon">⚠</div>
              </div>
            </div>
          </div>
          
          <div className="data-visualization-section">
            <div className="chart-container">
              <h3>Emissions by Category</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="emissions" fill="#27ae60" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="risk-overview-container">
              <h3>Category Risk Overview</h3>
              <div className="risk-table">
                <div className="risk-header">
                  <div className="risk-cell">Category</div>
                  <div className="risk-cell">Emissions</div>
                  <div className="risk-cell">Risk Level</div>
                </div>
                {categoryData.map((cat, index) => (
                  <div className="risk-row" key={index}>
                    <div className="risk-cell">{cat.category}</div>
                    <div className="risk-cell">{cat.emissions}</div>
                    <div className="risk-cell">{cat.riskLevel}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <div className="action-section">
          <button className="carbon-footprint-btn">
            Example Carbon Footprint
          </button>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;