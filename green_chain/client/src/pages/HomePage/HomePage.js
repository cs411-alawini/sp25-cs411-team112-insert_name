import React, { useState } from 'react';
import './HomePage.css';
import Header from '../../components/Header/Header';
import SearchBar from '../../components/SearchBar/SearchBar';
import CategoryResults from '../../components/CategoryResults/CategoryResults';
import NotFound from '../../components/NotFound/NotFound';

function HomePage() {
  const [searchResult, setSearchResult] = useState(null);
  const [notFound, setNotFound] = useState(false);
  
  const handleSearch = (category) => {
    // This would normally connect to the backend to fetch real data
    // For now, we'll just simulate a response
    
    // Simulate some example categories that would be found
    const knownCategories = ['manufacturing', 'agriculture', 'transportation', 'retail'];
    
    if (knownCategories.includes(category.toLowerCase())) {
      // Mock data for demonstration purposes
      setSearchResult({
        category: category,
        emissionFactor: Math.random() * 5 + 0.5, // Random value between 0.5 and 5.5
        unit: 'kg CO₂e per USD',
        naicsCode: '11-' + Math.floor(Math.random() * 9000 + 1000) // Random NAICS code
      });
      setNotFound(false);
    } else {
      setSearchResult(null);
      setNotFound(true);
    }
  };

  return (
    <div className="home-page">
      <div className="home-container">
        <Header />
        <SearchBar onSearch={handleSearch} />
        
        <div className="results-container">
          {searchResult && <CategoryResults result={searchResult} />}
          {notFound && <NotFound />}
        </div>
      </div>
    </div>
  );
}

export default HomePage;