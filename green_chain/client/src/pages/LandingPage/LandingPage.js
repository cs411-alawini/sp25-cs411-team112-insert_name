
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import SearchBar from '../../components/SearchBar/SearchBar';
import Header from '../../components/Header/Header';
import CategoryResults from '../../components/CategoryResults/CategoryResults';
import NotFound from '../../components/NotFound/NotFound';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import './LandingPage.css';

const API_BASE_URL = 'http://localhost:3007/api';

const LandingPage = ({ user, onLogin, onLogout, onExploreFootprint }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);
  const [categoryData, setCategoryData] = useState([]);
  const [highRiskCategories, setHighRiskCategories] = useState(0);
  
  
  useEffect(() => {
    const fetchEmissionsData = async () => {
      try {
        
        setIsLoading(true);
        const response = await fetch(`${API_BASE_URL}/dashboard/emissions`);
        
        if (response.ok) {
          const data = await response.json();
          setCategoryData(data);
          
          
          const highRiskCount = data.filter(cat => cat.riskLevel === 'high').length;
          setHighRiskCategories(highRiskCount);
        } else {
          console.error('Error fetching emissions data:', await response.text());
        }
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching emissions data:', err);
        setIsLoading(false);
      }
    };
    
    fetchEmissionsData();
  }, []);
  
  
  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const url = searchTerm.length > 1
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
    setHasSearched(true);
    setShowDashboard(false);
    
    try {
      const response = await fetch(`${API_BASE_URL}/search?query=${encodeURIComponent(query)}`);
      
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
      } else if (response.status === 404) {
        
        setSearchResults([]);
      } else {
        console.error('Error performing search:', await response.text());
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Error performing search:', err);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  
  const handleSuggestionClick = (suggestion) => {
    handleSearch(suggestion);
  };

  
  const handleBackToDashboard = () => {
    setSearchResults(null);
    setHasSearched(false);
    setShowDashboard(true);
  };
  
  
  const handleSearchTermChange = (term) => {
    setSearchTerm(term);
  };

  return (
    <div className="fullscreen-landing-page">
      <div className="fullscreen-header">
        <div className="auth-container">
          {user ? (
            <div className="user-info">
              <span className="welcome-message">Welcome, {user.username}</span>
              <button className="auth-button logout" onClick={onLogout}>Logout</button>
            </div>
          ) : (
            <button className="auth-button login" onClick={onLogin}>Login</button>
          )}
        </div>
        
        <h1>Find out your carbon footprint</h1>
        <p className="subtitle">Search for a category of items to see its greenhouse gas emissions data</p>
        
        <div className="search-section">
          <SearchBar 
            onSearch={handleSearch} 
            isLoading={isLoading} 
            suggestions={suggestions}
            onSearchTermChange={handleSearchTermChange}
          />
        </div>
      </div>
      
      {}
      {hasSearched && (
        <div className="search-results-container">
          <button className="back-to-dashboard" onClick={handleBackToDashboard}>
            &larr; Back to Dashboard
          </button>
          
          {isLoading ? (
            <LoadingSpinner message="Searching for emission data..." />
          ) : searchResults && searchResults.length > 0 ? (
            <CategoryResults results={searchResults} />
          ) : (
            <NotFound 
              suggestions={suggestions.slice(0, 5)} 
              onSuggestionClick={handleSuggestionClick}
            />
          )}
        </div>
      )}
      
      {}
      {showDashboard && (
        <div className="fullscreen-dashboard">
          {isLoading ? (
            <LoadingSpinner message="Loading dashboard data..." />
          ) : (
            <>
              <div className="metrics-column">
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
                
                <div className="action-button-container">
                  <button 
                    className="carbon-footprint-btn large"
                    onClick={onExploreFootprint}
                  >
                    {user ? "Explore Your Carbon Footprint" : "Login to Explore Your Carbon Footprint"}
                  </button>
                </div>
              </div>
              
              <div className="visualization-column">
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
                        <div className="risk-cell">
                          <span className={`risk-level ${cat.riskLevel}`}>
                            {cat.riskLevel}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default LandingPage;
