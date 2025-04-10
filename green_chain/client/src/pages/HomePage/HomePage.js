import React, { useState, useCallback, useEffect } from 'react';
import './HomePage.css';
import Header from '../../components/Header/Header';
import SearchBar from '../../components/SearchBar/SearchBar';
import CategoryResults from '../../components/CategoryResults/CategoryResults';
import NotFound from '../../components/NotFound/NotFound';

// API base URL
const API_BASE_URL = 'http://localhost:3007/api';

function HomePage() {
  const [searchResults, setSearchResults] = useState([]);
  const [notFound, setNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  
  // Load suggestions when component mounts
  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/suggestions`);
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data);
        }
      } catch (err) {
        console.error('Error fetching suggestions:', err);
      }
    };
    
    fetchSuggestions();
  }, []);
  
  // No debouncing here - we want the search to happen only on explicit user action
  const handleSearch = useCallback(async (category) => {
    if (!category || category.trim() === '') return;
    
    setIsLoading(true);
    setNotFound(false);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/search?query=${encodeURIComponent(category)}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setNotFound(true);
          setSearchResults([]);
        } else {
          throw new Error(`API returned status ${response.status}`);
        }
        return;
      }
      
      const data = await response.json();
      
      if (data.length === 0) {
        setNotFound(true);
        setSearchResults([]);
      } else {
        setSearchResults(data);
        setNotFound(false);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to fetch data. Please try again later.');
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="home-page">
      <div className="home-container">
        <Header />
        <SearchBar 
          onSearch={handleSearch} 
          isLoading={isLoading} 
          suggestions={suggestions} 
        />
        
        <div className="results-container">
          {isLoading && (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <p>Searching for emissions data...</p>
            </div>
          )}
          
          {error && <div className="error-message">{error}</div>}
          
          {!isLoading && !error && searchResults.length > 0 && (
            <CategoryResults results={searchResults} />
          )}
          
          {!isLoading && !error && notFound && (
            <NotFound suggestions={suggestions} onSuggestionClick={(suggestion) => {
              // Just set the suggestion but don't trigger search automatically
            }} />
          )}
        </div>
      </div>
    </div>
  );
}

export default HomePage;