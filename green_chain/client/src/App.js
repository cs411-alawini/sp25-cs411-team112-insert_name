// src/App.js
import React, { useState, useEffect } from 'react';
import './App.css';
import LandingPage from './pages/LandingPage/LandingPage';
import ScenarioPlanner from './pages/ScenarioPlanner/ScenerioPlanner';
import Login from './components/Login/Login';

function App() {
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [currentPage, setCurrentPage] = useState('landing');

  // Check for existing user session in localStorage on load
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Error parsing stored user:', e);
        localStorage.removeItem('user');
      }
    }
  }, []);

  // Handle login success
  const handleLogin = (userData) => {
    setUser(userData);
    setShowLogin(false);
    
    // Store user data in localStorage for persistence
    localStorage.setItem('user', JSON.stringify(userData));
  };

  // Handle logout
  const handleLogout = () => {
    setUser(null);
    setCurrentPage('landing');
    localStorage.removeItem('user');
  };

  // Handle navigation to scenario planner
  const navigateToScenarioPlanner = () => {
    if (user) {
      setCurrentPage('scenarioPlanner');
    } else {
      setShowLogin(true);
    }
  };

  // Navigate back to the landing page
  const navigateToLanding = () => {
    setCurrentPage('landing');
  };

  return (
    <div className="App">
      {showLogin && (
        <Login 
          onLogin={handleLogin} 
          onClose={() => setShowLogin(false)} 
        />
      )}
      
      {currentPage === 'landing' && (
        <LandingPage 
          user={user} 
          onLogin={() => setShowLogin(true)}
          onLogout={handleLogout}
          onExploreFootprint={navigateToScenarioPlanner}
        />
      )}
      
      {currentPage === 'scenarioPlanner' && user && (
        <ScenarioPlanner 
          onBack={navigateToLanding}
          user={user}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

export default App;